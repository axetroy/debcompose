import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import assert from 'node:assert';
import { generateMd5sums, calculateInstalledSize } from '../../src/builder/utils.js';
import test from 'node:test';

test('calculateInstalledSize should return 0 for empty directory', async () => {
  const tempDir = join(process.env.TMPDIR || process.env.TEMP || process.env.USERPROFILE || '/tmp', `debcompose-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    const size = await calculateInstalledSize(tempDir);
    assert.strictEqual(size, 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('generateMd5sums should generate correct md5sums for files', async () => {
  const tempDir = join(process.env.TMPDIR || process.env.TEMP || process.env.USERPROFILE || '/tmp', `debcompose-test-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    await writeFile(join(tempDir, 'file.txt'), 'hello');
    const md5sums = await generateMd5sums(tempDir);
    const lines = md5sums.split('\n').filter(line => line.length > 0);

    assert.equal(lines.length, 1);
    assert.ok(md5sums.includes('file.txt'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});