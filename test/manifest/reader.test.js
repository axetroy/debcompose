import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readManifest } from '../../src/manifest/reader.js';
import { DebComposeError } from '../../src/error/index.js';

describe('readManifest', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'debcompose-test-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('reads a valid manifest file', async () => {
    const manifest = { version: '1.0.0', packages: [{ name: 'pkg', file: 'pkg.deb' }] };
    const filePath = join(tmpDir, 'valid.json');
    await writeFile(filePath, JSON.stringify(manifest), 'utf-8');

    const result = await readManifest(filePath);
    assert.deepEqual(result, manifest);
  });

  it('throws DebComposeError for missing file', async () => {
    const missingPath = join(tmpDir, 'nonexistent.json');
    await assert.rejects(
      () => readManifest(missingPath),
      (err) => err instanceof DebComposeError && err.code === 'MISSING_FILE',
    );
  });

  it('throws DebComposeError for invalid JSON', async () => {
    const filePath = join(tmpDir, 'invalid.json');
    await writeFile(filePath, 'not json', 'utf-8');

    await assert.rejects(
      () => readManifest(filePath),
      (err) => err instanceof DebComposeError && err.code === 'INVALID_INPUT',
    );
  });

  it('throws DebComposeError for schema violation', async () => {
    const filePath = join(tmpDir, 'bad-schema.json');
    await writeFile(filePath, JSON.stringify({ version: '' }), 'utf-8');

    await assert.rejects(
      () => readManifest(filePath),
      (err) => err instanceof DebComposeError && err.code === 'INVALID_INPUT',
    );
  });
});
