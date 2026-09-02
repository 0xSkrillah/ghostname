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
 *
 * The response is third-party JSON and is treated as untrusted: every field is
 * type-checked and coerced before it reaches the UI.
 */
import type { Address } from 'viem';

const DEMO_ENDPOINT = 'https://demo-api.mobula.io/api/1/wallet/portfolio';
/** A stalled endpoint must surface a retry, not an endless spinner. */
export const MOBULA_TIMEOUT_MS = 10_000;

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

/**
 * The proxy must authenticate server-side. A query string on the proxy URL is
 * the classic way an API key ends up in a public bundle, so it is refused.
 */
export function validateProxyUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('VITE_MOBULA_PROXY_URL is not a valid URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('VITE_MOBULA_PROXY_URL must use https.');
  }
  if (parsed.search || parsed.username || parsed.password) {
    throw new Error(
      'VITE_MOBULA_PROXY_URL must not carry a query string or credentials; the proxy has to hold the API key server-side.',
    );
  }
  return `${parsed.origin}${parsed.pathname}`;
}

function finiteNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
}

function text(value: unknown, fallback: string, max = 64): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, max) : fallback;
}

/** Parse an untrusted Mobula portfolio payload into the panel's shape. Exported for tests. */
export function parseExposure(json: unknown, address: Address, source: 'demo' | 'proxy'): WalletExposure {
  const root = json !== null && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const data =
    root['data'] !== null && typeof root['data'] === 'object' ? (root['data'] as Record<string, unknown>) : {};
  const rawAssets = Array.isArray(data['assets']) ? (data['assets'] as unknown[]) : [];

  const assets: ExposureAsset[] = rawAssets
    .filter((a): a is Record<string, unknown> => a !== null && typeof a === 'object')
    .map((a) => {
      const asset =
        a['asset'] !== null && typeof a['asset'] === 'object' ? (a['asset'] as Record<string, unknown>) : {};
      const crossChain =
        a['cross_chain_balances'] !== null && typeof a['cross_chain_balances'] === 'object'
          ? Object.keys(a['cross_chain_balances'] as Record<string, unknown>)
          : [];
      return {
        name: text(asset['name'], 'Unknown'),
        symbol: text(asset['symbol'], '?', 16),
        chains: [...new Set([...stringList(asset['blockchains']), ...crossChain])],
        usdValue: finiteNumber(a['estimated_balance']),
      };
    });

  const chains = [...new Set(assets.flatMap((a) => a.chains))];

  return {
    address,
    assetCount: assets.length,
    // Report only what Mobula reported; never invent a chain count.
    chains,
    totalUsd: finiteNumber(data['total_wallet_balance']),
    assets: assets.sort((a, b) => b.usdValue - a.usdValue),
    source,
  };
}

/**
 * Fetch a wallet's public portfolio exposure. Read-only; queries Mobula's
 * demo endpoint (keyless) or a configured proxy that injects a real key.
 */
export async function fetchWalletExposure(address: Address): Promise<WalletExposure> {
  const proxy = env('VITE_MOBULA_PROXY_URL');
  const source: 'demo' | 'proxy' = proxy ? 'proxy' : 'demo';
  const base = proxy ? validateProxyUrl(proxy) : DEMO_ENDPOINT;
  const url = `${base}?wallet=${address}&blockchains=ethereum`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(MOBULA_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    throw new Error(
      timedOut
        ? `Mobula did not answer within ${MOBULA_TIMEOUT_MS / 1000} seconds; try again shortly.`
        : 'Mobula could not be reached; check your connection and try again.',
    );
  }
  if (!res.ok) {
    throw new Error(`Mobula request failed (${res.status}). The demo endpoint is rate-limited; try again shortly.`);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('Mobula returned a response that is not JSON; try again shortly.');
  }
  return parseExposure(json, address, source);
}
