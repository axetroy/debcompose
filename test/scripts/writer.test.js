import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writePostinst, writePostrm } from '../../src/scripts/writer.js';

const manifest = {
  version: '1.0.0',
  packages: [
    { name: 'runtime', file: 'runtime.deb' },
    { name: 'server', file: 'server.deb' },
  ],
};

describe('writePostinst', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'debcompose-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes postinst file with execute permission', async () => {
    await writePostinst(tmpDir, manifest);

    const content = await readFile(join(tmpDir, 'postinst'), 'utf-8');
    const lines = content.split('\n');
    assert.ok(lines[0] === '#!/bin/bash', 'Shell shebang missing or incorrect');
  });

  it('includes bundle version in the script', async () => {
    await writePostinst(tmpDir, manifest);

    const content = await readFile(join(tmpDir, 'postinst'), 'utf-8');
    assert.ok(content.includes('v1.0.0'));
  });

  it('references manifest path', async () => {
    await writePostinst(tmpDir, manifest);

    const content = await readFile(join(tmpDir, 'postinst'), 'utf-8');
    assert.ok(content.includes('/opt/bundle/manifest.json'));
  });

  it('references deb directory', async () => {
    await writePostinst(tmpDir, manifest);

    const content = await readFile(join(tmpDir, 'postinst'), 'utf-8');
    assert.ok(content.includes('/opt/bundle'));
  });

  it('writes rollback postinst with rollback function', async () => {
    await writePostinst(tmpDir, manifest, { onInstallError: 'rollback' });

    const content = await readFile(join(tmpDir, 'postinst'), 'utf-8');
    assert.ok(content.includes('rollback()'));
    assert.ok(content.includes('INSTALLED='));
  });
});

describe('writePostrm', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'debcompose-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes postrm file with execute permission', async () => {
    await writePostrm(tmpDir, manifest);

    const content = await readFile(join(tmpDir, 'postrm'), 'utf-8');
    const lines = content.split('\n');
    assert.ok(lines[0] === '#!/bin/bash', 'Shell shebang missing or incorrect');
  });

  it('checks for remove/purge argument', async () => {
    await writePostrm(tmpDir, manifest);

    const content = await readFile(join(tmpDir, 'postrm'), 'utf-8');
    assert.ok(content.includes('\"remove\"'));
    assert.ok(content.includes('\"purge\"'));
  });

  it('removes packages from persistent list', async () => {
    await writePostrm(tmpDir, manifest);

    const content = await readFile(join(tmpDir, 'postrm'), 'utf-8');
    assert.ok(content.includes('PACKAGE_NAMES'), 'should read package list');
    assert.ok(content.includes('dpkg -r'), 'should call dpkg -r for removal');
  });

  it('includes bundle version', async () => {
    await writePostrm(tmpDir, manifest);

    const content = await readFile(join(tmpDir, 'postrm'), 'utf-8');
    assert.ok(content.includes('v1.0.0'));
  });
});

describe('writePostinst and writePostrm file modes', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'debcompose-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('postinst is executable', async () => {
    await writePostinst(tmpDir, manifest);
    const platform = process.platform;
    if (platform === 'win32') {
      console.log('Skipping executable permission check on Windows');
      return;
    }
    const stats = await stat(join(tmpDir, 'postinst'));
    const mode = stats.mode & parseInt('777', 8);
    assert.ok(mode & parseInt('100', 8), 'should be executable by owner');
  });

  it('postrm is executable', async () => {
    await writePostrm(tmpDir, manifest);
    const platform = process.platform;
    if (platform === 'win32') {
      console.log('Skipping executable permission check on Windows');
      return;
    }
    const stats = await stat(join(tmpDir, 'postrm'));
    const mode = stats.mode & parseInt('777', 8);
    assert.ok(mode & parseInt('100', 8), 'should be executable by owner');
  });
});