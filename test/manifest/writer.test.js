import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeManifest } from '../../src/manifest/writer.js';
import { createManifest } from '../../src/manifest/schema.js';

describe('writeManifest', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'debcompose-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes manifest.json to disk', async () => {
    const manifest = createManifest('1.0.0', [{ name: 'pkg', file: 'pkg.deb' }]);
    await writeManifest(manifest, tmpDir);

    const content = await readFile(join(tmpDir, 'manifest.json'), 'utf-8');
    const parsed = JSON.parse(content);
    assert.equal(parsed.version, '1.0.0');
    assert.equal(parsed.packages.length, 1);
  });

  it('writes pretty-printed JSON', async () => {
    const manifest = createManifest('1.0.0', [{ name: 'pkg', file: 'pkg.deb' }]);
    await writeManifest(manifest, tmpDir);

    const content = await readFile(join(tmpDir, 'manifest.json'), 'utf-8');
    assert.ok(content.includes('  '), 'should be indented');
    assert.ok(content.endsWith('\n'), 'should end with newline');
  });

  it('handles multiple packages', async () => {
    const manifest = createManifest('2.0.0', [
      { name: 'a', file: 'a.deb' },
      { name: 'b', file: 'b.deb' },
    ]);
    await writeManifest(manifest, tmpDir);

    const content = await readFile(join(tmpDir, 'manifest.json'), 'utf-8');
    const parsed = JSON.parse(content);
    assert.equal(parsed.packages.length, 2);
  });
});
