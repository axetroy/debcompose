import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generatePostinst, generatePostrm } from '../../src/scripts/templates.js';

describe('generatePostinst - shell escaping', () => {
  const manifest = {
    version: '1.0.0',
    packages: [{ name: 'pkg', file: 'pkg.deb' }],
  };

  it('escapes single quotes in bundle name', () => {
    const script = generatePostinst(manifest, { bundleName: "bundle'name" });
    // Single quotes are escaped as: ' -> '\''
    assert.ok(script.includes("bundle'\\''name"));
  });

  it('handles dollar sign in bundle name (not escaped)', () => {
    const script = generatePostinst(manifest, { bundleName: 'bundle$name' });
    // Dollar sign appears literally (not escaped by escapeShellString)
    assert.ok(script.includes('bundle$name'));
  });

  it('preserves spaces in bundle name', () => {
    const script = generatePostinst(manifest, { bundleName: 'bundle name' });
    // Spaces are preserved in the path
    assert.ok(script.includes('/opt/bundle name/'));
    assert.ok(script.includes('/var/log/bundle name.log'));
  });

  it('escapes version string in manifest', () => {
    const m = { version: '1.0.0', packages: [{ name: 'pkg', file: 'pkg.deb' }] };
    const script = generatePostinst(m);
    // Version should appear as v1.0.0 in the log message
    assert.ok(script.includes('v1.0.0'));
  });

  it('escapes package file names with single quotes', () => {
    const m = { version: '1.0.0', packages: [{ name: 'pkg', file: "file'name.deb" }] };
    const script = generatePostinst(m);
    // Single quotes in filenames are escaped
    assert.ok(script.includes("file'\\''name.deb"));
  });
});

describe('generatePostrm - shell escaping', () => {
  const manifest = {
    version: '1.0.0',
    packages: [{ name: 'pkg', file: 'pkg.deb' }],
  };

  it('escapes single quotes in bundle name', () => {
    const script = generatePostrm(manifest, { bundleName: "bundle'name" });
    // Single quotes are escaped as: ' -> '\''
    assert.ok(script.includes("bundle'\\''name"));
  });

  it('handles dollar sign in bundle name (not escaped)', () => {
    const script = generatePostrm(manifest, { bundleName: 'bundle$name' });
    // Dollar sign appears literally
    assert.ok(script.includes('bundle$name'));
  });

  it('preserves spaces in bundle name', () => {
    const script = generatePostrm(manifest, { bundleName: 'bundle name' });
    // Spaces are preserved in the path
    assert.ok(script.includes('/var/log/bundle name.log'));
  });
});

describe('generatePostinst - path generation', () => {
  it('uses default product-installer when no bundleName provided', () => {
    const manifest = { version: '1.0.0', packages: [{ name: 'pkg', file: 'pkg.deb' }] };
    const script = generatePostinst(manifest);
    assert.ok(script.includes('/opt/product-installer/'));
    assert.ok(script.includes('/var/log/product-installer.log'));
  });

  it('uses custom bundleName for paths', () => {
    const manifest = { version: '1.0.0', packages: [{ name: 'pkg', file: 'pkg.deb' }] };
    const script = generatePostinst(manifest, { bundleName: 'my-app' });
    assert.ok(script.includes('/opt/my-app/'));
    assert.ok(script.includes('/var/log/my-app.log'));
  });

  it('sets DEB_DIR variable correctly', () => {
    const manifest = { version: '1.0.0', packages: [{ name: 'pkg', file: 'pkg.deb' }] };
    const script = generatePostinst(manifest, { bundleName: 'custom-app' });
    assert.ok(script.includes('DEB_DIR="/opt/custom-app"'));
  });

  it('sets LOG_FILE variable correctly', () => {
    const manifest = { version: '1.0.0', packages: [{ name: 'pkg', file: 'pkg.deb' }] };
    const script = generatePostinst(manifest, { bundleName: 'custom-app' });
    assert.ok(script.includes('LOG_FILE="/var/log/custom-app.log"'));
  });
});

describe('generatePostrm - path generation', () => {
  it('uses default product-installer when no bundleName provided', () => {
    const manifest = { version: '1.0.0', packages: [{ name: 'pkg', file: 'pkg.deb' }] };
    const script = generatePostrm(manifest);
    assert.ok(script.includes('/var/log/product-installer.log'));
  });

  it('uses custom bundleName for paths', () => {
    const manifest = { version: '1.0.0', packages: [{ name: 'pkg', file: 'pkg.deb' }] };
    const script = generatePostrm(manifest, { bundleName: 'my-app' });
    assert.ok(script.includes('/var/log/my-app.log'));
  });

  it('sets LOG_FILE variable correctly', () => {
    const manifest = { version: '1.0.0', packages: [{ name: 'pkg', file: 'pkg.deb' }] };
    const script = generatePostrm(manifest, { bundleName: 'custom-app' });
    assert.ok(script.includes('LOG_FILE="/var/log/custom-app.log"'));
  });
});
