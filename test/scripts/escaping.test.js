import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generatePostinst, generatePostrm } from '../../src/scripts/templates.js';

const MANIFEST = { version: '1.0.0', packages: [{ name: 'pkg', file: 'pkg.deb' }] };

describe('generatePostinst - shell escaping', () => {
  it('escapes single quotes in bundle name', () => {
    const script = generatePostinst(MANIFEST, { bundleName: "bundle'name" });
    assert.ok(script.includes("bundle'\\''name"));
  });

  it('handles dollar sign in bundle name (not escaped)', () => {
    const script = generatePostinst(MANIFEST, { bundleName: 'bundle$name' });
    assert.ok(script.includes('bundle$name'));
  });

  it('preserves spaces in bundle name', () => {
    const script = generatePostinst(MANIFEST, { bundleName: 'bundle name' });
    assert.ok(script.includes('/opt/bundle name/'));
    assert.ok(script.includes('/var/log/bundle name.log'));
  });

  it('escapes version string in manifest', () => {
    const script = generatePostinst(MANIFEST);
    assert.ok(script.includes('v1.0.0'));
  });

  it('escapes package file names with single quotes', () => {
    const m = { version: '1.0.0', packages: [{ name: 'pkg', file: "file'name.deb" }] };
    const script = generatePostinst(m);
    assert.ok(script.includes("file'\\''name.deb"));
  });
});

describe('generatePostrm - shell escaping', () => {
  it('escapes single quotes in bundle name', () => {
    const script = generatePostrm(MANIFEST, { bundleName: "bundle'name" });
    assert.ok(script.includes("bundle'\\''name"));
  });

  it('handles dollar sign in bundle name (not escaped)', () => {
    const script = generatePostrm(MANIFEST, { bundleName: 'bundle$name' });
    assert.ok(script.includes('bundle$name'));
  });

  it('preserves spaces in bundle name', () => {
    const script = generatePostrm(MANIFEST, { bundleName: 'bundle name' });
    assert.ok(script.includes('/var/log/bundle name.log'));
  });
});

describe('generatePostinst - path generation', () => {
  it('uses default product-installer when no bundleName provided', () => {
    const script = generatePostinst(MANIFEST);
    assert.ok(script.includes('/opt/product-installer/'));
    assert.ok(script.includes('/var/log/product-installer.log'));
  });

  it('uses custom bundleName for paths', () => {
    const script = generatePostinst(MANIFEST, { bundleName: 'my-app' });
    assert.ok(script.includes('/opt/my-app/'));
    assert.ok(script.includes('/var/log/my-app.log'));
  });

  it('sets DEB_DIR and LOG_FILE variables correctly', () => {
    const script = generatePostinst(MANIFEST, { bundleName: 'custom-app' });
    assert.ok(script.includes('DEB_DIR="/opt/custom-app"'));
    assert.ok(script.includes('LOG_FILE="/var/log/custom-app.log"'));
  });
});

describe('generatePostrm - path generation', () => {
  it('uses default product-installer when no bundleName provided', () => {
    const script = generatePostrm(MANIFEST);
    assert.ok(script.includes('/var/log/product-installer.log'));
  });

  it('uses custom bundleName for paths', () => {
    const script = generatePostrm(MANIFEST, { bundleName: 'my-app' });
    assert.ok(script.includes('/var/log/my-app.log'));
  });

  it('sets LOG_FILE variable correctly', () => {
    const script = generatePostrm(MANIFEST, { bundleName: 'custom-app' });
    assert.ok(script.includes('LOG_FILE="/var/log/custom-app.log"'));
  });
});
