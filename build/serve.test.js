'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createServer } = require('./serve');

function get(port, p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET' }, (res) => {
      let body = ''; res.on('data', (c) => (body += c)); res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject); req.end();
  });
}

test('serves files from dist and refuses traversal, listing, and secrets', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vlog-serve-'));
  const dist = path.join(root, 'dist');
  fs.mkdirSync(path.join(dist, 'media'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<p>hi</p>');
  fs.writeFileSync(path.join(root, 'secret.txt'), 'nope');
  const server = createServer(dist);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    assert.equal((await get(port, '/')).status, 200);
    assert.equal((await get(port, '/index.html')).body, '<p>hi</p>');
    assert.equal((await get(port, '/../secret.txt')).status, 404);
    assert.equal((await get(port, '/..%2fsecret.txt')).status, 404);
    assert.equal((await get(port, '/media/')).status, 404);
    assert.equal((await get(port, '/media')).status, 404);
    assert.equal((await get(port, '/missing.css')).status, 404);
  } finally {
    server.close();
  }
});
