import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeControl } from '../../src/control/writer.js';

describe('writeControl', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'debcompose-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes control file to DEBIAN directory', async () => {
    const debianDir = join(tmpDir, 'DEBIAN');
    await writeControl(tmpDir, {
      package: 'my-pkg',
      version: '1.0.0',
      architecture: 'amd64',
      maintainer: 'Test <test@test.com>',
      description: 'Test package',
    });

    const content = await readFile(join(tmpDir, 'control'), 'utf-8');
    assert.ok(content.includes('Package: my-pkg'));
    assert.ok(content.includes('Version: 1.0.0'));
  });

  it('includes optional fields when provided', async () => {
    await writeControl(tmpDir, {
      package: 'my-pkg',
      version: '1.0.0',
      architecture: 'amd64',
      maintainer: 'Test <test@test.com>',
      description: 'Test',
      depends: 'jq, python3',
      installedSize: 1024,
    });

    const content = await readFile(join(tmpDir, 'control'), 'utf-8');
    assert.ok(content.includes('Depends: jq, python3'));
    assert.ok(content.includes('Installed-Size: 1024'));
  });

  it('applies defaults for section and priority', async () => {
    await writeControl(tmpDir, {
      package: 'my-pkg',
      version: '1.0.0',
      architecture: 'amd64',
      maintainer: 'Test <test@test.com>',
      description: 'Test',
    });

    const content = await readFile(join(tmpDir, 'control'), 'utf-8');
    assert.ok(content.includes('Section: misc'));
    assert.ok(content.includes('Priority: optional'));
  });

  it('handles multi-line description', async () => {
    await writeControl(tmpDir, {
      package: 'my-pkg',
      version: '1.0.0',
      architecture: 'amd64',
      maintainer: 'Test <test@test.com>',
      description: 'First line\nSecond line\nThird line',
    });

    const content = await readFile(join(tmpDir, 'control'), 'utf-8');
    assert.ok(content.includes('Description: First line\n Second line\n Third line'));
  });
});
