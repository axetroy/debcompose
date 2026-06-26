import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LogLevel, getLevelByName } from '../../src/logger/levels.js';

describe('LogLevel', () => {
  it('defines all levels with correct priorities', () => {
    assert.equal(LogLevel.DEBUG.priority, 0);
    assert.equal(LogLevel.INFO.priority, 1);
    assert.equal(LogLevel.WARN.priority, 2);
    assert.equal(LogLevel.ERROR.priority, 3);
  });

  it('has label for each level', () => {
    assert.equal(typeof LogLevel.DEBUG.label, 'string');
    assert.equal(typeof LogLevel.INFO.label, 'string');
    assert.equal(typeof LogLevel.WARN.label, 'string');
    assert.equal(typeof LogLevel.ERROR.label, 'string');
  });
});

describe('getLevelByName', () => {
  it('returns correct level for valid names', () => {
    assert.equal(getLevelByName('debug'), LogLevel.DEBUG);
    assert.equal(getLevelByName('INFO'), LogLevel.INFO);
    assert.equal(getLevelByName('Warn'), LogLevel.WARN);
    assert.equal(getLevelByName('error'), LogLevel.ERROR);
  });

  it('returns INFO for unknown names', () => {
    assert.equal(getLevelByName('unknown'), LogLevel.INFO);
  });
});
