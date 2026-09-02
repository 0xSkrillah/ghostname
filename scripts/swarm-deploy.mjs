/**
 * P3 — deploy the built static app (dist/) to Swarm.
 *
 * Swarm uploads require a running Bee node and a FUNDED postage stamp (xBZZ).
 * At the Common S3nse venue the booth provisions a gateway stamp; otherwise
 * run a Bee light node and buy a stamp (see SWARM.md). This script never
 * provisions funds itself — it uses a node + stamp you already have.
 *
 * Usage:
 *   BEE_API_URL=http://localhost:1633 BEE_STAMP=<batchId> node scripts/swarm-deploy.mjs
 *
 * On success it prints the bzz reference and gateway URLs.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const BEE = process.env.BEE_API_URL || 'http://localhost:1633';
const STAMP = process.env.BEE_STAMP;
// Always the repository's own dist/, regardless of the current directory.
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build at ${DIST}. Run \`npm run build\` first.`);
  process.exit(1);
}
// Refuse a stale bundle: dist must be newer than every tracked source file.
try {
  const newestSource = execSync('git ls-files -z src index.html vite.config.ts package.json', { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map((f) => statSync(join(DIST, '..', f)).mtimeMs)
    .reduce((a, b) => Math.max(a, b), 0);
  if (statSync(join(DIST, 'index.html')).mtimeMs < newestSource && !process.env.ALLOW_STALE_DIST) {
    console.error('dist/ is older than the source tree. Rebuild, or set ALLOW_STALE_DIST=1 to override.');
    process.exit(1);
  }
} catch {
  // Not a git checkout; skip the freshness check.
}
const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
if (!indexHtml.includes('http-equiv="Content-Security-Policy"')) {
  console.error('dist/index.html has no Content-Security-Policy meta tag; this is not a production build.');
  process.exit(1);
}

if (!STAMP) {
  console.error(
    'Set BEE_STAMP to a funded postage batch id. Buy one with:\n' +
      '  swarm-cli stamp buy --depth 17 --amount 100000000\n' +
      'or get a gateway stamp from the Common S3nse booth. See SWARM.md.',
  );
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const contentType = (p) =>
  p.endsWith('.html') ? 'text/html'
  : p.endsWith('.js') ? 'application/javascript'
  : p.endsWith('.css') ? 'text/css'
  : p.endsWith('.json') ? 'application/json'
  : p.endsWith('.svg') ? 'image/svg+xml'
  : 'application/octet-stream';

// Preflight: node reachable + stamp usable.
const health = await fetch(`${BEE}/health`).then((r) => r.ok).catch(() => false);
if (!health) {
  console.error(`No Bee node at ${BEE}. Start one (bee dev or a light node) — see SWARM.md.`);
  process.exit(1);
}

const files = walk(DIST);
console.log(`Uploading ${files.length} files from ${DIST}/ to Swarm via ${BEE} …`);

// Upload as a collection (tar) so the app resolves at a directory reference
// with index.html as the fallback document — required for an SPA.
const boundary = '----ghostname' + Math.random().toString(16).slice(2);
const parts = [];
for (const file of files) {
  const rel = relative(DIST, file).replace(/\\/g, '/');
  const body = readFileSync(file);
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${rel}"\r\n` +
        `Content-Type: ${contentType(rel)}\r\n\r\n`,
    ),
    body,
    Buffer.from('\r\n'),
  );
}
parts.push(Buffer.from(`--${boundary}--\r\n`));
const payload = Buffer.concat(parts);

const res = await fetch(`${BEE}/bzz`, {
  method: 'POST',
  headers: {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'swarm-postage-batch-id': STAMP,
    'swarm-index-document': 'index.html',
    'swarm-error-document': 'index.html',
    'swarm-collection': 'true',
  },
  body: payload,
});
if (!res.ok) {
  console.error(`Upload failed (${res.status}): ${await res.text()}`);
  process.exit(1);
}
if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
  console.error(`Unexpected upload response type: ${res.headers.get('content-type')}`);
  process.exit(1);
}
const { reference } = await res.json();
if (typeof reference !== 'string' || !/^[0-9a-f]{64}$/i.test(reference)) {
  console.error(`Upload returned no valid reference: ${JSON.stringify(reference)}`);
  process.exit(1);
}
// Read back through the same node and require the app shell to be served.
const readBack = await fetch(`${BEE}/bzz/${reference}/`).catch(() => null);
const body = readBack && readBack.ok ? await readBack.text() : '';
if (!body.includes('<div id="root">') || !body.includes('Content-Security-Policy')) {
  console.error(`Read-back of bzz://${reference}/ did not return the GhostName shell; do not publish this reference.`);
  process.exit(1);
}
console.log('\nDeployed to Swarm ✓ (read-back verified)');
console.log('reference:', reference);
console.log('bzz://' + reference);
console.log('gateway:  https://' + reference + '.bzz.link/');
console.log('\nTip: point an ENS content-hash record at this reference for a stable name.');
