'use strict';
/* Local preview only: serves dist/ on 127.0.0.1:4173. Static files, no listing, no traversal. */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

function createServer(distDir) {
  const root = path.resolve(distDir) + path.sep;
  return http.createServer((req, res) => {
    const notFound = () => { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); };
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let urlPath;
    try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return notFound(); }
    if (urlPath.includes('\0')) return notFound();
    if (urlPath === '/') urlPath = '/index.html';
    const file = path.resolve(root, '.' + urlPath);
    if (!file.startsWith(root)) return notFound();
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return notFound();
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  });
}

if (require.main === module) {
  const dist = path.resolve(__dirname, '..', 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ is empty — run `npm run build` first.'); process.exit(1); }
  createServer(dist).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
}

module.exports = { createServer };
