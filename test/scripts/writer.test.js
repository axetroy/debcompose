import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
    assert.ok(content.startsWith('#!/bin/bash\n'));
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
    assert.ok(content.startsWith('#!/bin/bash\n'));
  });

  it('checks for remove/purge argument', async () => {
    await writePostrm(tmpDir, manifest);

    const content = await readFile(join(tmpDir, 'postrm'), 'utf-8');
    assert.ok(content.includes('"remove"'));
    assert.ok(content.includes('"purge"'));
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
    const stats = await import('node:fs/promises').then(m => m.stat(join(tmpDir, 'postinst')));
    const mode = stats.mode & parseInt('777', 8);
    assert.ok(mode & parseInt('100', 8), 'should be executable by owner');
  });

  it('postrm is executable', async () => {
    await writePostrm(tmpDir, manifest);
    const stats = await import('node:fs/promises').then(m => m.stat(join(tmpDir, 'postrm')));
    const mode = stats.mode & parseInt('777', 8);
    assert.ok(mode & parseInt('100', 8), 'should be executable by owner');
  });
});
