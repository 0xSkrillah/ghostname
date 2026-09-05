/**
 * Mobula exposure parser. Uses a mocked fetch with a real demo-endpoint
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

describe('untrusted Mobula payloads', () => {
  it('coerces malformed numbers and lists instead of producing NaN or crashing', async () => {
    const hostile = {
      data: {
        total_wallet_balance: 'not-a-number',
        assets: [
          { estimated_balance: 'NaN', asset: { name: 42, symbol: null, blockchains: 'Ethereum' } },
          { estimated_balance: -5, asset: { name: 'Neg', symbol: 'NEG', blockchains: ['Ethereum', 7] } },
          'garbage',
          null,
          { estimated_balance: 3, cross_chain_balances: { Polygon: {} } },
        ],
      },
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(hostile), { status: 200 })));
    const exposure = await fetchWalletExposure(ADDR);
    expect(exposure.totalUsd).toBe(0);
    expect(exposure.assetCount).toBe(3);
    for (const a of exposure.assets) {
      expect(Number.isFinite(a.usdValue)).toBe(true);
      expect(a.usdValue).toBeGreaterThanOrEqual(0);
      expect(typeof a.name).toBe('string');
      expect(typeof a.symbol).toBe('string');
      expect(a.chains.every((c) => typeof c === 'string')).toBe(true);
    }
    expect(exposure.assets[0]!.usdValue).toBe(3);
    expect(exposure.chains).toEqual(expect.arrayContaining(['Ethereum', 'Polygon']));
  });

  it('treats non-object and non-JSON responses as errors or empty portfolios', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    expect((await fetchWalletExposure(ADDR)).assetCount).toBe(0);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })));
    await expect(fetchWalletExposure(ADDR)).rejects.toThrow(/not JSON/);
  });

  it('refuses proxy URLs that would carry an API key in the bundle', async () => {
    const { validateProxyUrl } = await import('../src/mobula/portfolio');
    expect(() => validateProxyUrl('https://proxy.example.com/portfolio?api_key=SECRET')).toThrow(/query string/);
    expect(() => validateProxyUrl('https://user:pw@proxy.example.com/portfolio')).toThrow(/credentials/);
    expect(() => validateProxyUrl('http://proxy.example.com/portfolio')).toThrow(/https/);
    expect(() => validateProxyUrl('not a url')).toThrow(/valid URL/);
    expect(validateProxyUrl('https://proxy.example.com/portfolio')).toBe('https://proxy.example.com/portfolio');
  });
});

describe('stalled endpoint and honest chain reporting', () => {
  it('turns a timeout into an actionable retry message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const err = new Error('The operation was aborted due to timeout');
        err.name = 'TimeoutError';
        throw err;
      }),
    );
    await expect(fetchWalletExposure(ADDR)).rejects.toThrow(/did not answer within/);
  });

  it('does not invent a chain when Mobula reports none', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 })));
    const exposure = await fetchWalletExposure(ADDR);
    expect(exposure.chains).toEqual([]);
  });
});
