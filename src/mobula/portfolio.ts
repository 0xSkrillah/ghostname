/**
 * P2 — Mobula public-exposure panel.
 *
 * Demonstrates how much public financial information a STATIC ENS→wallet
 * mapping leaks. Uses Mobula's keyless demo endpoint by default so the panel
 * works with no secret; if a production key is configured it is used via a
 * proxy path (VITE_MOBULA_PROXY_URL) so the key never ships in client code.
 *
 * The panel deliberately surfaces COUNTS and CATEGORIES first and keeps the
 * total balance hidden behind an explicit reveal (projector safety).
 */
import type { Address } from 'viem';

const DEMO_ENDPOINT = 'https://demo-api.mobula.io/api/1/wallet/portfolio';

function env(name: string): string | undefined {
  const value = (import.meta as { env?: Record<string, string | undefined> }).env?.[name];
  return value && value.length > 0 ? value : undefined;
}

export interface ExposureAsset {
  name: string;
  symbol: string;
  chains: string[];
  /** USD value of this holding; only shown after an explicit reveal. */
  usdValue: number;
}

export interface WalletExposure {
  address: Address;
  assetCount: number;
  chains: string[];
  /** Total USD value; caller decides whether/when to display it. */
  totalUsd: number;
  assets: ExposureAsset[];
  source: 'demo' | 'proxy';
}

interface MobulaAsset {
  asset?: { name?: string; symbol?: string; blockchains?: string[] };
  cross_chain_balances?: Record<string, unknown>;
  estimated_balance?: number;
  token_balance?: number;
  price?: number;
}

interface MobulaResponse {
  data?: {
    total_wallet_balance?: number;
    assets?: MobulaAsset[];
  };
}

/**
 * Fetch a wallet's public portfolio exposure. Read-only; queries Mobula's
 * demo endpoint (keyless) or a configured proxy that injects a real key.
 */
export async function fetchWalletExposure(address: Address): Promise<WalletExposure> {
  const proxy = env('VITE_MOBULA_PROXY_URL');
  const source: 'demo' | 'proxy' = proxy ? 'proxy' : 'demo';
  const base = proxy ?? DEMO_ENDPOINT;
  const url = `${base}${base.includes('?') ? '&' : '?'}wallet=${address}&blockchains=ethereum`;

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Mobula request failed (${res.status}). The demo endpoint is rate-limited; try again shortly.`);
  }
  const json = (await res.json()) as MobulaResponse;
  const data = json.data ?? {};
  const rawAssets = data.assets ?? [];

  const assets: ExposureAsset[] = rawAssets.map((a) => ({
    name: a.asset?.name ?? 'Unknown',
    symbol: a.asset?.symbol ?? '?',
    chains: [
      ...new Set(a.asset?.blockchains ?? Object.keys(a.cross_chain_balances ?? {})),
    ],
    usdValue: a.estimated_balance ?? 0,
  }));

  const chains = [...new Set(assets.flatMap((a) => a.chains).filter(Boolean))];

  return {
    address,
    assetCount: assets.length,
    chains: chains.length ? chains : ['Ethereum'],
    totalUsd: data.total_wallet_balance ?? 0,
    assets: assets.sort((a, b) => b.usdValue - a.usdValue),
    source,
  };
}
