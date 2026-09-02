/**
 * Load the throwaway TESTNET signing key for operator scripts.
 *
 * Uses Vite's loadEnv exactly like the live test suites, validates the key
 * shape, and exits with a clear message instead of an opaque TypeError. The
 * key is used only to sign locally; it is never printed or sent anywhere.
 */
import { loadEnv } from 'vite';
import { readFileSync, statSync } from 'node:fs';
import { parseIdentityBackup } from '../../src/crypto/identityBackup.ts';

export function loadTestnetKey() {
  const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
  const key = env.SEPOLIA_PRIVATE_KEY;
  if (!key) {
    console.error('SEPOLIA_PRIVATE_KEY is not set. Put a throwaway testnet key in a local .env (never commit it).');
    process.exit(1);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    console.error('SEPOLIA_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string.');
    process.exit(1);
  }
  const rpc = env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  return { key, rpc };
}

/** Refuse a secret file that other local users can read. */
function assertOwnerOnly(path) {
  const mode = statSync(path).mode & 0o777;
  if (mode & 0o077) {
    console.error(`${path} is readable by other users (mode ${mode.toString(8)}). Run: chmod 600 ${path}`);
    process.exit(1);
  }
}

/**
 * Load and VALIDATE the demo receive identity. Keys are checked by shape and
 * range and the meta-address is re-derived, so a corrupted file can never be
 * published to ENS or used to derive an address nobody controls.
 */
export function loadDemoIdentity(path = '.demo/identity.json') {
  assertOwnerOnly(path);
  try {
    return parseIdentityBackup(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`${path} is not a valid GhostName identity: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

/** Load the compiled executor artifact and check its shape before deploying it. */
export function loadExecutorArtifact(path = '.demo/executor.json') {
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.error(`${path} is missing or not JSON. Run: node scripts/compile-executor.mjs`);
    process.exit(1);
  }
  if (!Array.isArray(artifact.abi) || typeof artifact.bytecode !== 'string' || !/^0x[0-9a-fA-F]{200,}$/.test(artifact.bytecode)) {
    console.error(`${path} does not look like a compiled contract artifact (abi array + 0x bytecode).`);
    process.exit(1);
  }
  const hasSweep = artifact.abi.some((f) => f.type === 'function' && f.name === 'sweep');
  if (!hasSweep) {
    console.error(`${path} has no sweep(...) function; refusing to deploy or delegate to it.`);
    process.exit(1);
  }
  return artifact;
}
