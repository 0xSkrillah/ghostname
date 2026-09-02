/**
 * M1 — ENS layer: resolution of conventional + stealth records for arbitrary
 * names, and the Sepolia-only record write path with hard network guards.
 */
import { describe, expect, it } from 'vitest';
import {
  ContractFunctionRevertedError,
  HttpRequestError,
  TimeoutError,
  namehash,
  zeroAddress,
  type Address,
  type Chain,
  type Hash,
} from 'viem';
import { assertWritableNetwork, WrongNetworkError, WRITABLE_CHAIN_ID } from '../src/chain/guards';
import {
  normalizeEnsName,
  resolveConventionalAddress,
  resolveForStealthPayment,
  resolveStealthMetaAddress,
  type EnsReader,
} from '../src/ens/resolve';
import { getResolverAddress, lookupResolver, publishStealthRecord } from '../src/ens/write';
import { ENS_STEALTH_RECORD_KEY } from '../src/crypto/metaAddress';
import { generateStealthKeys, generateStealthAddress, checkStealthAddress } from '../src/crypto/stealth';

const RESOLVER: Address = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';
const OWNER: Address = '0x1111111111111111111111111111111111111111';

function fakeReader(records: Record<string, { address?: Address; text?: Record<string, string> }>): EnsReader {
  return {
    async getEnsAddress({ name }) {
      return records[name]?.address ?? null;
    },
    async getEnsText({ name, key }) {
      return records[name]?.text?.[key] ?? null;
    },
  };
}

describe('network guards', () => {
  it('permits Sepolia only', () => {
    expect(() => assertWritableNetwork(WRITABLE_CHAIN_ID)).not.toThrow();
  });

  it('blocks mainnet by default with an explicit message', () => {
    expect(() => assertWritableNetwork(1)).toThrow(WrongNetworkError);
    expect(() => assertWritableNetwork(1)).toThrow(/disabled in this build/);
  });

  it('blocks every other network and undefined', () => {
    for (const id of [undefined, 0, 5, 10, 137, 8453, 42161]) {
      expect(() => assertWritableNetwork(id)).toThrow(WrongNetworkError);
    }
  });
});

describe('name normalization', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeEnsName('  ExAmPlE-Name.eth ')).toBe('example-name.eth');
  });

  it('rejects invalid names', () => {
    expect(() => normalizeEnsName('not a name..eth')).toThrow();
  });
});

describe('conventional resolution', () => {
  it('resolves an address for an arbitrary name', async () => {
    const reader = fakeReader({ 'alice.eth': { address: OWNER } });
    const result = await resolveConventionalAddress(reader, 'Alice.eth');
    expect(result).toEqual({ name: 'alice.eth', address: OWNER });
  });

  it('returns null for unresolvable names', async () => {
    const reader = fakeReader({});
    const result = await resolveConventionalAddress(reader, 'nobody-here.eth');
    expect(result.address).toBeNull();
  });
});

