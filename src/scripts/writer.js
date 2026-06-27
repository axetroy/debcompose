import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generatePostinst, generatePostrm } from './templates.js';

const POSTINST = 'postinst';
const POSTRM = 'postrm';

/**
 * Write the postinst script to the DEBIAN directory.
 * @param {string} outputDir - DEBIAN directory path
 * @param {import('../manifest/schema.js').Manifest} manifest
 * @param {{ onInstallError?: import('./templates.js').OnInstallErrorStrategy, bundleName?: string }} [options]
 */
export async function writePostinst(outputDir, manifest, options) {
  const content = generatePostinst(manifest, options);
  const filePath = join(outputDir, POSTINST);
  await writeFile(filePath, content, { mode: 0o755 });
}

/**
 * Write the postrm script to the DEBIAN directory.
 * @param {string} outputDir - DEBIAN directory path
 * @param {import('../manifest/schema.js').Manifest} manifest
 * @param {{ bundleName?: string }} [options]
 */
export async function writePostrm(outputDir, manifest, options) {
  const content = generatePostrm(manifest, options);
  const filePath = join(outputDir, POSTRM);
  await writeFile(filePath, content, { mode: 0o755 });
}
