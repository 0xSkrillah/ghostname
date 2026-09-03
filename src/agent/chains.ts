/**
 * Server-configured chain allowlist for the agent layer.
 *
 * Only Ethereum mainnet and Sepolia are reachable, and only through RPC
 * endpoints configured in the server environment. No tool accepts an RPC URL:
 * that would turn a read-only adviser into an SSRF and exfiltration primitive.
 */
import { createPublicClient, fallback, http, type PublicClient } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import type { AuditClient } from '../audit/auditEnsName';
import type { ProofClient } from '../relay/proof';
import type { PaymentProofClient } from '../relay/paymentProof';

export const SUPPORTED_CHAIN_IDS = [1, 11155111] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export interface SupportedChain {
  chainId: SupportedChainId;
  name: string;
  explorerBase: string;
  /** Environment variable holding one or more comma-separated RPC URLs. */
  envVar: string;
  /** Alias shared with the web app's .env so one file configures both. */
  envAlias: string;
  defaultRpcUrls: string[];
  /** Whether the web app can ever write here. Informational only. */
  writesPossible: 'sepolia-default' | 'guarded-opt-in';
}

export const SUPPORTED_CHAINS: Record<SupportedChainId, SupportedChain> = {
  1: {
    chainId: 1,
    name: 'Ethereum mainnet',
    explorerBase: 'https://etherscan.io',
    envVar: 'GHOSTNAME_MAINNET_RPC_URL',
    envAlias: 'VITE_MAINNET_RPC_URL',
    defaultRpcUrls: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
    ],
    writesPossible: 'guarded-opt-in',
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia',
    explorerBase: 'https://sepolia.etherscan.io',
    envVar: 'GHOSTNAME_SEPOLIA_RPC_URL',
    envAlias: 'VITE_SEPOLIA_RPC_URL',
    defaultRpcUrls: [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.drpc.org',
      'https://1rpc.io/sepolia',
    ],
    writesPossible: 'sepolia-default',
  },
};

export class UnsupportedChainError extends Error {
  constructor(chainId: unknown) {
    super(
      `Chain ${String(chainId)} is not supported. Supported chain ids: ${SUPPORTED_CHAIN_IDS.join(', ')}.`,
    );
    this.name = 'UnsupportedChainError';
  }
}

export function isSupportedChainId(value: unknown): value is SupportedChainId {
  return typeof value === 'number' && (SUPPORTED_CHAIN_IDS as readonly number[]).includes(value);
}

export function assertSupportedChainId(value: unknown): SupportedChainId {
  if (!isSupportedChainId(value)) throw new UnsupportedChainError(value);
  return value;
}

export type EnvLike = Record<string, string | undefined>;

export type RpcSource = 'user-configured' | 'built-in-public-default' | 'injected';

/** RPC endpoints for a chain, from the environment or the built-in defaults. */
export function rpcUrlsFor(
  chainId: SupportedChainId,
  env: EnvLike = {},
): { urls: string[]; source: Exclude<RpcSource, 'injected'> } {
  const chain = SUPPORTED_CHAINS[chainId];
  const configured = [env[chain.envVar], env[chain.envAlias]]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .flatMap((v) => v.split(','))
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  if (configured.length > 0) return { urls: [...new Set(configured)], source: 'user-configured' };
  return { urls: chain.defaultRpcUrls, source: 'built-in-public-default' };
}

/**
 * Structural union of every read the agent layer performs. A viem
 * PublicClient satisfies it; tests inject plain objects.
 */
export type AgentChainClient = AuditClient & ProofClient & PaymentProofClient;

/** Read-only client. No account, no wallet, no signing capability exists here. */
export function createReadOnlyClient(chainId: SupportedChainId, env: EnvLike = {}): PublicClient {
  const { urls } = rpcUrlsFor(chainId, env);
  return createPublicClient({
    chain: chainId === 1 ? mainnet : sepolia,
    transport: fallback(urls.map((url) => http(url, { timeout: 10_000 }))),
  });
}

export type ClientFactory = (chainId: SupportedChainId) => AgentChainClient;

/** Default factory: one lazily created read-only client per allowlisted chain. */
export function envClientFactory(env: EnvLike = {}): ClientFactory {
  const cache = new Map<SupportedChainId, PublicClient>();
  return (chainId) => {
    let client = cache.get(chainId);
    if (!client) {
      client = createReadOnlyClient(chainId, env);
      cache.set(chainId, client);
    }
    return client as unknown as AgentChainClient;
  };
}
