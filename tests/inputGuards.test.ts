/**
 * Input guards on the write paths: amounts, scan ranges and payment execution.
 * Malformed input must produce an actionable message and must never reach the
 * wallet or request an unbounded log range.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Address, Chain, Hash } from 'viem';
import { parseAmountEth } from '../src/lib/amount';
import {
  MAX_SCAN_BLOCKS,
  SCAN_CHUNK_BLOCKS,
  ScanRangeError,
  fetchAnnouncements,
  resolveScanStart,
  type LogReader,
} from '../src/chain/announcer';
import { executeStealthPayment, planStealthPayment } from '../src/chain/payment';
import { generateStealthKeys } from '../src/crypto/stealth';
import { ENS_STEALTH_RECORD_KEY } from '../src/crypto/metaAddress';
import { SEPOLIA_CHAIN_ID } from '../src/chain/guards';
import type { EnsReader } from '../src/ens/resolve';

describe('parseAmountEth', () => {
  it('accepts ordinary decimal amounts', () => {
    expect(parseAmountEth('0.001')).toEqual({ wei: 1_000_000_000_000_000n, error: null });
    expect(parseAmountEth(' 1 ').wei).toBe(10n ** 18n);
    expect(parseAmountEth('.5').wei).toBe(5n * 10n ** 17n);
  });

  it('rejects empty, zero, negative and non-numeric input with actionable text', () => {
    expect(parseAmountEth('').error).toMatch(/Enter an amount/);
    expect(parseAmountEth('0').error).toMatch(/greater than zero/);
    expect(parseAmountEth('0.0').error).toMatch(/greater than zero/);
    expect(parseAmountEth('-1').error).toMatch(/positive number/);
    expect(parseAmountEth('abc').error).toMatch(/positive number/);
    expect(parseAmountEth('1e3').error).toMatch(/positive number/);
    expect(parseAmountEth('1,5').error).toMatch(/positive number/);
  });
});

describe('resolveScanStart', () => {
  const latest = 12_000_000n;

  it('defaults to latest minus the look-back, never below zero', () => {
    expect(resolveScanStart('', latest, 50_000n)).toBe(11_950_000n);
    expect(resolveScanStart('  ', 10n, 50_000n)).toBe(0n);
  });

  it('accepts a whole number at or below the latest block', () => {
    expect(resolveScanStart('11999000', latest, 50_000n)).toBe(11_999_000n);
    expect(resolveScanStart(String(latest), latest, 50_000n)).toBe(latest);
  });

  it('rejects non-numeric, future and oversized ranges with clear messages', () => {
    expect(() => resolveScanStart('abc', latest, 50_000n)).toThrow(ScanRangeError);
    expect(() => resolveScanStart('abc', latest, 50_000n)).toThrow(/whole number/);
    expect(() => resolveScanStart('-5', latest, 50_000n)).toThrow(/whole number/);
    expect(() => resolveScanStart('12000001', latest, 50_000n)).toThrow(/after the latest block/);
    expect(() => resolveScanStart('0', latest, 50_000n)).toThrow(/too large/);
    expect(() => resolveScanStart(String(latest - MAX_SCAN_BLOCKS - 1n), latest, 50_000n)).toThrow(
      /too large/,
    );
    expect(resolveScanStart(String(latest - MAX_SCAN_BLOCKS), latest, 50_000n)).toBe(
      latest - MAX_SCAN_BLOCKS,
    );
  });
});

describe('fetchAnnouncements range handling', () => {
  function countingReader() {
    const calls: Array<{ fromBlock: bigint; toBlock: bigint | 'latest' }> = [];
    const reader: LogReader = {
      async getLogs(args) {
        calls.push({ fromBlock: args.fromBlock, toBlock: args.toBlock });
        return [];
      },
    };
    return { reader, calls };
  }

  it('splits a numeric range into bounded windows that cover it exactly once', async () => {
    const { reader, calls } = countingReader();
    await fetchAnnouncements(reader, { fromBlock: 100n, toBlock: 100n + 3n * SCAN_CHUNK_BLOCKS + 5n });
    expect(calls).toHaveLength(4);
    expect(calls[0]).toEqual({ fromBlock: 100n, toBlock: 100n + SCAN_CHUNK_BLOCKS - 1n });
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]!.fromBlock).toBe((calls[i - 1]!.toBlock as bigint) + 1n);
    }
    expect(calls[calls.length - 1]!.toBlock).toBe(100n + 3n * SCAN_CHUNK_BLOCKS + 5n);
  });

  it('issues a single request for a small range or an open-ended latest range', async () => {
    const { reader, calls } = countingReader();
    await fetchAnnouncements(reader, { fromBlock: 5n, toBlock: 6n });
    await fetchAnnouncements(reader, { fromBlock: 5n });
    expect(calls).toEqual([
      { fromBlock: 5n, toBlock: 6n },
      { fromBlock: 5n, toBlock: 'latest' },
    ]);
  });

  it('refuses inverted, negative and oversized ranges before any request', async () => {
    const { reader, calls } = countingReader();
    await expect(fetchAnnouncements(reader, { fromBlock: 10n, toBlock: 5n })).rejects.toThrow(ScanRangeError);
    await expect(fetchAnnouncements(reader, { fromBlock: -1n, toBlock: 5n })).rejects.toThrow(ScanRangeError);
    await expect(
      fetchAnnouncements(reader, { fromBlock: 0n, toBlock: MAX_SCAN_BLOCKS + 1n }),
    ).rejects.toThrow(/exceeds the limit/);
    expect(calls).toHaveLength(0);
  });
});

describe('executeStealthPayment amount guard', () => {
  const keys = generateStealthKeys();
  const ensClient: EnsReader = {
    async getEnsAddress() {
      return null;
    },
    async getEnsText({ key }) {
      return key === ENS_STEALTH_RECORD_KEY ? keys.stealthMetaAddress : null;
    },
  };
  function fakeWallet() {
    const calls: unknown[] = [];
    return {
      calls,
      async getChainId() {
        return SEPOLIA_CHAIN_ID;
      },
      async sendTransaction(args: unknown) {
        calls.push(args);
        return '0xpay' as Hash;
      },
      async writeContract(args: unknown) {
        calls.push(args);
        return '0xann' as Hash;
      },
    };
  }

  it('refuses a zero or negative amount before touching the wallet', async () => {
    const wallet = fakeWallet();
    const plan = await planStealthPayment(ensClient, 'ghost.eth', 0n, SEPOLIA_CHAIN_ID);
    await expect(
      executeStealthPayment({
        walletClient: wallet,
        chain: { id: SEPOLIA_CHAIN_ID } as Chain,
        account: '0x1111111111111111111111111111111111111111' as Address,
        plan,
      }),
    ).rejects.toThrow(/greater than zero/);
    await expect(
      executeStealthPayment({
        walletClient: wallet,
        chain: { id: SEPOLIA_CHAIN_ID } as Chain,
        account: '0x1111111111111111111111111111111111111111' as Address,
        plan: { ...plan, amountWei: -1n },
      }),
    ).rejects.toThrow(/greater than zero/);
    expect(wallet.calls).toHaveLength(0);
  });

  it('still sends a positive amount as two transactions', async () => {
    const wallet = fakeWallet();
    const plan = await planStealthPayment(ensClient, 'ghost.eth', 1n, SEPOLIA_CHAIN_ID);
    const result = await executeStealthPayment({
      walletClient: wallet,
      chain: { id: SEPOLIA_CHAIN_ID } as Chain,
      account: '0x1111111111111111111111111111111111111111' as Address,
      plan,
    });
    expect(result.paymentTx).toBe('0xpay');
    expect(wallet.calls).toHaveLength(2);
  });
});

describe('payment plans are bound to their chain and announcement failures are recoverable', () => {
  const keys = generateStealthKeys();
  const ensClient: EnsReader = {
    async getEnsAddress() {
      return null;
    },
    async getEnsText({ key }) {
      return key === ENS_STEALTH_RECORD_KEY ? keys.stealthMetaAddress : null;
    },
  };
  const ACCOUNT = '0x1111111111111111111111111111111111111111' as Address;

  it('refuses to pay a Sepolia-resolved plan through a wallet on another chain', async () => {
    const { PlanChainMismatchError } = await import('../src/chain/payment');
    const plan = await planStealthPayment(ensClient, 'ghost.eth', 1n, SEPOLIA_CHAIN_ID);
    const calls: unknown[] = [];
    const wallet = {
      async getChainId() {
        return SEPOLIA_CHAIN_ID;
      },
      async sendTransaction(args: unknown) {
        calls.push(args);
        return '0xpay' as Hash;
      },
      async writeContract(args: unknown) {
        calls.push(args);
        return '0xann' as Hash;
      },
    };
    // Intended chain differs from the plan's chain (with mainnet writes enabled
    // and confirmed, so the network guard itself passes and the binding is
    // what refuses).
    vi.stubEnv('VITE_ENABLE_MAINNET', 'true');
    try {
      const mainnetWallet = { ...wallet, async getChainId() { return 1; } };
      await expect(
        executeStealthPayment({
          walletClient: mainnetWallet,
          chain: { id: 1 } as Chain,
          account: ACCOUNT,
          plan,
          mainnetConfirmed: true,
        }),
      ).rejects.toThrow(PlanChainMismatchError);
    } finally {
      vi.unstubAllEnvs();
    }
    // Plan and intended chain agree, but the wallet reports a different chain.
    const driftingWallet = { ...wallet, async getChainId() { return 1; } };
    await expect(
      executeStealthPayment({
        walletClient: driftingWallet,
        chain: { id: SEPOLIA_CHAIN_ID } as Chain,
        account: ACCOUNT,
        plan,
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('surfaces the payment hash and recovery data when the announcement fails', async () => {
    const { AnnouncementFailedError, announceStealthPayment } = await import('../src/chain/payment');
    const plan = await planStealthPayment(ensClient, 'ghost.eth', 5n, SEPOLIA_CHAIN_ID);
    let announceAttempts = 0;
    const wallet = {
      async getChainId() {
        return SEPOLIA_CHAIN_ID;
      },
      async sendTransaction() {
        return '0xpaid' as Hash;
      },
      async writeContract() {
        announceAttempts++;
        if (announceAttempts === 1) throw new Error('User rejected the request. URL: https://rpc.example/SECRET');
        return '0xannounced' as Hash;
      },
    };
    let caught: unknown;
    try {
      await executeStealthPayment({ walletClient: wallet, chain: { id: SEPOLIA_CHAIN_ID } as Chain, account: ACCOUNT, plan });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AnnouncementFailedError);
    const failure = caught as InstanceType<typeof AnnouncementFailedError>;
    expect(failure.paymentTx).toBe('0xpaid');
    expect(failure.plan.derivation.ephemeralPublicKey).toBe(plan.derivation.ephemeralPublicKey);
    expect(failure.message).not.toContain('SECRET');
    // The retry path emits only the announcement.
    const announcementTx = await announceStealthPayment({
      walletClient: wallet,
      chain: { id: SEPOLIA_CHAIN_ID } as Chain,
      account: ACCOUNT,
      plan: failure.plan,
    });
    expect(announcementTx).toBe('0xannounced');
    expect(announceAttempts).toBe(2);
  });
});

describe('announcement metadata is parsed positionally and recognition yields', () => {
  it('declaredEthAmount accepts only the native-ETH layout', async () => {
    const { declaredEthAmount, buildEthAnnouncementMetadata, ETH_TOKEN_MARKER } = await import('../src/chain/announcer');
    const { concatHex, padHex, numberToHex } = await import('viem');
    const good = buildEthAnnouncementMetadata('0x08', 1234n);
    expect(declaredEthAmount(good)).toBe(1234n);
    const wrongSelector = concatHex(['0x08', '0xdeadbeef', ETH_TOKEN_MARKER, padHex(numberToHex(1234n), { size: 32 })]);
    expect(declaredEthAmount(wrongSelector)).toBeNull();
    const erc20Marker = concatHex([
      '0x08',
      '0xa9059cbb',
      '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      padHex(numberToHex(1234n), { size: 32 }),
    ]);
    expect(declaredEthAmount(erc20Marker)).toBeNull();
    expect(declaredEthAmount('0x08')).toBeNull();
    expect(declaredEthAmount(`0x08${'00'.repeat(56)}`)).toBeNull();
  });

  it('recogniseOwnedAnnouncementsAsync finds the same set as the sync version and reports progress', async () => {
    const { recogniseOwnedAnnouncements, recogniseOwnedAnnouncementsAsync } = await import('../src/chain/announcer');
    const { generateStealthAddress } = await import('../src/crypto/stealth');
    const mine = generateStealthKeys();
    const other = generateStealthKeys();
    const announcements = Array.from({ length: 45 }, (_, i) => {
      const target = i % 5 === 0 ? mine : other;
      const d = generateStealthAddress(target.stealthMetaAddress);
      return {
        schemeId: 1n,
        stealthAddress: d.stealthAddress,
        caller: '0x0000000000000000000000000000000000000000' as Address,
        ephemeralPublicKey: d.ephemeralPublicKey,
        metadata: '0x' as `0x${string}`,
        viewTag: d.viewTag,
        blockNumber: BigInt(i),
        transactionHash: `0x${i.toString(16).padStart(64, '0')}` as `0x${string}`,
      };
    });
    const keysArg = { viewingPrivateKey: mine.viewingPrivateKey, spendingPublicKey: mine.spendingPublicKey };
    const progress: Array<[number, number]> = [];
    const asyncOwned = await recogniseOwnedAnnouncementsAsync(announcements, keysArg, {
      batchSize: 10,
      onProgress: (c, t) => progress.push([c, t]),
    });
    const syncOwned = recogniseOwnedAnnouncements(announcements, keysArg);
    expect(asyncOwned.map((a) => a.stealthAddress)).toEqual(syncOwned.map((a) => a.stealthAddress));
    expect(asyncOwned).toHaveLength(9);
    expect(progress).toEqual([[10, 45], [20, 45], [30, 45], [40, 45], [45, 45]]);
  });
});

describe('duplicate announcements for one stealth address collapse into one entry', () => {
  it('keeps the first announcement and lists the extra transaction hashes', async () => {
    const { groupAnnouncementsByAddress } = await import('../src/chain/announcer');
    const base = {
      schemeId: 1n,
      caller: '0x0000000000000000000000000000000000000000' as Address,
      ephemeralPublicKey: `0x02${'11'.repeat(32)}` as `0x${string}`,
      metadata: '0x' as `0x${string}`,
      viewTag: '0x11' as `0x${string}`,
    };
    const a1 = { ...base, stealthAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address, blockNumber: 1n, transactionHash: `0x${'01'.repeat(32)}` as `0x${string}` };
    const a2 = { ...base, stealthAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address, blockNumber: 2n, transactionHash: `0x${'02'.repeat(32)}` as `0x${string}` };
    const b1 = { ...base, stealthAddress: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as Address, blockNumber: 3n, transactionHash: `0x${'03'.repeat(32)}` as `0x${string}` };
    const grouped = groupAnnouncementsByAddress([a1, a2, b1, a1]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]!.announcement.transactionHash).toBe(a1.transactionHash);
    expect(grouped[0]!.duplicateTxHashes).toEqual([a2.transactionHash]);
    expect(grouped[1]!.duplicateTxHashes).toEqual([]);
  });
});
