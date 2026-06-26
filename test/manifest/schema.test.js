import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, createManifest } from '../../src/manifest/schema.js';

describe('validateManifest', () => {
  it('returns errors for null', () => {
    const errors = validateManifest(null);
    assert.ok(errors.length > 0);
  });

  it('returns errors for missing version', () => {
    const errors = validateManifest({ packages: [{ name: 'a', file: 'a.deb' }] });
    assert.ok(errors.some(e => e.includes('version')));
  });

  it('returns errors for empty packages', () => {
    const errors = validateManifest({ version: '1.0', packages: [] });
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

  it('returns no errors for valid manifest', () => {
    const errors = validateManifest({
      version: '1.0.0',
      packages: [
        { name: 'runtime', file: 'runtime_1.0_amd64.deb' },
      ],
    });
    assert.equal(errors.length, 0);
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

  it('throws for invalid input', () => {
    assert.throws(() => createManifest('', []), /manifest validation failed/);
  });
});
