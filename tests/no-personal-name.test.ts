/**
 * Release guard: no personal ENS name may ship in source, configuration, tests
 * or the production bundle, and the demo pre-fill must have no built-in
 * default. The forbidden names are held as SHA-256 digests so this test never
 * re-introduces the literal string it exists to keep out.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ROOT = process.cwd();

/** SHA-256 digests of lower-cased names that must never appear anywhere. */
const FORBIDDEN_NAME_DIGESTS = new Set([
  '62bbfd493f99f44bbac4f353e1aba14cd8c3fd8fa13c6660503a49455441d98d',
]);

/**
 * Names permitted inside app source, index.html, .env.example and the
 * production bundle. Everything else is treated as a leaked real identity.
 */
const ALLOWED_IN_APP = new Set([
  'name.eth', // neutral placeholder
  'ghostname-3c7714.eth', // controlled Sepolia demo identity
  'your-name.eth',
  'your-test-name.eth',
  'ghostname-enabled-name.eth',
  'st:eth',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function digest(value: string): string {
  return createHash('sha256').update(value.toLowerCase()).digest('hex');
}

/** Every `<label>.eth` token in a text, lower-cased. */
function ethNames(text: string): string[] {
  return [...text.toLowerCase().matchAll(/\b([a-z0-9-]+\.eth)\b/g)].map((m) => m[1]!);
}

const APP_FILES = [
  ...walk(join(ROOT, 'src')),
  join(ROOT, 'index.html'),
  join(ROOT, '.env.example'),
  ...(existsSync(join(ROOT, 'dist')) ? walk(join(ROOT, 'dist')) : []),
];

const REPO_TEXT_FILES = [
  ...APP_FILES,
  ...walk(join(ROOT, 'tests')).filter((f) => !f.endsWith('no-personal-name.test.ts')),
  ...walk(join(ROOT, 'scripts')),
  ...walk(join(ROOT, 'contracts')),
  ...readdirSync(ROOT)
    .filter((f) => /\.(md|txt)$/i.test(f))
    .map((f) => join(ROOT, f)),
  join(ROOT, 'package.json'),
  join(ROOT, 'vite.config.ts'),
];

describe('no personal ENS name ships', () => {
  it('app source, index.html, .env.example and dist/ contain only neutral or controlled names', () => {
    const offenders: string[] = [];
    for (const file of APP_FILES) {
      const names = ethNames(readFileSync(file, 'utf8'));
      for (const name of names) {
        if (!ALLOWED_IN_APP.has(name)) offenders.push(`${relative(ROOT, file)}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no forbidden name appears in any tracked text file, docs included', () => {
    const offenders: string[] = [];
    for (const file of REPO_TEXT_FILES) {
      const text = readFileSync(file, 'utf8');
      for (const name of new Set(ethNames(text))) {
        if (FORBIDDEN_NAME_DIGESTS.has(digest(name))) offenders.push(relative(ROOT, file));
      }
      // Bare label variant (without .eth), which would also expose the identity.
      for (const token of new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])) {
        if (FORBIDDEN_NAME_DIGESTS.has(digest(`${token}.eth`))) {
          offenders.push(`${relative(ROOT, file)} (bare label)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('.env.example leaves the mainnet demo name empty', () => {
    const env = readFileSync(join(ROOT, '.env.example'), 'utf8');
    expect(env).toMatch(/^VITE_DEMO_MAINNET_NAME=\s*$/m);
  });
});

describe('demo pre-fill has no built-in default', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('DEMO_MAINNET_NAME is empty when VITE_DEMO_MAINNET_NAME is unset', async () => {
    vi.stubEnv('VITE_DEMO_MAINNET_NAME', '');
    vi.resetModules();
    const config = await import('../src/config');
    expect(config.DEMO_MAINNET_NAME).toBe('');
  });

  it('DEMO_MAINNET_NAME honours a locally configured value without validating it', async () => {
    vi.stubEnv('VITE_DEMO_MAINNET_NAME', 'name.eth');
    vi.resetModules();
    const config = await import('../src/config');
    expect(config.DEMO_MAINNET_NAME).toBe('name.eth');
  });
});
