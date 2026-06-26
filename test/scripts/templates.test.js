import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generatePostinst, generatePostrm } from '../../src/scripts/templates.js';

const manifest = {
  version: '2.0.0',
  packages: [
    { name: 'runtime', file: 'runtime_2.0.0_amd64.deb' },
    { name: 'server', file: 'server_1.5.0_amd64.deb' },
  ],
};

describe('generatePostinst', () => {
  it('produces a bash script', () => {
    const script = generatePostinst(manifest);
    assert.ok(script.startsWith('#!/bin/bash\n'));
  });

  it('includes set -e', () => {
    const script = generatePostinst(manifest);
    assert.ok(script.includes('set -e\n'));
  });

  it('references manifest path', () => {
    const script = generatePostinst(manifest);
    assert.ok(script.includes('/opt/bundle/manifest.json'));
  });

  it('references bundle version', () => {
    const script = generatePostinst(manifest);
    assert.ok(script.includes('v2.0.0'));
  });

  it('logs errors and exits on failure', () => {
    const script = generatePostinst(manifest);
    assert.ok(script.includes('ERROR:'));
    assert.ok(script.includes('exit 1'));
  });
});

describe('generatePostrm', () => {
  it('produces a bash script', () => {
    const script = generatePostrm(manifest);
    assert.ok(script.startsWith('#!/bin/bash\n'));
  });

  it('checks for remove/purge argument', () => {
    const script = generatePostrm(manifest);
    assert.ok(script.includes('"remove"'));
    assert.ok(script.includes('"purge"'));
  });

  it('uses jq reverse for reverse-order removal', () => {
    const script = generatePostrm(manifest);
    assert.ok(script.includes('reverse'), 'should use jq reverse for reverse order');
    assert.ok(script.includes('dpkg -r'), 'should call dpkg -r for removal');
  });

  it('includes bundle version', () => {
    const script = generatePostrm(manifest);
    assert.ok(script.includes('v2.0.0'));
  });

  it('warns but does not fail on removal error', () => {
    const script = generatePostrm(manifest);
    assert.ok(!script.includes('exit 1'));
    assert.ok(script.includes('WARN'));
  });
});
