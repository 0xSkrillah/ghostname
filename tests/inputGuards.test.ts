/**
 * Input guards on the write paths: amounts, scan ranges and payment execution.
 * Malformed input must produce an actionable message and must never reach the
 * wallet or request an unbounded log range.
 */
import { describe, expect, it } from 'vitest';
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
    const plan = await planStealthPayment(ensClient, 'ghost.eth', 0n);
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
    const plan = await planStealthPayment(ensClient, 'ghost.eth', 1n);
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
