import { DebComposeError, ErrorCode } from '../error/index.js';

/**
 * @typedef {Object} ControlParams
 * @property {string} package         - Package name
 * @property {string} version         - Package version
 * @property {string} architecture    - Target architecture
 * @property {string} maintainer      - Maintainer string
 * @property {string} description     - Description (newlines for continuation lines)
 * @property {string} [depends]       - Dependency string
 * @property {string} [section]       - Package section (default: misc)
 * @property {string} [priority]      - Package priority (default: optional)
 * @property {string} [license]       - License identifier
 * @property {number} [installedSize] - Installed size in kilobytes
 */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Field definitions for the Debian control file.
 * Maps internal keys to their control-file labels and requirements.
 */
const CONTROL_FIELDS = {
  package: { required: true, label: 'Package' },
  version: { required: true, label: 'Version' },
  architecture: { required: true, label: 'Architecture' },
  maintainer: { required: true, label: 'Maintainer' },
  description: { required: true, label: 'Description' },
  depends: { required: false, label: 'Depends' },
  installedSize: { required: false, label: 'Installed-Size' },
  section: { required: false, label: 'Section', default: 'misc' },
  priority: { required: false, label: 'Priority', default: 'optional' },
  license: { required: false, label: 'License' },
};

/**
 * Validate control data, returning an array of error messages.
 * @param {unknown} data - Value to validate
 * @returns {string[]}
 */
export function validateControl(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['control data must be a plain object'];
  }

  for (const [key, field] of Object.entries(CONTROL_FIELDS)) {
    if (field.required) {
      if (!isNonEmptyString(data[key])) {
        errors.push(`control.${key} must be a non-empty string`);
      }
    }
  }

  return errors;
}

/**
 * Create a validated control data object with defaults applied.
 * @param {ControlParams} params
 * @returns {ControlParams}
 * @throws {DebComposeError} Validation failure
 */
export function createControlData(params) {
  const data = {};

  for (const [key, field] of Object.entries(CONTROL_FIELDS)) {
    const value = params[key] ?? field.default;
    if (value !== undefined) {
      data[key] = value;
    }
  }

  const errors = validateControl(data);
  if (errors.length > 0) {
    throw new DebComposeError(ErrorCode.INVALID_INPUT, `invalid control data: ${errors.join('; ')}`);
  }

  return data;
}

/**
 * Format control data into Debian control file text.
 * @param {ControlParams} data
 * @returns {string}
 */
export function formatControl(data) {
  const lines = [];

  for (const [key, field] of Object.entries(CONTROL_FIELDS)) {
    const value = data[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (key === 'description' && typeof value === 'string') {
      const parts = value.split('\n');
      lines.push(`${field.label}: ${parts[0]}`);
      for (let i = 1; i < parts.length; i++) {
        lines.push(` ${parts[i]}`);
      }
    } else {
      lines.push(`${field.label}: ${value}`);
    }
  }

  return lines.join('\n') + '\n';
}

export { CONTROL_FIELDS };
