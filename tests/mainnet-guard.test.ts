/**
 * Guarded mainnet mode. Proves the double gate: mainnet writes require BOTH
 * the build opt-in (VITE_ENABLE_MAINNET=true) AND an explicit per-action
 * confirmation. Either alone must block. Sepolia is always writable.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Address, Chain, Hash } from 'viem';
import {
  assertWritableNetwork,
  isMainnetWriteEnabled,
  MainnetConfirmationRequiredError,
  WrongNetworkError,
  MAINNET_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
} from '../src/chain/guards';
import { publishStealthRecord } from '../src/ens/write';
import { executeStealthPayment, planStealthPayment } from '../src/chain/payment';
import { generateStealthKeys } from '../src/crypto/stealth';
import { ENS_STEALTH_RECORD_KEY } from '../src/crypto/metaAddress';
import type { EnsReader } from '../src/ens/resolve';

const OWNER: Address = '0x1111111111111111111111111111111111111111';
const RESOLVER: Address = '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD';

afterEach(() => vi.unstubAllEnvs());

describe('assertWritableNetwork — default (mainnet disabled)', () => {
  it('reports mainnet disabled', () => {
    expect(isMainnetWriteEnabled()).toBe(false);
  });
  it('permits Sepolia, blocks mainnet even when confirmed', () => {
    expect(() => assertWritableNetwork(SEPOLIA_CHAIN_ID)).not.toThrow();
    expect(() => assertWritableNetwork(MAINNET_CHAIN_ID, { mainnetConfirmed: true })).toThrow(
      WrongNetworkError,
    );
  });
});

describe('assertWritableNetwork — guarded mainnet mode enabled', () => {
  it('still permits Sepolia with no confirmation', () => {
    vi.stubEnv('VITE_ENABLE_MAINNET', 'true');
    expect(() => assertWritableNetwork(SEPOLIA_CHAIN_ID)).not.toThrow();
  });

  it('blocks mainnet without an explicit confirmation', () => {
    vi.stubEnv('VITE_ENABLE_MAINNET', 'true');
    expect(() => assertWritableNetwork(MAINNET_CHAIN_ID)).toThrow(MainnetConfirmationRequiredError);
    expect(() => assertWritableNetwork(MAINNET_CHAIN_ID, { mainnetConfirmed: false })).toThrow(
      MainnetConfirmationRequiredError,
    );
  });

  it('permits mainnet only with an explicit confirmation', () => {
    vi.stubEnv('VITE_ENABLE_MAINNET', 'true');
    expect(() => assertWritableNetwork(MAINNET_CHAIN_ID, { mainnetConfirmed: true })).not.toThrow();
  });

  it('still blocks other chains regardless of confirmation', () => {
    vi.stubEnv('VITE_ENABLE_MAINNET', 'true');
    for (const id of [undefined, 0, 5, 137, 8453]) {
      expect(() => assertWritableNetwork(id, { mainnetConfirmed: true })).toThrow(WrongNetworkError);
    }
  });
});

describe('write paths honour the mainnet gate', () => {
  const keys = generateStealthKeys();
  const mainnet = { id: MAINNET_CHAIN_ID } as Chain;

  function fakeRegistry() {
    return { async getEnsResolver() { return RESOLVER; } };
  }
  function fakeWallet(chainId: number) {
    const calls: unknown[] = [];
    return {
      calls,
      async getChainId() { return chainId; },
      async writeContract(args: unknown) { calls.push(args); return '0xabc' as Hash; },
      async sendTransaction(args: unknown) { calls.push(args); return '0xpay' as Hash; },
    };
  }

  it('publishStealthRecord: mainnet enabled but unconfirmed → blocked, wallet untouched', async () => {
    vi.stubEnv('VITE_ENABLE_MAINNET', 'true');
    const wallet = fakeWallet(MAINNET_CHAIN_ID);
    await expect(
      publishStealthRecord({
        publicClient: fakeRegistry(),
        walletClient: wallet,
        chain: mainnet,
        account: OWNER,
        name: 'me.eth',
        stealthMetaAddress: keys.stealthMetaAddress,
      }),
    ).rejects.toThrow(MainnetConfirmationRequiredError);
    expect(wallet.calls).toHaveLength(0);
  });

  it('publishStealthRecord: mainnet enabled + confirmed → proceeds', async () => {
    vi.stubEnv('VITE_ENABLE_MAINNET', 'true');
    const wallet = fakeWallet(MAINNET_CHAIN_ID);
    const hash = await publishStealthRecord({
      publicClient: fakeRegistry(),
      walletClient: wallet,
      chain: mainnet,
      account: OWNER,
      name: 'me.eth',
      stealthMetaAddress: keys.stealthMetaAddress,
      mainnetConfirmed: true,
    });
    expect(hash).toBe('0xabc');
    expect(wallet.calls).toHaveLength(1);
  });

  it('publishStealthRecord: mainnet DISABLED + confirmed → still blocked', async () => {
    const wallet = fakeWallet(MAINNET_CHAIN_ID);
    await expect(
      publishStealthRecord({
        publicClient: fakeRegistry(),
        walletClient: wallet,
        chain: mainnet,
        account: OWNER,
        name: 'me.eth',
        stealthMetaAddress: keys.stealthMetaAddress,
        mainnetConfirmed: true,
      }),
    ).rejects.toThrow(WrongNetworkError);
    expect(wallet.calls).toHaveLength(0);
  });

  it('executeStealthPayment: mainnet enabled but unconfirmed → blocked, wallet untouched', async () => {
    vi.stubEnv('VITE_ENABLE_MAINNET', 'true');
    const ensClient: EnsReader = {
      async getEnsAddress() { return null; },
      async getEnsText({ key }) {
        return key === ENS_STEALTH_RECORD_KEY ? keys.stealthMetaAddress : null;
      },
    };
    const wallet = fakeWallet(MAINNET_CHAIN_ID);
    const plan = await planStealthPayment(ensClient, 'ghost.eth', 1n, MAINNET_CHAIN_ID);
    await expect(
      executeStealthPayment({ walletClient: wallet, chain: mainnet, account: OWNER, plan }),
    ).rejects.toThrow(MainnetConfirmationRequiredError);
    expect(wallet.calls).toHaveLength(0);
  });
});
