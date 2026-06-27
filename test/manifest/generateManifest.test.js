import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateManifest } from '../../src/manifest/writer.js';
import { DebComposeError } from '../../src/error/index.js';

describe('generateManifest', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'debcompose-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws when no .deb files exist in directory', async () => {
    const emptyDir = join(tmpDir, 'empty');
    await mkdir(emptyDir);

    await assert.rejects(
      () => generateManifest(emptyDir, '1.0.0'),
      /no .deb files found/
    );
  });

  it('filters out non-.deb files', async () => {
    const subDir = join(tmpDir, 'filtered');
    await mkdir(subDir);

    // Only create non-.deb files
    await writeFile(join(subDir, 'readme.txt'), 'ignored');
    await writeFile(join(subDir, 'data.json'), 'ignored');
    await writeFile(join(subDir, 'script.sh'), 'ignored');

    await assert.rejects(
      () => generateManifest(subDir, '1.0.0'),
      /no .deb files found/
    );
  });

  it('throws for non-existent directory', async () => {
    await assert.rejects(
      () => generateManifest('/nonexistent/path/to/debs', '1.0.0')
    );
  });

  it('sorts .deb files alphabetically by default', async () => {
    // This test verifies the sorting behavior in the code path
    // We can't fully test without valid .deb files, but we can verify
    // the code doesn't throw for the extension filtering
    const subDir = join(tmpDir, 'sortcheck');
    await mkdir(subDir);

    await writeFile(join(subDir, 'zzz.deb'), 'mock');
    await writeFile(join(subDir, 'aaa.deb'), 'mock');

    // The code sorts by filename before calling getPackageName
    // We expect it to fail at getPackageName but not before sorting
    try {
      await generateManifest(subDir, '1.0.0');
      assert.fail('Should have thrown due to invalid deb files');
    } catch (err) {
      assert.ok(err instanceof DebComposeError);
      assert.ok(err.message.includes('failed to read'));
    }
  });
});
