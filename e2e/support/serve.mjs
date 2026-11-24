// Tiny static server for the exported web app (single-page app: unknown paths serve index.html).
// Usage: node e2e/support/serve.mjs <dir> <port>
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist-e2e');
const port = Number(process.argv[3] ?? 8090);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

// The production security headers from render.yaml, so tests run under the same rules as the live app.
// The mock backend's address is added to connect-src (the build under test talks to it instead).
const mock = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:5998';
const yaml = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8');
const headers = {};
for (const m of yaml.matchAll(/- path: \/\*\n\s+name: (.+)\n\s+value: (.+)/g)) {
  const name = m[1].trim();
  let value = m[2].trim().replace(/^"|"$/g, '');
  if (name === 'Strict-Transport-Security') continue; // http in tests
  if (name === 'Content-Security-Policy') value = value.replace('connect-src', `connect-src ${mock}`);
  headers[name] = value;
}
if (!headers['Content-Security-Policy']) throw new Error('render.yaml security headers not found');

http
  .createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      return res.end();
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.writeHead(200, { ...headers, 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`serving ${root} on ${port}`));
