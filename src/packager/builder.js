import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DebComposeError, ErrorCode } from '../error/index.js';

const execFileAsync = promisify(execFile);

/**
 * Verify that dpkg-deb is available on the system.
 * @returns {Promise<boolean>}
 */
export async function checkDpkgDeb() {
  try {
    await execFileAsync('dpkg-deb', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a .deb package from a directory using dpkg-deb -b.
 *
 * The directory must contain a DEBIAN/ control directory and the
 * files to be packaged.
 *
 * @param {string} buildDir   - Directory with DEBIAN/ and payload files
 * @param {string} outputPath - Where to write the resulting .deb
 * @returns {Promise<{outputPath: string, stderr: string}>}
 * @throws {DebComposeError} dpkg-deb failure
 */
export async function buildDeb(buildDir, outputPath) {
  try {
    const { stderr } = await execFileAsync('dpkg-deb', [
      '-b',
      buildDir,
      outputPath,
    ]);
    return { outputPath, stderr };
  } catch (err) {
    throw new DebComposeError(ErrorCode.BUILD_FAILED, 'dpkg-deb build failed', {
      buildDir,
      outputPath,
      code: err.code,
      cause: err.stderr?.trim() || err.message,
    });
  }
}
