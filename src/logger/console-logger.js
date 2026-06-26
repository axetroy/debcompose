import { LogLevel, getLevelByName } from './levels.js';

/**
 * Logger that writes formatted output to stdout/stderr.
 *
 * Supports level-based filtering and automatic formatting of
 * Error objects (stack trace) and plain objects (JSON).
 *
 * @example
 * const log = new ConsoleLogger('debug');
 * log.info('building bundle...');
 * log.error(new Error('disk full'));
 */
export class ConsoleLogger {
  #level;

  /**
   * @param {string|LevelDef} level - Minimum log level (default: 'info')
   */
  constructor(level = 'info') {
    this.#level = typeof level === 'string' ? getLevelByName(level) : level;
  }

  /**
   * Set the minimum log level at runtime.
   * @param {string|LevelDef} level
   */
  set level(level) {
    this.#level = typeof level === 'string' ? getLevelByName(level) : level;
  }

  /** @param {...unknown} args */
  debug(...args) {
    this.#write(LogLevel.DEBUG, ...args);
  }

  /** @param {...unknown} args */
  info(...args) {
    this.#write(LogLevel.INFO, ...args);
  }

  /** @param {...unknown} args */
  warn(...args) {
    this.#write(LogLevel.WARN, ...args);
  }

  /** @param {...unknown} args */
  error(...args) {
    this.#write(LogLevel.ERROR, ...args);
  }

  #write(level, ...args) {
    if (level.priority < this.#level.priority) {
      return;
    }

    const stream = level.priority >= LogLevel.ERROR.priority ? process.stderr : process.stdout;
    const timestamp = new Date().toISOString();
    stream.write(`${timestamp} ${level.label} `);
    stream.write(args.map(a => this.#format(a)).join(' '));
    stream.write('\n');
  }

  #format(value) {
    if (value instanceof Error) {
      return value.stack || value.message;
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }
}
