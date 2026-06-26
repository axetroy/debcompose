/**
 * @typedef {Object} LevelDef
 * @property {string} name   - Level name (e.g. "DEBUG")
 * @property {number} priority - Numeric priority (0=lowest)
 * @property {string} label   - Output label (e.g. "[DEBUG]")
 */

/**
 * Log level definitions ordered by priority.
 * @type {Object<string, LevelDef>}
 */
export const LogLevel = Object.freeze({
  DEBUG: { name: 'DEBUG', priority: 0, label: '[DEBUG]' },
  INFO: { name: 'INFO', priority: 1, label: '[INFO]' },
  WARN: { name: 'WARN', priority: 2, label: '[WARN]' },
  ERROR: { name: 'ERROR', priority: 3, label: '[ERROR]' },
});

/**
 * Resolve a log level by name (case-insensitive). Falls back to INFO.
 * @param {string} name - Level name (e.g. "debug", "INFO", "Warn")
 * @returns {LevelDef}
 */
export function getLevelByName(name) {
  const key = name.toUpperCase();
  return LogLevel[key] || LogLevel.INFO;
}
