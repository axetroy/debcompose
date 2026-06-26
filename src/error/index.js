/**
 * @typedef {Object} ErrorDetails
 * @property {string} [path]
 * @property {string} [cause]
 * @property {Array} [errors]
 */

/**
 * Structured application error with machine-readable code and context.
 *
 * Unlike a plain Error, DebComposeError carries:
 * - A string `code` for programmatic handling
 * - A `details` object with contextual metadata
 *
 * @example
 * throw new DebComposeError(ErrorCode.MISSING_FILE, 'config not found', { path: '/etc/x' });
 */
export class DebComposeError extends Error {
  #code;
  #details;

  /**
   * @param {string} code    - Machine-readable error code
   * @param {string} message - Human-readable description
   * @param {ErrorDetails} [details] - Contextual metadata
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DebComposeError';
    this.#code = code;
    this.#details = details;
  }

  /** @returns {string} */
  get code() {
    return this.#code;
  }

  /** @returns {ErrorDetails} */
  get details() {
    return this.#details;
  }

  /** @returns {{ name: string, code: string, message: string, details: ErrorDetails }} */
  toJSON() {
    return {
      name: this.name,
      code: this.#code,
      message: this.message,
      details: this.#details,
    };
  }

  /** @returns {string} */
  toString() {
    return `[${this.#code}] ${this.message}`;
  }
}

/**
 * Predefined error codes used across the project.
 * @enum {string}
 */
export const ErrorCode = Object.freeze({
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FILE: 'MISSING_FILE',
  BUILD_FAILED: 'BUILD_FAILED',
  IO_ERROR: 'IO_ERROR',
});