describe('stealth record resolution', () => {
  const keys = generateStealthKeys();

  it('resolves and parses a valid record', async () => {
    const reader = fakeReader({
      'ghost.eth': { text: { [ENS_STEALTH_RECORD_KEY]: keys.stealthMetaAddress } },
    });
    const result = await resolveStealthMetaAddress(reader, 'ghost.eth');
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.record).toBe(keys.stealthMetaAddress);
    }
  });

  it('reports absent records as none', async () => {
    const result = await resolveStealthMetaAddress(fakeReader({}), 'plain.eth');
    expect(result.status).toBe('none');
  });

  it('reports malformed records as invalid with a reason', async () => {
    const reader = fakeReader({
      'broken.eth': { text: { [ENS_STEALTH_RECORD_KEY]: 'st:eth:0xdeadbeef' } },
    });
    const result = await resolveStealthMetaAddress(reader, 'broken.eth');
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.error).toMatch(/Invalid stealth meta-address/);
    }
  });

  it('payment resolution throws for missing or invalid records (no silent fallback)', async () => {
    await expect(resolveForStealthPayment(fakeReader({}), 'plain.eth')).rejects.toThrow(
      /has not published a stealth meta-address/,
    );
    const broken = fakeReader({
      'broken.eth': { text: { [ENS_STEALTH_RECORD_KEY]: '0x1234' } },
    });
    await expect(resolveForStealthPayment(broken, 'broken.eth')).rejects.toThrow(/malformed/);
  });

  it('END-TO-END over ENS: record → derive → recognise', async () => {
    const reader = fakeReader({
      'ghost.eth': { text: { [ENS_STEALTH_RECORD_KEY]: keys.stealthMetaAddress } },
    });
    const { record } = await resolveForStealthPayment(reader, 'ghost.eth');
    const a = generateStealthAddress(record);
    const b = generateStealthAddress(record);
    expect(a.stealthAddress).not.toBe(b.stealthAddress);
    for (const announcement of [a, b]) {
      expect(
        checkStealthAddress({
          stealthAddress: announcement.stealthAddress,
          ephemeralPublicKey: announcement.ephemeralPublicKey,
          viewTag: announcement.viewTag,
          viewingPrivateKey: keys.viewingPrivateKey,
          spendingPublicKey: keys.spendingPublicKey,
        }),
      ).toBe(true);
    }
  });
});

