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

  it('throws DebComposeError with path in error details for missing file', async () => {
    const missingPath = join(tmpDir, 'nonexistent.json');
    await assert.rejects(
      () => readManifest(missingPath),
      (err) => {
        assert.ok(err instanceof DebComposeError);
        assert.ok(err.details.path.includes('nonexistent.json'));
        return true;
      }
    );
  });

  it('throws DebComposeError with path in error details for invalid JSON', async () => {
    const filePath = join(tmpDir, 'invalid2.json');
    await writeFile(filePath, 'not { json', 'utf-8');

    await assert.rejects(
      () => readManifest(filePath),
      (err) => {
        assert.ok(err instanceof DebComposeError);
        assert.ok(err.details.path.includes('invalid2.json'));
        return true;
      }
    );
  });

  it('throws DebComposeError with errors array for schema violation', async () => {
    const filePath = join(tmpDir, 'bad-schema2.json');
    await writeFile(filePath, JSON.stringify({ packages: [] }), 'utf-8');

    await assert.rejects(
      () => readManifest(filePath),
      (err) => {
        assert.ok(err instanceof DebComposeError);
        assert.ok(Array.isArray(err.details.errors));
        assert.ok(err.details.errors.length > 0);
        return true;
      }
    );
  });

  it('reads manifest with multiple packages', async () => {
    const manifest = {
      version: '2.0.0',
      packages: [
        { name: 'runtime', file: 'runtime.deb' },
        { name: 'server', file: 'server.deb' },
        { name: 'client', file: 'client.deb' },
      ],
    };
    const filePath = join(tmpDir, 'multi.json');
    await writeFile(filePath, JSON.stringify(manifest), 'utf-8');

    const result = await readManifest(filePath);
    assert.equal(result.version, '2.0.0');
    assert.equal(result.packages.length, 3);
  });

  it('handles manifest with empty whitespace-only file', async () => {
    const filePath = join(tmpDir, 'whitespace.json');
    await writeFile(filePath, '   \n  \t  \n', 'utf-8');

    await assert.rejects(
      () => readManifest(filePath),
      (err) => err instanceof DebComposeError && err.code === 'INVALID_INPUT',
    );
  });
});
