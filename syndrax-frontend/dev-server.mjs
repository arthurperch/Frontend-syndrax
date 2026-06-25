/**
 * dev-server.mjs — Zero-dependency local dev server for Syndrax site.
 *
 * Replaces `vercel dev` for local development. Uses only Node.js built-ins.
 * Run: node dev-server.mjs
 *
 * Features:
 *   - Serves all site HTML/JS/CSS/assets from this directory
 *   - Proxies /api/* → localhost:3001 (Cloud API)
 *   - Mirrors vercel.json clean-URL rewrites
 *   - Relaxed CSP in dev (allows localhost:3001)
 *   - Colorful startup output
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR      = path.dirname(fileURLToPath(import.meta.url));
const PORT     = Number(process.env.SITE_PORT || process.env.PORT || 3000);
const API_PORT = Number(process.env.API_PORT   || 3001);
const API_HOST = process.env.API_HOST || 'localhost';

// Launcher .ps1 is one level up from the site dir
const LAUNCHER_PATH = path.resolve(DIR, '..', 'SyndraxDevStudio.ps1');

// ── MIME types ─────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
  '.mp4':  'video/mp4',
  '.pdf':  'application/pdf',
  '.txt':  'text/plain',
};

// ── URL → HTML file rewrites (mirrors vercel.json) ────────────────────────────
const REWRITES = [
  [/^\/features(\/.*)?$/,    'features.html'],
  [/^\/pricing(\/.*)?$/,     'pricing.html'],
  [/^\/enterprise(\/.*)?$/,  'enterprise.html'],
  [/^\/about(\/.*)?$/,       'about.html'],
  [/^\/careers(\/.*)?$/,     'careers.html'],
  [/^\/contact(\/.*)?$/,     'contact.html'],
  [/^\/privacy(\/.*)?$/,     'privacy.html'],
  [/^\/terms(\/.*)?$/,       'terms.html'],
  [/^\/signup(\/.*)?$/,      'signup.html'],
  [/^\/login(\/.*)?$/,       'login.html'],
  [/^\/account(\/.*)?$/,     'account.html'],
  [/^\/onboarding(\/.*)?$/,  'onboarding.html'],
  [/^\/app(\/.*)?$/,         'app.html'],   // /app/developer/* all → app.html
  [/^\/$|^\/index(\.html)?$/,'index.html'],
];

// ── Proxy handler ──────────────────────────────────────────────────────────────
function proxyToApi(req, res) {
  const options = {
    hostname: API_HOST,
    port:     API_PORT,
    path:     req.url,
    method:   req.method,
    headers:  { ...req.headers, host: `${API_HOST}:${API_PORT}` },
  };
  const proxy = http.request(options, (pr) => {
    res.writeHead(pr.statusCode, pr.headers);
    pr.pipe(res, { end: true });
  });
  proxy.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'cloud_api_unreachable', detail: `Cannot connect to localhost:${API_PORT}. Is the Cloud API running?` }));
  });
  req.pipe(proxy, { end: true });
}

// ── Static file handler ────────────────────────────────────────────────────────
function serveFile(res, filePath, status = 200) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  let content;
  try {
    content = fs.readFileSync(filePath);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${filePath}`);
    return;
  }
  res.writeHead(status, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
  res.end(content);
}

// ── Main request handler ───────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const rawUrl = req.url.split('?')[0]; // strip query string for routing

  // 1. Proxy all /api/* to Cloud API
  if (rawUrl.startsWith('/api/') || rawUrl === '/api') {
    return proxyToApi(req, res);
  }

  // 1b. Serve the one-click launcher for download
  if (rawUrl === '/SyndraxDevStudio.ps1') {
    if (fs.existsSync(LAUNCHER_PATH)) {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="SyndraxDevStudio.ps1"',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(LAUNCHER_PATH).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Launcher not found at ' + LAUNCHER_PATH);
    }
    return;
  }

  // 2. Try to serve the exact path as a static file first
  const exactPath = path.join(DIR, rawUrl);
  if (rawUrl !== '/' && fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
    return serveFile(res, exactPath);
  }

  // 3. Clean-URL rewrites
  for (const [pattern, htmlFile] of REWRITES) {
    if (pattern.test(rawUrl)) {
      const htmlPath = path.join(DIR, htmlFile);
      if (fs.existsSync(htmlPath)) return serveFile(res, htmlPath);
    }
  }

  // 4. Try appending .html
  const withHtml = exactPath + '.html';
  if (fs.existsSync(withHtml)) return serveFile(res, withHtml);

  // 5. 404
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`<html><body style="font-family:monospace;padding:40px;background:#08090f;color:#f1f5f9">
    <h2 style="color:#f87171">404 — Not Found</h2>
    <p style="color:#94a3b8">${rawUrl}</p>
    <a href="/" style="color:#6366f1">← Home</a>
  </body></html>`);
});

server.listen(PORT, () => {
  const c = { reset:'\x1b[0m', bold:'\x1b[1m', cyan:'\x1b[36m', green:'\x1b[32m', yellow:'\x1b[33m', dim:'\x1b[2m' };
  console.log(`\n${c.bold}${c.cyan}  Syndrax Dev Server${c.reset}`);
  console.log(`${c.dim}  ─────────────────────────────────${c.reset}`);
  console.log(`${c.green}  ✓ Site${c.reset}  → http://localhost:${PORT}`);
  console.log(`${c.yellow}  ⇒ API${c.reset}   → http://localhost:${API_PORT} (proxy)`);
  console.log(`${c.dim}  ─────────────────────────────────${c.reset}`);
  console.log(`  Login → ${c.cyan}http://localhost:${PORT}/login${c.reset}`);
  console.log(`  Dev   → ${c.cyan}http://localhost:${PORT}/app/developer${c.reset}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✖ Port ${PORT} is already in use.`);
    console.error(`  Try: set SITE_PORT=3002 && node dev-server.mjs\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
