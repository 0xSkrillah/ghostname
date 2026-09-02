/**
 * Post-build guard: refuse a production bundle that carries anything that
 * looks like a credential or a personal ENS name. Runs as part of `npm run
 * build`, so a keyed RPC URL pinned in .env fails the build instead of
 * shipping to every visitor.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`check-bundle: no build at ${DIST}/`);
  process.exit(1);
}

const FORBIDDEN_NAME_DIGESTS = new Set([
  '62bbfd493f99f44bbac4f353e1aba14cd8c3fd8fa13c6660503a49455441d98d',
]);
const ALLOWED_NAMES = new Set([
  'name.eth',
  'ghostname-3c7714.eth',
  'your-name.eth',
  'your-test-name.eth',
  'ghostname-enabled-name.eth',
]);
/** URL query parameters that carry credentials. */
const KEY_PARAM = /[?&](api[_-]?key|apikey|key|token|secret|auth)=[^&"'\s]+/i;
/** Provider-style key paths: https://host/v2/<long opaque token>. */
const KEY_PATH = /https?:\/\/[^"'\s]+\/v[0-9]\/[A-Za-z0-9_-]{24,}/;
/** 32-byte hex values that are NOT the published evidence hashes below. */
const PUBLIC_HASHES = new Set(
  [
    '0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25',
    '0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b',
    '0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11',
    '0x75b7a6404a5a3b1880f8dce7c874cbf34ce65fca64cffeb7e313567b2759ea29',
    '0x412cca80d621d5d58a38ef190c6a8c323d18adb1be3488f29868d1b4b2efedc0',
  ].map((h) => h.toLowerCase()),
);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const problems = [];
for (const file of walk(DIST)) {
  if (!/\.(js|html|css|json|txt|map)$/.test(file)) continue;
  if (file.endsWith('.map')) problems.push(`${file}: source map shipped`);
  const text = readFileSync(file, 'utf8');
  for (const m of text.toLowerCase().matchAll(/\b([a-z0-9-]+\.eth)\b/g)) {
    const name = m[1];
    if (FORBIDDEN_NAME_DIGESTS.has(createHash('sha256').update(name).digest('hex'))) {
      problems.push(`${file}: forbidden personal ENS name`);
    } else if (!ALLOWED_NAMES.has(name) && !file.endsWith('.css')) {
      problems.push(`${file}: non-allowlisted ENS name ${name}`);
    }
  }
  const keyParam = text.match(KEY_PARAM);
  if (keyParam) problems.push(`${file}: credential-like query parameter ${keyParam[0].slice(0, 40)}…`);
  const keyPath = text.match(KEY_PATH);
  if (keyPath) problems.push(`${file}: provider-key-like URL path ${keyPath[0].slice(0, 60)}…`);
  // Private-key-shaped values can only enter through the app chunk (env
  // inlining, config); vendor chunks legitimately contain curve constants.
  const appChunk = /\/index-[^/]*\.js$/.test(file) || file.endsWith('index.html');
  for (const m of appChunk ? text.matchAll(/0x[0-9a-fA-F]{64}/g) : []) {
    const value = m[0].toLowerCase();
    // Distinguish zero/one-fill constants (ABI padding, coin types) from real 32-byte values.
    if (/^0x(0{64}|f{64}|1{64})$/.test(value)) continue;
    if (!PUBLIC_HASHES.has(value)) problems.push(`${file}: unexpected 32-byte hex value ${value.slice(0, 14)}… (private key? add to PUBLIC_HASHES only if it is public evidence)`);
  }
}
if (problems.length) {
  console.error('check-bundle: refusing this build:');
  for (const p of [...new Set(problems)]) console.error('  - ' + p);
  process.exit(1);
}
console.log(`check-bundle: ${DIST}/ is clean (no personal name, credential pattern, private-key-like value or source map).`);
