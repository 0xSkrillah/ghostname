/**
 * Load the throwaway TESTNET signing key for operator scripts.
 *
 * Uses Vite's loadEnv exactly like the live test suites, validates the key
 * shape, and exits with a clear message instead of an opaque TypeError. The
 * key is used only to sign locally; it is never printed or sent anywhere.
 */
import { loadEnv } from 'vite';

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
