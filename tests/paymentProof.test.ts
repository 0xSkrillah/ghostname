/**
 * Verify the published stealth payment and announcement from chain data.
 *
 * The load-bearing check is the binding one: the announcement must name the
 * same address the payment actually funded. A mismatch there means the
 * announcement is unrelated to the transfer, and must fail.
 */
import { describe, expect, it } from 'vitest';
import { encodeAbiParameters, getAddress, parseEther, type Address, type Hex } from 'viem';
import { verifyPaymentProof, type PaymentProofClient } from '../src/relay/paymentProof';
import {
  ANNOUNCER_ADDRESS,
  buildEthAnnouncementMetadata,
} from '../src/chain/announcer';
import type { PaymentEvidenceRef } from '../src/relay/evidence';

const STEALTH: Address = getAddress('0xe10880b248a2c91b077317a9c92d7a8c49cd9126');
const PAYER: Address = getAddress('0x3c77141e063ad64a6a6c1ef1d16380ebcef3ef98');
const OTHER: Address = getAddress('0xbadbadbadbadbadbadbadbadbadbadbadbadbadb');
const AMOUNT = parseEther('0.0005');
const EPHEMERAL: Hex = '0x02de7a1c1a5b8c9d0e2f3a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

const REF: PaymentEvidenceRef = {
  label: 'test',
  chainId: 11155111,
  paymentTxHash: '0xpay' as Hex,
  announcementTxHash: '0xann' as Hex,
  explorerBase: 'https://sepolia.etherscan.io',
};

const ANNOUNCEMENT_TOPIC: Hex =
  '0x5f0eab8057630ba7676c49b4f21a0231414e79474595be8e4c432fbf6bf0f4e7';

function pad32(addr: Address): Hex {
  return `0x${addr.slice(2).toLowerCase().padStart(64, '0')}` as Hex;
}

function scenario(o: {
  announcedAddress?: Address;
  paidTo?: Address;
  value?: bigint;
  metadataAmount?: bigint;
  schemeId?: bigint;
  ephemeral?: Hex;
  logFrom?: Address;
  payStatus?: 'success' | 'reverted';
  annStatus?: 'success' | 'reverted';
} = {}): PaymentProofClient {
  const announced = o.announcedAddress ?? STEALTH;
  const paidTo = o.paidTo ?? STEALTH;
  const value = o.value ?? AMOUNT;
  const metadata = buildEthAnnouncementMetadata('0x08', o.metadataAmount ?? value);
  const data = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes' }],
    [o.ephemeral ?? EPHEMERAL, metadata],
  );
  return {
    async getTransaction() {
      return { from: PAYER, to: paidTo, value, blockNumber: 11612941n };
    },
    async getTransactionReceipt({ hash }) {
      if (hash === REF.paymentTxHash) {
        return { status: o.payStatus ?? 'success', logs: [] };
      }
      return {
        status: o.annStatus ?? 'success',
        logs: [
          {
            address: o.logFrom ?? ANNOUNCER_ADDRESS,
            topics: [
              ANNOUNCEMENT_TOPIC,
              `0x${(o.schemeId ?? 1n).toString(16).padStart(64, '0')}` as Hex,
              pad32(announced),
              pad32(PAYER),
            ],
            data,
          },
        ],
      };
    },
  };
}

describe('verifyPaymentProof: a genuine payment plus announcement', () => {
  it('passes every check and reports the facts', async () => {
    const proof = await verifyPaymentProof(scenario(), REF);
    const failed = proof.checks.filter((c) => c.state !== 'pass');
    expect(failed).toEqual([]);
    expect(proof.verified).toBe(true);
    expect(proof.facts.stealthAddress).toBe(STEALTH);
    expect(proof.facts.payer).toBe(PAYER);
    expect(proof.facts.amountEth).toBe('0.0005');
    expect(proof.facts.schemeId).toBe('1');
    expect(proof.facts.viewTag).toBe('0x08');
  });

  it('always states that recognition itself is not proven here', async () => {
    const proof = await verifyPaymentProof(scenario(), REF);
    expect(proof.notProven.join(' ')).toMatch(/private viewing key/);
    expect(proof.notProven.join(' ')).toMatch(/Amount privacy/);
    expect(proof.notProven.join(' ')).toMatch(/Sender privacy/);
  });
});

