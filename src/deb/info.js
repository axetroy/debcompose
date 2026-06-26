import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Extract a single control field from a .deb package using dpkg-deb.
 * @param {string} debPath - Path to .deb file
 * @param {string} field   - dpkg-deb --showformat template (e.g. '${Package}')
 * @returns {Promise<string>}
 */
async function getField(debPath, field) {
  try {
    const { stdout } = await execFileAsync('dpkg-deb', [
      '--show',
      `--showformat=${field}`,
      debPath,
    ]);
    return stdout.trim();
  } catch (err) {
    const message = `failed to read ${field} from ${debPath}`;
    throw new Error(`${message}: ${err.stderr?.trim() || err.message}`);
  }
}

/**
 * Get the Debian package name from a .deb file.
 * @param {string} debPath - Path to .deb file
 * @returns {Promise<string>}
 */
export async function getPackageName(debPath) {
  return getField(debPath, '${Package}');
}

/**
 * Get the version string from a .deb file.
 * @param {string} debPath - Path to .deb file
 * @returns {Promise<string>}
 */
export async function getPackageVersion(debPath) {
  return getField(debPath, '${Version}');
}

/**
 * Get the architecture from a .deb file.
 * @param {string} debPath - Path to .deb file
 * @returns {Promise<string>}
 */
export async function getPackageArchitecture(debPath) {
  return getField(debPath, '${Architecture}');
}