describe('publishStealthRecord (Sepolia-only write)', () => {
  const keys = generateStealthKeys();

  function fakeRegistry(resolver: Address) {
    return {
      async getEnsResolver() {
        // A name without a resolver answers with the zero address (or a
        // ResolverNotFound revert); a plain transport error is NOT "no resolver".
        return resolver;
      },
    };
  }

  function fakeWallet(chainId: number) {
    const calls: unknown[] = [];
    return {
      calls,
      async getChainId() {
        return chainId;
      },
      async writeContract(args: unknown) {
        calls.push(args);
        return '0xabc' as Hash;
      },
    };
  }

  it('writes setText with the exact RFC record key and verbatim value', async () => {
    const wallet = fakeWallet(WRITABLE_CHAIN_ID);
    const hash = await publishStealthRecord({
      publicClient: fakeRegistry(RESOLVER),
      walletClient: wallet,
      chain: { id: WRITABLE_CHAIN_ID } as Chain,
      account: OWNER,
      name: 'MyTest.eth',
      stealthMetaAddress: keys.stealthMetaAddress,
    });
    expect(hash).toBe('0xabc');
    expect(wallet.calls).toHaveLength(1);
    const call = wallet.calls[0] as {
      address: Address;
      functionName: string;
      args: [string, string, string];
    };
    expect(call.address).toBe(RESOLVER);
    expect(call.functionName).toBe('setText');
    expect(call.args[0]).toBe(namehash('mytest.eth'));
    expect(call.args[1]).toBe('stealth-meta-address[1]');
    expect(call.args[2]).toBe(keys.stealthMetaAddress);
  });

  it('BLOCKS the write when the intended chain is mainnet', async () => {
    const wallet = fakeWallet(WRITABLE_CHAIN_ID);
    await expect(
      publishStealthRecord({
        publicClient: fakeRegistry(RESOLVER),
        walletClient: wallet,
        chain: { id: 1 } as Chain,
        account: OWNER,
        name: 'mytest.eth',
        stealthMetaAddress: keys.stealthMetaAddress,
      }),
    ).rejects.toThrow(WrongNetworkError);
    expect(wallet.calls).toHaveLength(0); // wallet never touched
  });

  it('BLOCKS the write when the wallet reports a non-Sepolia chain', async () => {
    const wallet = fakeWallet(1); // wallet actually on mainnet
    await expect(
      publishStealthRecord({
        publicClient: fakeRegistry(RESOLVER),
        walletClient: wallet,
        chain: { id: WRITABLE_CHAIN_ID } as Chain,
        account: OWNER,
        name: 'mytest.eth',
        stealthMetaAddress: keys.stealthMetaAddress,
      }),
    ).rejects.toThrow(WrongNetworkError);
    expect(wallet.calls).toHaveLength(0);
  });

  it('rejects invalid meta-addresses before any chain interaction', async () => {
    const wallet = fakeWallet(WRITABLE_CHAIN_ID);
    await expect(
      publishStealthRecord({
        publicClient: fakeRegistry(RESOLVER),
        walletClient: wallet,
        chain: { id: WRITABLE_CHAIN_ID } as Chain,
        account: OWNER,
        name: 'mytest.eth',
        stealthMetaAddress: 'st:eth:0xnothex',
      }),
    ).rejects.toThrow(/Invalid stealth meta-address/);
    expect(wallet.calls).toHaveLength(0);
  });

  it('fails clearly when the name has no resolver', async () => {
    const wallet = fakeWallet(WRITABLE_CHAIN_ID);
    await expect(
      publishStealthRecord({
        publicClient: fakeRegistry(zeroAddress),
        walletClient: wallet,
        chain: { id: WRITABLE_CHAIN_ID } as Chain,
        account: OWNER,
        name: 'unconfigured.eth',
        stealthMetaAddress: keys.stealthMetaAddress,
      }),
    ).rejects.toThrow(/no resolver configured/);
  });

  it('discovers the resolver via the universal resolver with the normalized name', async () => {
    let seenName: string | undefined;
    const finder = {
      async getEnsResolver(args: { name: string }) {
        seenName = args.name;
        return RESOLVER;
      },
    };
    const resolved = await getResolverAddress(finder, ' AnyThing.eth ');
    expect(resolved).toBe(RESOLVER);
    expect(seenName).toBe('anything.eth');
  });

  it('returns null when the Universal Resolver reverts or yields the zero address', async () => {
    const reverted = new ContractFunctionRevertedError({
      abi: [],
      functionName: 'findResolver',
      message: 'ResolverNotFound',
    });
    expect(
      await getResolverAddress({ async getEnsResolver() { throw reverted; } }, 'x.eth'),
    ).toBeNull();
    expect(
      await getResolverAddress({ async getEnsResolver() { return zeroAddress; } }, 'x.eth'),
    ).toBeNull();
  });

  it('never reports an RPC failure as "no resolver"', async () => {
    const outage = new HttpRequestError({ url: 'https://rpc.example/v1/SECRETKEY', details: 'ECONNRESET' });
    const lookup = await lookupResolver({ async getEnsResolver() { throw outage; } }, 'x.eth');
    expect(lookup.status).toBe('failed');
    if (lookup.status === 'failed') {
      expect(lookup.error).not.toContain('SECRETKEY');
    }
    const timeout = new TimeoutError({ body: {}, url: 'https://rpc.example/v1/SECRETKEY' });
    expect((await lookupResolver({ async getEnsResolver() { throw timeout; } }, 'x.eth')).status).toBe('failed');
    // Unknown error types are also "failed": honesty over confidence.
    expect((await lookupResolver({ async getEnsResolver() { throw new Error('weird'); } }, 'x.eth')).status).toBe('failed');
    await expect(
      getResolverAddress({ async getEnsResolver() { throw outage; } }, 'x.eth'),
    ).rejects.toThrow(/Could not read the resolver/);
  });

  it('publish refuses to proceed, with a distinct message, when the resolver cannot be read', async () => {
    const wallet = fakeWallet(WRITABLE_CHAIN_ID);
    const outage = new HttpRequestError({ url: 'https://rpc.example/v1/SECRETKEY', details: 'ECONNRESET' });
    await expect(
      publishStealthRecord({
        publicClient: { async getEnsResolver() { throw outage; } },
        walletClient: wallet,
        chain: { id: WRITABLE_CHAIN_ID } as Chain,
        account: OWNER,
        name: 'outage.eth',
        stealthMetaAddress: keys.stealthMetaAddress,
      }),
    ).rejects.toThrow(/Could not read the resolver .* Nothing was sent/);
    expect(wallet.calls).toHaveLength(0);
  });
});
