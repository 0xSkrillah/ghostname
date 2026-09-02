/**
 * M2 — announcement building, scanning and recognition; payment flow guards.
 */
import { describe, expect, it } from 'vitest';
import { parseEther, type Address, type Chain, type Hash, type Hex } from 'viem';
import {
  ANNOUNCER_ADDRESS,
  buildEthAnnouncementMetadata,
  fetchAnnouncements,
  recogniseOwnedAnnouncements,
  viewTagFromMetadata,
  type Announcement,
  type LogReader,
} from '../src/chain/announcer';
import { executeStealthPayment, planStealthPayment } from '../src/chain/payment';
import { WrongNetworkError, WRITABLE_CHAIN_ID } from '../src/chain/guards';
import { generateStealthAddress, generateStealthKeys } from '../src/crypto/stealth';
import { ENS_STEALTH_RECORD_KEY, SCHEME_ID } from '../src/crypto/metaAddress';
import type { EnsReader } from '../src/ens/resolve';

const SENDER: Address = '0x2222222222222222222222222222222222222222';

describe('announcement metadata (EIP-5564 native ETH layout)', () => {
  it('lays out view tag, selector, marker address and amount', () => {
    const metadata = buildEthAnnouncementMetadata('0xab', parseEther('0.01'));
    expect(metadata.slice(0, 4)).toBe('0xab'); // view tag
    expect(metadata.slice(4, 12)).toBe('eeeeeeee'); // native selector
    expect(metadata.slice(12, 52).toLowerCase()).toBe('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
    expect(metadata.length).toBe(2 + 57 * 2); // 57 bytes total
    expect(BigInt(`0x${metadata.slice(52)}`)).toBe(parseEther('0.01'));
  });

  it('round-trips the view tag', () => {
    const metadata = buildEthAnnouncementMetadata('0x7f', 1n);
    expect(viewTagFromMetadata(metadata)).toBe('0x7f');
    expect(viewTagFromMetadata('0x')).toBeNull();
  });

  it('rejects malformed view tags', () => {
    expect(() => buildEthAnnouncementMetadata('0xabcd' as Hex, 1n)).toThrow(/single byte/);
    expect(() => buildEthAnnouncementMetadata('ab' as Hex, 1n)).toThrow(/single byte/);
  });
});

function announcementFor(
  derivation: ReturnType<typeof generateStealthAddress>,
  amountWei: bigint,
  block = 100n,
): Announcement {
  return {
    schemeId: SCHEME_ID,
    stealthAddress: derivation.stealthAddress,
    caller: SENDER,
    ephemeralPublicKey: derivation.ephemeralPublicKey,
    metadata: buildEthAnnouncementMetadata(derivation.viewTag, amountWei),
    viewTag: derivation.viewTag,
    blockNumber: block,
    transactionHash: '0xdead' as Hash,
  };
}

describe('scanning + recognition', () => {
  it('recipient recognises exactly their own announcements among noise', () => {
    const recipient = generateStealthKeys();
    const bystander = generateStealthKeys();

    const mine1 = announcementFor(generateStealthAddress(recipient.stealthMetaAddress), 1n);
    const mine2 = announcementFor(generateStealthAddress(recipient.stealthMetaAddress), 2n);
    const theirs = announcementFor(generateStealthAddress(bystander.stealthMetaAddress), 3n);

    const owned = recogniseOwnedAnnouncements([mine1, theirs, mine2], {
      viewingPrivateKey: recipient.viewingPrivateKey,
      spendingPublicKey: recipient.spendingPublicKey,
    });
    expect(owned.map((a) => a.stealthAddress)).toEqual([
      mine1.stealthAddress,
      mine2.stealthAddress,
    ]);

    // The unrelated bystander viewing key sees only its own payment.
    const bystanderOwned = recogniseOwnedAnnouncements([mine1, theirs, mine2], {
      viewingPrivateKey: bystander.viewingPrivateKey,
      spendingPublicKey: bystander.spendingPublicKey,
    });
    expect(bystanderOwned.map((a) => a.stealthAddress)).toEqual([theirs.stealthAddress]);
  });

  it('fetchAnnouncements queries the singleton with scheme 1 and maps logs', async () => {
    const recipient = generateStealthKeys();
    const derivation = generateStealthAddress(recipient.stealthMetaAddress);
    let seen: unknown;
    const reader: LogReader = {
      async getLogs(query) {
        seen = query;
        return [
          {
            args: {
              schemeId: SCHEME_ID,
              stealthAddress: derivation.stealthAddress,
              caller: SENDER,
              ephemeralPubKey: derivation.ephemeralPublicKey,
              metadata: buildEthAnnouncementMetadata(derivation.viewTag, 5n),
            },
            blockNumber: 123n,
            transactionHash: '0xbeef' as Hash,
          },
        ];
      },
    };
    const results = await fetchAnnouncements(reader, { fromBlock: 100n });
    expect(seen).toMatchObject({
      address: ANNOUNCER_ADDRESS,
      args: { schemeId: 1n },
      fromBlock: 100n,
      toBlock: 'latest',
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.viewTag).toBe(derivation.viewTag);
    expect(results[0]!.stealthAddress).toBe(derivation.stealthAddress);
  });
});

describe('payment flow', () => {
  const recipient = generateStealthKeys();
  const ensClient: EnsReader = {
    async getEnsAddress() {
      return null;
    },
    async getEnsText({ key }) {
      return key === ENS_STEALTH_RECORD_KEY ? recipient.stealthMetaAddress : null;
    },
  };

  function fakeWallet(chainId: number) {
    const sent: unknown[] = [];
    const written: unknown[] = [];
    return {
      sent,
      written,
      async getChainId() {
        return chainId;
      },
      async sendTransaction(args: unknown) {
        sent.push(args);
        return '0xpay' as Hash;
      },
      async writeContract(args: unknown) {
        written.push(args);
        return '0xann' as Hash;
      },
    };
  }

  it('plans two payments to the same name with different destinations', async () => {
    const a = await planStealthPayment(ensClient, 'ghost.eth', 1n, WRITABLE_CHAIN_ID);
    const b = await planStealthPayment(ensClient, 'ghost.eth', 1n, WRITABLE_CHAIN_ID);
    expect(a.derivation.stealthAddress).not.toBe(b.derivation.stealthAddress);
  });

  it('executes payment + announcement on Sepolia', async () => {
    const wallet = fakeWallet(WRITABLE_CHAIN_ID);
    const plan = await planStealthPayment(ensClient, 'ghost.eth', parseEther('0.001'), WRITABLE_CHAIN_ID);
    const result = await executeStealthPayment({
      walletClient: wallet,
      chain: { id: WRITABLE_CHAIN_ID } as Chain,
      account: SENDER,
      plan,
    });
    expect(result.paymentTx).toBe('0xpay');
    expect(result.announcementTx).toBe('0xann');
    expect(wallet.sent).toHaveLength(1);
    expect(wallet.sent[0]).toMatchObject({
      to: plan.derivation.stealthAddress,
      value: parseEther('0.001'),
    });
    expect(wallet.written[0]).toMatchObject({
      address: ANNOUNCER_ADDRESS,
      functionName: 'announce',
    });
    const announceArgs = (wallet.written[0] as { args: readonly unknown[] }).args;
    expect(announceArgs[0]).toBe(SCHEME_ID);
    expect(announceArgs[1]).toBe(plan.derivation.stealthAddress);
    expect(announceArgs[2]).toBe(plan.derivation.ephemeralPublicKey);
  });

  it('BLOCKS payment when intended chain is mainnet — wallet never touched', async () => {
    const wallet = fakeWallet(WRITABLE_CHAIN_ID);
    const plan = await planStealthPayment(ensClient, 'ghost.eth', 1n, WRITABLE_CHAIN_ID);
    await expect(
      executeStealthPayment({
        walletClient: wallet,
        chain: { id: 1 } as Chain,
        account: SENDER,
        plan,
      }),
    ).rejects.toThrow(WrongNetworkError);
    expect(wallet.sent).toHaveLength(0);
    expect(wallet.written).toHaveLength(0);
  });

  it('BLOCKS payment when the wallet reports mainnet', async () => {
    const wallet = fakeWallet(1);
    const plan = await planStealthPayment(ensClient, 'ghost.eth', 1n, WRITABLE_CHAIN_ID);
    await expect(
      executeStealthPayment({
        walletClient: wallet,
        chain: { id: WRITABLE_CHAIN_ID } as Chain,
        account: SENDER,
        plan,
      }),
    ).rejects.toThrow(WrongNetworkError);
    expect(wallet.sent).toHaveLength(0);
  });

  it('END-TO-END (offline): plan → pay → announce → scan → recognise → recover', async () => {
    const wallet = fakeWallet(WRITABLE_CHAIN_ID);
    const plan = await planStealthPayment(ensClient, 'ghost.eth', 42n, WRITABLE_CHAIN_ID);
    await executeStealthPayment({
      walletClient: wallet,
      chain: { id: WRITABLE_CHAIN_ID } as Chain,
      account: SENDER,
      plan,
    });
    // Reconstruct the announcement as it would appear on-chain.
    const written = wallet.written[0] as {
      args: readonly [bigint, Address, Hex, Hex];
    };
    const onchain: Announcement = {
      schemeId: written.args[0],
      stealthAddress: written.args[1],
      caller: SENDER,
      ephemeralPublicKey: written.args[2],
      metadata: written.args[3],
      viewTag: viewTagFromMetadata(written.args[3]),
      blockNumber: 1n,
      transactionHash: '0xdead' as Hash,
    };
    const owned = recogniseOwnedAnnouncements([onchain], {
      viewingPrivateKey: recipient.viewingPrivateKey,
      spendingPublicKey: recipient.spendingPublicKey,
    });
    expect(owned).toHaveLength(1);

    const { computeStealthPrivateKey, privateKeyToAddress } = await import(
      '../src/crypto/stealth'
    );
    const stealthKey = computeStealthPrivateKey({
      spendingPrivateKey: recipient.spendingPrivateKey,
      viewingPrivateKey: recipient.viewingPrivateKey,
      ephemeralPublicKey: onchain.ephemeralPublicKey,
    });
    expect(privateKeyToAddress(stealthKey)).toBe(onchain.stealthAddress);
  });
});
