const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 4200);
const backend = process.env.BACKEND_URL || 'http://localhost:8080';
const distDir = path.join(__dirname, 'dist', 'Front-end-Steam', 'browser');
const fallbackIndex = path.join(distDir, 'index.html');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function proxyApi(req, res) {
  const target = new URL(req.url, backend);
  const proxyReq = http.request(
    target,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host
      }
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'No se pudo conectar con el backend.' }));
  });

  req.pipe(proxyReq);
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    proxyApi(req, res);
    return;
  }

  const requestPath = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
  const normalizedPath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(distDir, normalizedPath === '/' ? 'index.html' : normalizedPath);

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      serveFile(filePath, res);
      return;
    }

    serveFile(fallbackIndex, res);
  });
});

server.listen(port, () => {
  console.log(`Front-end-Steam listo en http://localhost:${port}`);
  console.log(`Proxy API activo hacia ${backend}`);
});
