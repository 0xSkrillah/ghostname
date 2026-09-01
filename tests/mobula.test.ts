/**
 * P2 — Mobula exposure parser. Uses a mocked fetch with a real demo-endpoint
 * response shape so the panel logic is covered without a network call.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWalletExposure } from '../src/mobula/portfolio';
import type { Address } from 'viem';

const ADDR: Address = '0xf91B3bc63F4144bC72823A3cB264FacDA0fD13CD';

const SAMPLE = {
  data: {
    total_wallet_balance: 172.3784835514127,
    assets: [
      {
        estimated_balance: 172.39,
        cross_chain_balances: { Ethereum: { balance: 0.07 } },
        asset: { name: 'Ethereum', symbol: 'ETH', blockchains: ['Ethereum'] },
      },
      {
        estimated_balance: 0.01,
        cross_chain_balances: { Ethereum: { balance: 1 } },
        asset: { name: 'HEX', symbol: 'HEX', blockchains: ['Ethereum'] },
      },
    ],
  },
};

afterEach(() => vi.restoreAllMocks());

describe('fetchWalletExposure', () => {
  it('parses the demo response into counts, chains, sorted assets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(SAMPLE), { status: 200 })),
    );
    const exposure = await fetchWalletExposure(ADDR);
    expect(exposure.assetCount).toBe(2);
    expect(exposure.chains).toContain('Ethereum');
    expect(exposure.totalUsd).toBeCloseTo(172.378, 2);
    expect(exposure.assets[0]!.symbol).toBe('ETH'); // sorted by value desc
    expect(exposure.source).toBe('demo');
  });

  it('queries the keyless demo endpoint with the wallet address', async () => {
    let calledUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calledUrl = url;
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      }),
    );
    await fetchWalletExposure(ADDR);
    expect(calledUrl).toContain('demo-api.mobula.io');
    expect(calledUrl).toContain(`wallet=${ADDR}`);
  });

  it('throws a friendly error on rate-limit / failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 429 })));
    await expect(fetchWalletExposure(ADDR)).rejects.toThrow(/rate-limited|failed/);
  });

  it('handles an empty portfolio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })),
    );
    const exposure = await fetchWalletExposure(ADDR);
    expect(exposure.assetCount).toBe(0);
    expect(exposure.totalUsd).toBe(0);
  });
});
