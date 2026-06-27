import { readdir, stat, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Calculate the total installed size (in kilobytes) of all .deb files in a directory.
 * @param {string} dir - Directory containing .deb files
 * @returns {Promise<number>} Size in KB (rounded up)
 */
export async function calculateInstalledSize(dir) {
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
export async function generateMd5sums(buildDir) {
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
