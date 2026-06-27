import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, createManifest } from '../../src/manifest/schema.js';
import { DebComposeError } from '../../src/error/index.js';

describe('validateManifest', () => {
  it('returns errors for null', () => {
    const errors = validateManifest(null);
    assert.ok(errors.length > 0);
  });

  it('returns errors for undefined', () => {
    const errors = validateManifest(undefined);
    assert.ok(errors.length > 0);
  });

  it('returns errors for arrays', () => {
    const errors = validateManifest([]);
    assert.ok(errors.length > 0);
  });

  it('returns errors for non-object primitives', () => {
    assert.ok(validateManifest('string').length > 0);
    assert.ok(validateManifest(123).length > 0);
    assert.ok(validateManifest(true).length > 0);
  });

  it('returns errors for missing version', () => {
    const errors = validateManifest({ packages: [{ name: 'a', file: 'a.deb' }] });
    assert.ok(errors.some(e => e.includes('version')));
  });

  it('returns errors for empty string version', () => {
    const errors = validateManifest({ version: '', packages: [{ name: 'a', file: 'a.deb' }] });
    assert.ok(errors.some(e => e.includes('version')));
  });

  it('returns errors for whitespace-only version', () => {
    const errors = validateManifest({ version: '   ', packages: [{ name: 'a', file: 'a.deb' }] });
    assert.ok(errors.some(e => e.includes('version')));
  });

  it('returns errors for empty packages array', () => {
    const errors = validateManifest({ version: '1.0', packages: [] });
    assert.ok(errors.some(e => e.includes('packages')));
  });

  it('returns errors when packages is not an array', () => {
    const errors = validateManifest({ version: '1.0', packages: 'not-array' });
    assert.ok(errors.some(e => e.includes('packages')));
  });

  it('returns errors for invalid package fields', () => {
    const errors = validateManifest({
      version: '1.0',
      packages: [{ name: '', file: '' }],
    });
    assert.ok(errors.some(e => e.includes('name')));
    assert.ok(errors.some(e => e.includes('file')));
  });

  it('returns errors for whitespace-only package name', () => {
    const errors = validateManifest({
      version: '1.0',
      packages: [{ name: '  ', file: 'a.deb' }],
    });
    assert.ok(errors.some(e => e.includes('name')));
  });

  it('returns errors for whitespace-only package file', () => {
    const errors = validateManifest({
      version: '1.0',
      packages: [{ name: 'pkg', file: '   ' }],
    });
    assert.ok(errors.some(e => e.includes('file')));
  });

  it('returns errors for null package entry', () => {
    const errors = validateManifest({
      version: '1.0',
      packages: [null],
    });
    assert.ok(errors.length > 0);
  });

  it('returns multiple errors for multiple issues', () => {
    const errors = validateManifest({
      version: '',
      packages: [{ name: '', file: '' }],
    });
    assert.ok(errors.length >= 3);
  });

  it('returns no errors for valid manifest', () => {
    const errors = validateManifest({
      version: '1.0.0',
      packages: [
        { name: 'runtime', file: 'runtime_1.0_amd64.deb' },
      ],
    });
    assert.equal(errors.length, 0);
  });

  it('validates manifest with multiple packages', () => {
    const errors = validateManifest({
      version: '2.0.0',
      packages: [
        { name: 'runtime', file: 'runtime.deb' },
        { name: 'server', file: 'server.deb' },
        { name: 'client', file: 'client.deb' },
      ],
    });
    assert.equal(errors.length, 0);
  });

  it('returns indexed error messages for packages', () => {
    const errors = validateManifest({
      version: '1.0',
      packages: [
        { name: '', file: '' },
        { name: '', file: '' },
      ],
    });
    assert.ok(errors.some(e => e.includes('[0]')));
    assert.ok(errors.some(e => e.includes('[1]')));
  });
});

describe('createManifest', () => {
  it('creates valid manifest', () => {
    const m = createManifest('2.0.0', [
      { name: 'server', file: 'server.deb' },
    ]);
    assert.equal(m.version, '2.0.0');
    assert.equal(m.packages.length, 1);
    assert.equal(m.packages[0].name, 'server');
  });

  it('copies package name and file to manifest', () => {
    const m = createManifest('1.0.0', [
      { name: 'pkg1', file: 'file1.deb' },
    ]);
    assert.deepEqual(m.packages[0], { name: 'pkg1', file: 'file1.deb' });
  });

  it('throws for invalid input', () => {
    assert.throws(() => createManifest('', []), /manifest validation failed/);
  });

  it('throws DebComposeError with INVALID_INPUT code', () => {
    try {
      createManifest('', []);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof DebComposeError);
      assert.equal(err.code, 'INVALID_INPUT');
    }
  });

  it('throws with errors array in details', () => {
    try {
      createManifest('', []);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof DebComposeError);
      assert.ok(Array.isArray(err.details.errors));
    }
  });

  it('creates manifest with empty packages array', () => {
    // This should throw since manifest.packages must not be empty
    assert.throws(() => createManifest('1.0.0', []), /manifest validation failed/);
  });

  it('preserves original array order', () => {
    const packages = [
      { name: 'third', file: 'third.deb' },
      { name: 'first', file: 'first.deb' },
      { name: 'second', file: 'second.deb' },
    ];
    const m = createManifest('1.0.0', packages);
    assert.equal(m.packages[0].name, 'third');
    assert.equal(m.packages[1].name, 'first');
    assert.equal(m.packages[2].name, 'second');
  });
});
