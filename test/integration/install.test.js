import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildBundle } from '../../src/builder/index.js';

const execFileAsync = promisify(execFile);

const PKG_ALPHA = 'deb-e2e-alpha';
const PKG_BETA = 'deb-e2e-beta';
const BUNDLE_NAME = 'deb-e2e-bundle';
const BUNDLE_VERSION = '2.0.0';
const LOG_FILE = '/var/log/deb-e2e-bundle.log';

async function hasDpkgDeb() {
  try {
    await execFileAsync('dpkg-deb', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function hasSudo() {
  try {
    await execFileAsync('sudo', ['-n', 'true']);
    return true;
  } catch {
    return false;
  }
}

async function createMinimalDeb(outputDir, name, version) {
  const pkgDir = join(outputDir, name);
  const debianDir = join(pkgDir, 'DEBIAN');
  await mkdir(debianDir, { recursive: true });

  const control = `Package: ${name}
Version: ${version}
Architecture: all
Maintainer: Test <test@test.com>
Description: Test package ${name}
`;

  await writeFile(join(debianDir, 'control'), control, 'utf-8');
  await execFileAsync('dpkg-deb', ['-b', pkgDir, join(outputDir, `${name}.deb`)]);
  await rm(pkgDir, { recursive: true, force: true });
}

async function pkgInstalled(name) {
  try {
    await execFileAsync('dpkg', ['--status', name]);
    return true;
  } catch {
    return false;
  }
}

async function waitForPkgInstalled(name, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pkgInstalled(name)) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function waitForPkgRemoved(name, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await pkgInstalled(name))) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function ensureRemoved(name) {
  try {
    await execFileAsync('sudo', ['dpkg', '--purge', name]);
  } catch {
    // already removed
  }
}

async function getPkgVersion(name) {
  const { stdout } = await execFileAsync('dpkg', ['--status', name]);
  const match = stdout.match(/^Version: (.+)$/m);
  if (!match) throw new Error(`Version not found for package ${name}`);
  return match[1];
}

async function getLogContent() {
  try {
    return await readFile(LOG_FILE, 'utf-8');
  } catch {
    return null;
  }
}

async function installBundleAndVerify(path) {
  let stderr = '';
  try {
    const result = await execFileAsync('sudo', ['dpkg', '-i', path]);
    stderr = result.stderr || '';
  } catch (err) {
    const log = await getLogContent();
    const detail = [
      `dpkg exit code: ${err.code}`,
      `dpkg stderr: ${(err.stderr || '').slice(0, 1000)}`,
      log ? `log file:\n${log.slice(0, 2000)}` : 'log file not found',
    ].join('\n');
    throw new Error(`Bundle install failed\n${detail}`);
  }
}

async function extractPostinst(path) {
  const dir = join(tmpdir(), `ctl-extract-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  try {
    await execFileAsync('dpkg-deb', ['-e', path, dir]);
    const content = await readFile(join(dir, 'postinst'), 'utf-8');
    return content;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const hasDpkg = await hasDpkgDeb();
const sudoAvailable = await hasSudo();

describe('install e2e', { skip: (!hasDpkg || !sudoAvailable) ? 'dpkg-deb or sudo not available' : false }, () => {
  let tmpDir;
  let debDir;
  let bundlePath;

  before(async () => {
    tmpDir = join(tmpdir(), `debcompose-e2e-${Date.now()}`);
    debDir = join(tmpDir, 'packages');
    const outDir = join(tmpDir, 'dist');
    await mkdir(debDir, { recursive: true });
    await mkdir(outDir, { recursive: true });

    await createMinimalDeb(debDir, PKG_ALPHA, '1.0.0');
    await createMinimalDeb(debDir, PKG_BETA, '2.0.0');

    const result = await buildBundle({
      debDir,
      outputDir: outDir,
      version: BUNDLE_VERSION,
      package: BUNDLE_NAME,
      architecture: 'all',
      maintainer: 'E2E <e2e@test.com>',
      description: 'E2E test bundle',
    });

    bundlePath = result.outputPath;
  });

  after(async () => {
    await ensureRemoved(PKG_ALPHA);
    await ensureRemoved(PKG_BETA);
    await ensureRemoved(BUNDLE_NAME);

    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('pre-install sanity: bundle contains postinst and correct manifest', async () => {
    assert.ok(bundlePath, 'bundle must have been built in before hook');

    const { stdout: contents } = await execFileAsync('dpkg-deb', ['--contents', bundlePath]);
    assert.ok(contents.includes('opt/deb-e2e-bundle/manifest.json'), 'bundle must contain manifest.json');
    assert.ok(contents.includes('opt/deb-e2e-bundle/deb-e2e-alpha.deb'), 'bundle must contain alpha.deb');
    assert.ok(contents.includes('opt/deb-e2e-bundle/deb-e2e-beta.deb'), 'bundle must contain beta.deb');

    const postinst = await extractPostinst(bundlePath);
    assert.ok(postinst, 'postinst must exist in bundle');
    assert.ok(postinst.includes('/opt/deb-e2e-bundle/'), 'postinst must reference bundle path');
  });

  it('bundle installs sub-packages', async () => {
    assert.equal(await pkgInstalled(PKG_ALPHA), false, 'alpha should not be installed yet');
    assert.equal(await pkgInstalled(PKG_BETA), false, 'beta should not be installed yet');

    await installBundleAndVerify(bundlePath);

    // Sub-packages are installed asynchronously by a background process (to avoid dpkg lock contention)
    assert.ok(await waitForPkgInstalled(PKG_ALPHA), 'alpha should be installed by postinst');
    assert.ok(await waitForPkgInstalled(PKG_BETA), 'beta should be installed by postinst');
  });

  it('bundle removal removes sub-packages', async () => {
    await execFileAsync('sudo', ['dpkg', '-r', BUNDLE_NAME]);

    // Sub-packages are removed asynchronously by a background process
    assert.ok(await waitForPkgRemoved(PKG_ALPHA), 'alpha should be removed by postrm');
    assert.ok(await waitForPkgRemoved(PKG_BETA), 'beta should be removed by postrm');
  });

  it('logs installation events', async () => {
    const logContent = await getLogContent();
    assert.ok(logContent, `log file ${LOG_FILE} should exist`);

    assert.ok(logContent.includes(BUNDLE_VERSION), 'log should contain bundle version');
    assert.ok(logContent.includes(PKG_ALPHA), 'log should contain alpha package name');
    assert.ok(logContent.includes(PKG_BETA), 'log should contain beta package name');
    assert.ok(logContent.includes('installation started'), 'log should mark install start');
    assert.ok(logContent.includes('installation completed'), 'log should mark install end');
    assert.ok(logContent.includes('removal started'), 'log should mark removal start');
    assert.ok(logContent.includes('removal completed'), 'log should mark removal end');
  });

  it('re-installation upgrades sub-packages', async () => {
    debDir = join(tmpDir, 'packages2');
    await mkdir(debDir, { recursive: true });
    await createMinimalDeb(debDir, PKG_ALPHA, '3.0.0');
    await createMinimalDeb(debDir, PKG_BETA, '4.0.0');

    const outDir2 = join(tmpDir, 'dist2');
    await mkdir(outDir2, { recursive: true });

    const result = await buildBundle({
      debDir,
      outputDir: outDir2,
      version: '3.0.0',
      package: BUNDLE_NAME,
      architecture: 'all',
      maintainer: 'E2E <e2e@test.com>',
      description: 'E2E test bundle v2',
    });

    await installBundleAndVerify(result.outputPath);

    assert.ok(await waitForPkgInstalled(PKG_ALPHA), 'alpha should be installed');
    assert.ok(await waitForPkgInstalled(PKG_BETA), 'beta should be installed');

    assert.equal(await getPkgVersion(PKG_ALPHA), '3.0.0', 'alpha should be upgraded to 3.0.0');
    assert.equal(await getPkgVersion(PKG_BETA), '4.0.0', 'beta should be upgraded to 4.0.0');

    await execFileAsync('sudo', ['dpkg', '-r', BUNDLE_NAME]);
    assert.ok(await waitForPkgRemoved(PKG_ALPHA), 'alpha should be removed after upgrade');
    assert.ok(await waitForPkgRemoved(PKG_BETA), 'beta should be removed after upgrade');
  });
});
