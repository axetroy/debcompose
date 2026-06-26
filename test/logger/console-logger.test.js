import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConsoleLogger } from '../../src/logger/console-logger.js';
import { LogLevel } from '../../src/logger/levels.js';

describe('ConsoleLogger', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('writes info messages to stdout', () => {
    const mockWrite = mock.method(process.stdout, 'write', () => true);
    const log = new ConsoleLogger('info');

    log.info('test message');

    assert.ok(mockWrite.mock.callCount() >= 1);
    const output = mockWrite.mock.calls.map(c => c.arguments[0]).join('');
    assert.ok(output.includes('[INFO]'));
    assert.ok(output.includes('test message'));
    assert.ok(output.endsWith('\n'));
  });

  it('writes error messages to stderr', () => {
    const mockWrite = mock.method(process.stderr, 'write', () => true);
    const log = new ConsoleLogger('info');

    log.error('error message');

    assert.ok(mockWrite.mock.callCount() >= 1);
    const output = mockWrite.mock.calls.map(c => c.arguments[0]).join('');
    assert.ok(output.includes('[ERROR]'));
  });

  it('filters out debug messages at info level', () => {
    const mockStdout = mock.method(process.stdout, 'write', () => true);
    const mockStderr = mock.method(process.stderr, 'write', () => true);
    const log = new ConsoleLogger('info');

    log.debug('should not appear');

    assert.equal(mockStdout.mock.callCount(), 0);
    assert.equal(mockStderr.mock.callCount(), 0);
  });

  it('allows debug messages at debug level', () => {
    const mockWrite = mock.method(process.stdout, 'write', () => true);
    const log = new ConsoleLogger('debug');

    log.debug('debug message');

    assert.ok(mockWrite.mock.callCount() > 0);
    const output = mockWrite.mock.calls.map(c => c.arguments[0]).join('');
    assert.ok(output.includes('[DEBUG]'));
  });

  it('formats Error objects with stack trace', () => {
    const mockWrite = mock.method(process.stderr, 'write', () => true);
    const log = new ConsoleLogger('info');
    const err = new Error('test error');

    log.error(err);

    const output = mockWrite.mock.calls.map(c => c.arguments[0]).join('');
    assert.ok(output.includes('Error: test error'));
    assert.ok(output.includes('console-logger.test.js'));
  });

  it('formats plain objects as JSON', () => {
    const mockWrite = mock.method(process.stdout, 'write', () => true);
    const log = new ConsoleLogger('info');

    log.info({ key: 'value', num: 42 });

    const output = mockWrite.mock.calls.map(c => c.arguments[0]).join('');
    assert.ok(output.includes('{"key":"value","num":42}'));
  });

  it('supports runtime level change via setter', () => {
    const mockWrite = mock.method(process.stdout, 'write', () => true);
    const log = new ConsoleLogger('error');

    log.info('should be filtered');
    assert.equal(mockWrite.mock.callCount(), 0);

    log.level = 'info';
    log.info('should appear');
    assert.ok(mockWrite.mock.callCount() > 0);
  });

  it('accepts LevelDef object in constructor', () => {
    const mockWrite = mock.method(process.stdout, 'write', () => true);
    const log = new ConsoleLogger(LogLevel.DEBUG);

    log.debug('debug at LevelDef');

    assert.ok(mockWrite.mock.callCount() > 0);
  });

  it('writes multiple arguments separated by space', () => {
    const mockWrite = mock.method(process.stdout, 'write', () => true);
    const log = new ConsoleLogger('info');

    log.info('a', 'b', 'c');

    const output = mockWrite.mock.calls.map(c => c.arguments[0]).join('');
    assert.ok(output.includes('a b c'));
  });
});
