import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DebComposeError, ErrorCode } from '../../src/error/index.js';

describe('DebComposeError', () => {
  it('stores code and message', () => {
    const err = new DebComposeError(ErrorCode.INVALID_INPUT, 'test error');
    assert.equal(err.code, ErrorCode.INVALID_INPUT);
    assert.equal(err.message, 'test error');
    assert.equal(err.name, 'DebComposeError');
  });

  it('stores optional details', () => {
    const err = new DebComposeError(ErrorCode.BUILD_FAILED, 'build failed', { path: '/tmp' });
    assert.deepEqual(err.details, { path: '/tmp' });
  });

  it('toString returns formatted string', () => {
    const err = new DebComposeError(ErrorCode.MISSING_FILE, 'file not found');
    assert.equal(err.toString(), '[MISSING_FILE] file not found');
  });

  it('toJSON returns serializable object', () => {
    const err = new DebComposeError(ErrorCode.IO_ERROR, 'io error', { path: '/x' });
    const json = err.toJSON();
    assert.equal(json.code, 'IO_ERROR');
    assert.equal(json.message, 'io error');
    assert.deepEqual(json.details, { path: '/x' });
  });
});

describe('ErrorCode', () => {
  it('defines all error codes', () => {
    assert.equal(ErrorCode.INVALID_INPUT, 'INVALID_INPUT');
    assert.equal(ErrorCode.MISSING_FILE, 'MISSING_FILE');
    assert.equal(ErrorCode.BUILD_FAILED, 'BUILD_FAILED');
    assert.equal(ErrorCode.IO_ERROR, 'IO_ERROR');
  });
});
