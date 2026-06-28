import { writeFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { DebComposeError, ErrorCode } from '../error/index.js';
import { createManifest } from './schema.js';
import { getPackageName } from '../deb/info.js';

const MANIFEST_FILE = 'manifest.json';

/**
 * Write a Manifest object to disk as manifest.json.
 * @param {import('./schema.js').Manifest} manifest
 * @param {string} outputDir - Target directory
 */
export async function writeManifest(manifest, outputDir) {
  const outputPath = join(outputDir, MANIFEST_FILE);
  const json = JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(outputPath, json, 'utf-8');
}

/**
 * Scan a directory for .deb files, extract package names, and
 * produce a validated Manifest object.
 * @param {string} debDir        - Directory containing .deb files
 * @param {string} bundleVersion - Version string for the bundle
 * @returns {Promise<import('./schema.js').Manifest>}
 * @throws {DebComposeError} No .deb files found, or dpkg-deb failure
 */
export async function generateManifest(debDir, bundleVersion, order) {
  const entries = await readdir(debDir);
  const debFiles = entries
    .filter(f => extname(f).toLowerCase() === '.deb')
    .sort();

  if (debFiles.length === 0) {
    throw new DebComposeError(ErrorCode.INVALID_INPUT, 'no .deb files found in directory', {
      path: debDir,
    });
  }

  // Extract package names from all deb files once
  const fileByName = {};
  const nameByFile = {};
  const errors = [];

  for (const file of debFiles) {
    const filePath = join(debDir, file);
    try {
      const name = await getPackageName(filePath);
      fileByName[name] = file;
      nameByFile[file] = name;
    } catch (err) {
      errors.push({ file, message: err.message });
    }
  }

  if (errors.length > 0) {
    throw new DebComposeError(ErrorCode.BUILD_FAILED, 'failed to read some .deb files', {
      path: debDir,
      errors,
    });
  }

  // If order is provided, reorder debFiles accordingly
  let orderedFiles = [...debFiles];
  if (order && order.length > 0) {
    const sorted = [];
    for (const name of order) {
      if (fileByName[name]) {
        sorted.push(fileByName[name]);
      }
    }
    // Append any files not in the order list at the end
    for (const file of debFiles) {
      if (!sorted.includes(file)) {
        sorted.push(file);
      }
    }
    orderedFiles = sorted;
  }

  // Build packages array using the already-extracted names
  const packages = orderedFiles.map(file => ({
    name: nameByFile[file],
    file,
  }));

  return createManifest(bundleVersion, packages);
}
