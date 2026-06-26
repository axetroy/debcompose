import { readFile } from 'node:fs/promises';
import { DebComposeError, ErrorCode } from '../error/index.js';
import { validateManifest } from './schema.js';

/**
 * Read and validate a manifest.json from disk.
 * @param {string} manifestPath - Path to manifest.json
 * @returns {Promise<import('./schema.js').Manifest>}
 * @throws {DebComposeError} File missing, invalid JSON, or schema violation
 */
export async function readManifest(manifestPath) {
  let raw;
  try {
    raw = await readFile(manifestPath, 'utf-8');
  } catch (err) {
    throw new DebComposeError(ErrorCode.MISSING_FILE, 'cannot read manifest', {
      path: manifestPath,
      cause: err.message,
    });
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new DebComposeError(ErrorCode.INVALID_INPUT, 'manifest is not valid JSON', {
      path: manifestPath,
      cause: err.message,
    });
  }

  const errors = validateManifest(data);
  if (errors.length > 0) {
    throw new DebComposeError(ErrorCode.INVALID_INPUT, 'manifest content is invalid', {
      path: manifestPath,
      errors,
    });
  }

  return data;
}