describe('verifyPaymentProof rejects unsound evidence', () => {
  it('FAILS when the announcement names a different address than the payment funded', async () => {
    const proof = await verifyPaymentProof(scenario({ announcedAddress: OTHER }), REF);
    expect(proof.verified).toBe(false);
    const binding = proof.checks.find((c) => c.id === 'binding')!;
    expect(binding.state).toBe('fail');
    expect(binding.detail).toMatch(/but the payment funded/);
  });

  it('fails when the payment reverted', async () => {
    const proof = await verifyPaymentProof(scenario({ payStatus: 'reverted' }), REF);
    expect(proof.checks.find((c) => c.id === 'payment')!.state).toBe('fail');
  });

  it('fails when the announcement reverted', async () => {
    const proof = await verifyPaymentProof(scenario({ annStatus: 'reverted' }), REF);
    expect(proof.checks.find((c) => c.id === 'announcementReceipt')!.state).toBe('fail');
  });

  it('fails when the log did not come from the canonical announcer', async () => {
    const proof = await verifyPaymentProof(scenario({ logFrom: OTHER }), REF);
    expect(proof.checks.find((c) => c.id === 'announcer')!.state).toBe('fail');
  });

  it('fails on a scheme other than 1', async () => {
    const proof = await verifyPaymentProof(scenario({ schemeId: 2n }), REF);
    expect(proof.checks.find((c) => c.id === 'scheme')!.state).toBe('fail');
  });

  it('fails when the ephemeral key is not a compressed point', async () => {
    const proof = await verifyPaymentProof(scenario({ ephemeral: '0x04abcd' as Hex }), REF);
    expect(proof.checks.find((c) => c.id === 'ephemeral')!.state).toBe('fail');
  });

  it('fails when the metadata amount contradicts the transfer', async () => {
    const proof = await verifyPaymentProof(
      scenario({ metadataAmount: parseEther('99') }),
      REF,
    );
    const meta = proof.checks.find((c) => c.id === 'metadata')!;
    expect(meta.state).toBe('fail');
    expect(meta.detail).toMatch(/does not match/);
  });

  it('fails when the payment carried no value', async () => {
    const proof = await verifyPaymentProof(scenario({ value: 0n }), REF);
    expect(proof.checks.find((c) => c.id === 'value')!.state).toBe('fail');
  });

  it('returns unknown, not false confidence, when the RPC fails', async () => {
    const client: PaymentProofClient = {
      async getTransaction() {
        throw new Error('rpc down');
      },
      async getTransactionReceipt() {
        throw new Error('rpc down');
      },
    };
    const proof = await verifyPaymentProof(client, REF);
    expect(proof.verified).toBe(false);
    expect(proof.checks[0]!.state).toBe('unknown');
    expect(proof.error).toMatch(/rpc down/);
  });
});

describe('metadata layout is checked positionally', () => {
  it('fails when the ETH marker appears but not at bytes 5-24', async () => {
    const { ETH_TOKEN_MARKER } = await import('../src/chain/announcer');
    const { concatHex, padHex, numberToHex } = await import('viem');
    // Wrong selector at bytes 1-4 while the marker is still present later on,
    // so a substring search for the marker would still have passed.
    const shifted = concatHex([
      '0x08',
      '0xdeadbeef',
      ETH_TOKEN_MARKER,
      padHex(numberToHex(AMOUNT), { size: 32 }),
    ]);
    const base = scenario({});
    const client: PaymentProofClient = {
      getTransaction: base.getTransaction,
      async getTransactionReceipt(args) {
        const receipt = await base.getTransactionReceipt(args);
        return {
          ...receipt,
          logs: receipt.logs.map((log) => ({
            ...log,
            data: encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes' }], [EPHEMERAL, shifted]),
          })),
        };
      },
    };
    const proof = await verifyPaymentProof(client, REF);
    expect(proof.checks.find((c) => c.id === 'metadata')!.state).toBe('fail');
    expect(proof.checks.find((c) => c.id === 'metadata')!.detail).toMatch(/selector wrong/);
    expect(proof.facts.announcementCaller?.toLowerCase()).toBe(PAYER.toLowerCase());
  });
});
