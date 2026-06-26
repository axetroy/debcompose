import { DebComposeError, ErrorCode } from '../error/index.js';

/**
 * @typedef {Object} PackageEntry
 * @property {string} name - Debian package name
 * @property {string} file - File name within the bundle
 */

/**
 * @typedef {Object} Manifest
 * @property {string} version - Bundle version
 * @property {Array<PackageEntry>} packages - Ordered list of sub-packages
 */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate a manifest object, returning an array of error messages.
 * Returns an empty array for valid input.
 * @param {unknown} data - Value to validate
 * @returns {string[]}
 */
export function validateManifest(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['manifest must be a plain object'];
  }

  if (!isNonEmptyString(data.version)) {
    errors.push('manifest.version must be a non-empty string');
  }

  if (!Array.isArray(data.packages)) {
    errors.push('manifest.packages must be an array');
  } else if (data.packages.length === 0) {
    errors.push('manifest.packages must not be empty');
  } else {
    data.packages.forEach((pkg, i) => {
      const prefix = `manifest.packages[${i}]`;
      if (!pkg || typeof pkg !== 'object') {
        errors.push(`${prefix} must be an object`);
        return;
      }
      if (!isNonEmptyString(pkg.name)) {
        errors.push(`${prefix}.name must be a non-empty string`);
      }
      if (!isNonEmptyString(pkg.file)) {
        errors.push(`${prefix}.file must be a non-empty string`);
      }
    });
  }

  return errors;
}

/**
 * Create a validated Manifest object.
 * @param {string} version  - Bundle version
 * @param {Array<{name:string, file:string}>} packages - Ordered packages
 * @returns {Manifest}
 * @throws {DebComposeError} Validation failure
 */
export function createManifest(version, packages) {
  const manifest = {
    version,
    packages: packages.map(p => ({ name: p.name, file: p.file })),
  };

  const errors = validateManifest(manifest);
  if (errors.length > 0) {
    throw new DebComposeError(ErrorCode.INVALID_INPUT, 'manifest validation failed', { errors });
  }

  return manifest;
}
