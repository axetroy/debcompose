import { mkdir, mkdtemp, cp, rm, stat, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { DebComposeError, ErrorCode } from '../error/index.js';
import { generateManifest, writeManifest } from '../manifest/index.js';
import { writeControl } from '../control/index.js';
import { writePostinst, writePostrm } from '../scripts/index.js';
import { buildDeb, checkDpkgDeb } from '../packager/index.js';

/**
 * @typedef {Object} BuildOptions
 * @property {string} debDir        - Directory containing .deb files
 * @property {string} [outputDir]   - Output directory for the bundle .deb
 * @property {string} [version]     - Bundle version (default: 1.0.0)
 * @property {string} [package]     - Bundle package name (auto-detected from first .deb)
 * @property {string} [architecture] - Target architecture (default: amd64)
 * @property {string} [maintainer]  - Maintainer string
 * @property {string} [description] - Description string
 */

/**
 * @typedef {Object} BuildResult
 * @property {string} outputPath       - Path to the generated .deb
 * @property {import('../manifest/schema.js').Manifest} manifest - Generated manifest
 * @property {boolean} dpkgDebAvailable - Whether dpkg-deb is available
 */

/**
 * Calculate the total installed size (in kilobytes) of all .deb files in a directory.
 * @param {string} dir - Directory containing .deb files
 * @returns {Promise<number>} Size in KB (rounded up)
 */
async function calculateInstalledSize(dir) {
  const entries = await readdir(dir);
  let totalBytes = 0;

  for (const entry of entries) {
    if (extname(entry).toLowerCase() !== '.deb') {
      continue;
    }
    const { size } = await stat(join(dir, entry));
    totalBytes += size;
  }

  return Math.ceil(totalBytes / 1024);
}

/**
 * Generate DEBIAN/md5sums for all payload files.
 * Skips the DEBIAN metadata directory.
 * @param {string} buildDir - Root of the .deb build directory
 * @returns {Promise<string>} md5sums content
 */
async function generateMd5sums(buildDir) {
  const lines = [];

  async function walk(dir, relativePrefix) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, join(relativePrefix, entry.name));
      } else {
        const content = await readFile(fullPath);
        const hash = createHash('md5').update(content).digest('hex');
        lines.push(`${hash}  ${join(relativePrefix, entry.name)}`);
      }
    }
  }

  const topEntries = await readdir(buildDir, { withFileTypes: true });
  for (const entry of topEntries) {
    if (entry.name === 'DEBIAN') continue;
    const fullPath = join(buildDir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, entry.name);
    } else {
      const content = await readFile(fullPath);
      const hash = createHash('md5').update(content).digest('hex');
      lines.push(`${hash}  ${entry.name}`);
    }
  }

  return lines.sort().join('\n') + '\n';
}

/**
 * Build a bundle .deb from a directory of sub-packages.
 *
 * Orchestrates the full build pipeline:
 * 1. Check dpkg-deb availability
 * 2. Extract package info from .deb files → manifest
 * 3. Create temporary build directory
 * 4. Copy .deb files into opt/bundle/
 * 5. Generate manifest.json, control, postinst, postrm, md5sums
 * 6. Invoke dpkg-deb -b to produce the final .deb
 * 7. Clean up temporary files
 *
 * @param {BuildOptions} options
 * @returns {Promise<BuildResult>}
 * @throws {DebComposeError} Any step in the pipeline
 */
export async function buildBundle(options) {
  const {
    debDir,
    outputDir,
    version,
    package: packageName,
    architecture,
    maintainer,
    description,
    section,
    priority,
    license,
    order,
  } = options;

  if (!debDir) {
    throw new DebComposeError(ErrorCode.INVALID_INPUT, 'debDir is required');
  }

  const dpkgDebAvailable = await checkDpkgDeb();
  if (!dpkgDebAvailable) {
    throw new DebComposeError(ErrorCode.BUILD_FAILED, 'dpkg-deb not found; install dpkg-dev first');
  }

  const manifest = await generateManifest(debDir, version || '1.0.0', order);

  const tmpDir = await mkdtemp(join(tmpdir(), 'debcompose-'));

  try {
    const debianDir = join(tmpDir, 'DEBIAN');
    const bundleDir = join(tmpDir, 'opt', 'bundle');

    await mkdir(debianDir, { recursive: true });
    await mkdir(bundleDir, { recursive: true });

    await cp(debDir, bundleDir, { recursive: true });
    await writeManifest(manifest, bundleDir);

    const installedSize = await calculateInstalledSize(bundleDir);
    const name = packageName || `${manifest.packages[0]?.name || 'bundle'}-installer`;

    await writeControl(debianDir, {
      package: name,
      version: manifest.version,
      architecture: architecture || 'amd64',
      maintainer: maintainer || 'Unknown <unknown>',
      description: description || 'Bundle installer\n Auto-generated by debcompose.',
      section: section || 'misc',
      priority: priority || 'optional',
      license: license || undefined,
      installedSize,
    });

    await writePostinst(debianDir, manifest);
    await writePostrm(debianDir, manifest);

    const md5sums = await generateMd5sums(tmpDir);
    await writeFile(join(debianDir, 'md5sums'), md5sums, 'utf-8');

    const outputFilename = `${name}_${manifest.version}_${architecture || 'amd64'}.deb`;
    const outputPath = join(outputDir || process.cwd(), outputFilename);

    await mkdir(outputDir || process.cwd(), { recursive: true });
    await buildDeb(tmpDir, outputPath);

    return {
      outputPath,
      manifest,
      dpkgDebAvailable,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
