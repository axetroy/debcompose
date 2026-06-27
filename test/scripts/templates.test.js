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

const CUSTOM_NAME = 'myapp-installer';

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
    assert.ok(script.includes('/opt/product-installer/'));
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

  it('logs ExitCode on success and failure', () => {
    const script = generatePostinst(manifest);
    assert.ok(script.includes('ExitCode=0'));
    assert.ok(script.includes('ExitCode=$exit_code'));
  });

  it('defaults to product-installer paths', () => {
    const script = generatePostinst(manifest);
    assert.ok(script.includes('/var/log/product-installer.log'));
    assert.ok(script.includes('/opt/product-installer/'));
  });

  it('uses bundleName for log path', () => {
    const script = generatePostinst(manifest, { bundleName: CUSTOM_NAME });
    assert.ok(script.includes(`/var/log/${CUSTOM_NAME}.log`));
  });

  describe('onInstallError strategy', () => {
    it('default (stop) does not include rollback function', () => {
      const script = generatePostinst(manifest);
      assert.ok(!script.includes('rollback()'));
      assert.ok(!script.includes('INSTALLED='));
    });

    it('"stop" explicitly does not include rollback code', () => {
      const script = generatePostinst(manifest, { onInstallError: 'stop' });
      assert.ok(!script.includes('rollback()'));
      assert.ok(!script.includes('INSTALLED='));
    });

    it('"rollback" includes rollback function and tracking variable', () => {
      const script = generatePostinst(manifest, { onInstallError: 'rollback' });
      assert.ok(script.includes('rollback()'));
      assert.ok(script.includes('INSTALLED=""'));
      assert.ok(script.includes('$INSTALLED'));
    });

    it('"rollback" still errors and exits on failure', () => {
      const script = generatePostinst(manifest, { onInstallError: 'rollback' });
      assert.ok(script.includes('ERROR:'));
      assert.ok(script.includes('exit 1'));
    });

    it('"rollback" calls rollback function before exit', () => {
      const script = generatePostinst(manifest, { onInstallError: 'rollback' });
      assert.ok(script.match(/rollback\s*\n\s*exit 1/), 'should call rollback before exit 1');
    });

    it('"rollback" tracks successfully installed packages', () => {
      const script = generatePostinst(manifest, { onInstallError: 'rollback' });
      assert.ok(script.includes('INSTALLED="$INSTALLED runtime"'));
      assert.ok(script.includes('INSTALLED="$INSTALLED server"'));
    });
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

  it('removes packages in reverse order', () => {
    const script = generatePostrm(manifest);
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

  it('logs ExitCode on removal success and failure', () => {
    const script = generatePostrm(manifest);
    assert.ok(script.includes('ExitCode=0'));
    assert.ok(script.includes('ExitCode=$exit_code'));
  });

  it('defaults to product-installer paths for postrm', () => {
    const script = generatePostrm(manifest);
    assert.ok(script.includes('/var/log/product-installer.log'));
  });

  it('uses bundleName for postrm log path', () => {
    const script = generatePostrm(manifest, { bundleName: CUSTOM_NAME });
    assert.ok(script.includes(`/var/log/${CUSTOM_NAME}.log`));
  });
});
