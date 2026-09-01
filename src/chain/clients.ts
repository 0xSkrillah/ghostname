/**
 * viem public clients. Mainnet is READ-ONLY in this application: no wallet
 * client is ever created for mainnet and no write path accepts it.
 */
import { createPublicClient, fallback, http, type PublicClient } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

function env(name: string): string | undefined {
  const value = (import.meta as { env?: Record<string, string | undefined> }).env?.[name];
  return value && value.length > 0 ? value : undefined;
}

function transports(primaryVar: string, fallbackVar: string, defaultUrls: string[]) {
  const primary = env(primaryVar);
  const extra = env(fallbackVar)?.split(',').map((u) => u.trim()).filter(Boolean) ?? [];
  // User-configured endpoints first, then the built-in defaults as fallbacks.
  const urls = [...new Set([...(primary ? [primary] : []), ...extra, ...defaultUrls])];
  return fallback(urls.map((url) => http(url, { timeout: 10_000 })));
}

const MAINNET_DEFAULT_RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
  'https://1rpc.io/eth',
];

const SEPOLIA_DEFAULT_RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://1rpc.io/sepolia',
];

let mainnetSingleton: PublicClient | undefined;
let sepoliaSingleton: PublicClient | undefined;

/** Read-only mainnet client (ENS resolution for established names). */
export function getMainnetClient(): PublicClient {
  mainnetSingleton ??= createPublicClient({
    chain: mainnet,
    transport: transports('VITE_MAINNET_RPC_URL', 'VITE_MAINNET_RPC_FALLBACKS', MAINNET_DEFAULT_RPCS),
  });
  return mainnetSingleton;
}

/** Sepolia client — the only network where GhostName ever writes. */
export function getSepoliaClient(): PublicClient {
  sepoliaSingleton ??= createPublicClient({
    chain: sepolia,
    transport: transports('VITE_SEPOLIA_RPC_URL', 'VITE_SEPOLIA_RPC_FALLBACKS', SEPOLIA_DEFAULT_RPCS),
  });
  return sepoliaSingleton;
}
