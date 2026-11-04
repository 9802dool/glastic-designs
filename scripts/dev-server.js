const http = require('http');
const fs = require('fs');
const path = require('path');
const settings = require('../api/settings');
const adminSettings = require('../api/admin/settings');
const adminAuth = require('../api/admin/auth');
const products = require('../api/products');
const adminProducts = require('../api/admin/products');

const SPA_ROUTES = new Set([
  '/products', '/about', '/gallery', '/process', '/impact', '/contact', '/cart'
]);

const root = path.join(__dirname, '..');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

function readBody(req) {
  return new Promise(function (resolve) {
    const chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { resolve({}); }
    });
  });
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/settings') {
    req.method = 'GET';
    return settings(req, res);
  }
  if (url.pathname === '/api/admin/settings') {
    req.body = await readBody(req);
    return adminSettings(req, res);
  }
  if (url.pathname === '/api/admin/auth') {
    req.body = await readBody(req);
    return adminAuth(req, res);
  }
  if (url.pathname === '/api/products') {
    req.method = 'GET';
    return products(req, res);
  }
  if (url.pathname === '/api/admin/products') {
    req.body = await readBody(req);
    return adminProducts(req, res);
  }
  var pathname = url.pathname;
  var pathKey = pathname.replace(/\/$/, '') || '/';
  if (SPA_ROUTES.has(pathKey) || /^\/category\/[a-z]+$/.test(pathKey)) {
    pathname = 'index.html';
  }
  let filePath = path.join(root, pathname === '/' ? 'index.html' : decodeURIComponent(pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404); return res.end('Not found');
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(3000, '127.0.0.1', function () {
  console.log('Dev server http://127.0.0.1:3000');
});
