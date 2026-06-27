import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeControl } from '../control/index.js';
import { writePostinst, writePostrm } from '../scripts/index.js';
import { writeManifest } from '../manifest/index.js';
import { buildDeb } from '../packager/index.js';
import { calculateInstalledSize, generateMd5sums } from './utils.js';

/**
 * @typedef {Object} PipelineOptions
 * @property {string} buildDir         - Root of the build directory (must contain opt/bundle/ with .deb files)
 * @property {import('../manifest/schema.js').Manifest} manifest
 * @property {Object} controlConfig    - Control file data
 * @property {string} controlConfig.package
 * @property {string} controlConfig.version
 * @property {string} controlConfig.architecture
 * @property {string} [controlConfig.maintainer]
 * @property {string} [controlConfig.description]
 * @property {string} [controlConfig.section]
 * @property {string} [controlConfig.priority]
 * @property {string} [controlConfig.license]
 * @property {'stop' | 'rollback'} [onInstallError]
 */

/**
 * Run the common build pipeline.
 *
 * 1. Write manifest.json to opt/bundle/
 * 2. Write DEBIAN/control, postinst, postrm
 * 3. Generate DEBIAN/md5sums
 * 4. Run dpkg-deb -b
 *
 * @param {PipelineOptions} options
 * @returns {Promise<{outputPath: string}>}
 */
export async function runBuildPipeline({ buildDir, manifest, controlConfig, onInstallError }) {
  const debianDir = join(buildDir, 'DEBIAN');
  const bundleDir = join(buildDir, 'opt', 'bundle');

  await writeManifest(manifest, bundleDir);

  const installedSize = await calculateInstalledSize(bundleDir);

  const bundleName = controlConfig.package || 'product-installer';

  await writeControl(debianDir, { ...controlConfig, installedSize });
  await writePostinst(debianDir, manifest, { onInstallError, bundleName });
  await writePostrm(debianDir, manifest, { bundleName });

  const md5sums = await generateMd5sums(buildDir);
  await writeFile(join(debianDir, 'md5sums'), md5sums, 'utf-8');

  const outputFilename = `${controlConfig.package}_${controlConfig.version}_${controlConfig.architecture}.deb`;
  const outputPath = join(buildDir, '..', outputFilename);

  await buildDeb(buildDir, outputPath);

  return { outputPath };
}
