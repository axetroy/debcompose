import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

// We need to start the server on a random port for testing
let server;
let baseUrl;

// Dynamically import the server module to start it
before(async () => {
  // Set env for testing
  process.env.DEB_COMPOSE_LOG_LEVEL = 'error';

  const mod = await import('../src/server.js');
  server = mod.startServer(0); // port 0 = random available port

  // Wait for server to be ready and get the actual port
  await new Promise((resolve, reject) => {
    server.on('listening', () => {
      const addr = server.address();
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
    server.on('error', (err) => {
      reject(err);
    });
  });
});

after(() => {
  if (server) {
    server.close();
  }
});

describe('HTTP Server - API endpoints', () => {
  it('GET /api/config/defaults returns env configuration', async () => {
    const res = await fetch(`${baseUrl}/api/config/defaults`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.version);
    assert.ok(data.arch);
    assert.ok(data.maintainer);
  });

  it('GET /api/bundles/status/:buildId returns not_found for unknown builds', async () => {
    const res = await fetch(`${baseUrl}/api/bundles/status/nonexistent`);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.status, 'not_found');
  });

  it('POST /api/bundles/generate returns 400 when missing packages', async () => {
    const res = await fetch(`${baseUrl}/api/bundles/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it('POST /api/bundles/generate returns 400 when missing order', async () => {
    const res = await fetch(`${baseUrl}/api/bundles/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packages: [] }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it('POST /api/bundles/preview returns 400 when upload directory missing', async () => {
    const res = await fetch(`${baseUrl}/api/bundles/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packages: [{ name: 'test.deb', id: 'nonexistent' }],
        order: ['test.deb'],
        config: {},
        sessionId: 'test_session_nonexistent',
      }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it('POST /api/bundles/preview returns preview with valid upload directory', async () => {
    const sessionId = 'test_preview_' + Date.now();
    const uploadDir = path.join('uploads', sessionId);
    await fs.mkdir(uploadDir, { recursive: true });

    // Create a minimal .deb file for testing (just a placeholder)
    const testDebPath = path.join(uploadDir, 'test.deb');
    await fs.writeFile(testDebPath, 'not a real deb file');

    try {
      const res = await fetch(`${baseUrl}/api/bundles/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packages: [{ name: 'test.deb', id: 'test.deb' }],
          order: ['test.deb'],
          config: { version: '2.0.0', arch: 'arm64' },
          sessionId,
        }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.manifest);
      assert.equal(data.manifest.version, '2.0.0');
      assert.ok(Array.isArray(data.structure));
      assert.ok(data.structure.length > 0);
      assert.ok(data.config);
      assert.equal(data.config.arch, 'arm64');
    } finally {
      await fs.rm(uploadDir, { recursive: true, force: true });
    }
  });

  it('POST /api/packages/upload returns 400 when no file provided', async () => {
    const res = await fetch(`${baseUrl}/api/packages/upload`, {
      method: 'POST',
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it('POST /api/packages/upload rejects non-deb files', async () => {
    const formData = new FormData();
    const blob = new Blob(['test content'], { type: 'text/plain' });
    formData.append('package', blob, 'test.txt');

    const res = await fetch(`${baseUrl}/api/packages/upload`, {
      method: 'POST',
      body: formData,
    });
    // multer's fileFilter returns an Error which results in a 500
    assert.ok(res.status >= 400);
  });
});
