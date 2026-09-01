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
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BEE = process.env.BEE_API_URL || 'http://localhost:1633';
const STAMP = process.env.BEE_STAMP;
const DIST = 'dist';

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
const { reference } = await res.json();
console.log('\nDeployed to Swarm ✓');
console.log('reference:', reference);
console.log('bzz://' + reference);
console.log('gateway:  https://' + reference + '.bzz.link/');
console.log('\nTip: point an ENS content-hash record at this reference for a stable name.');
