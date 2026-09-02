/**
 * Verify a published stealth payment and its ERC-5564 announcement from live
 * chain data.
 *
 * The binding that matters is that the announcement names the SAME address the
 * payment actually funded. Without that cross-check, an announcement is just an
 * unrelated log. Everything here is re-derived from the chain; only transaction
 * hashes are configured.
 *
 * What this cannot prove is recognition itself: deciding that a payment belongs
 * to you requires the private viewing key, which never leaves the recipient's
 * device. That property is demonstrated separately and locally, and is listed
 * under "not proven" here rather than implied.
 */
import { decodeEventLog, formatEther, type Address, type Hex } from 'viem';
import {
  ANNOUNCEMENT_EVENT,
  ANNOUNCER_ADDRESS,
  ETH_TOKEN_MARKER,
  viewTagFromMetadata,
} from '../chain/announcer';
import { SCHEME_ID } from '../crypto/metaAddress';
import type { PaymentEvidenceRef } from './evidence';
import type { CheckState, ProofCheck } from './proof';
import { describeError } from '../lib/describeError';

export interface PaymentProof {
  paymentTxHash: Hex;
  announcementTxHash: Hex;
  paymentUrl: string;
  announcementUrl: string;
  verified: boolean;
  checks: ProofCheck[];
  facts: {
    payer: Address | null;
    stealthAddress: Address | null;
    amountEth: string | null;
    announcer: Address | null;
    schemeId: string | null;
    viewTag: Hex | null;
    ephemeralPublicKey: Hex | null;
    blockNumber: string | null;
  };
  notProven: string[];
  error?: string;
}

export interface PaymentProofClient {
  getTransaction(args: { hash: Hex }): Promise<{
    from: Address;
    to: Address | null;
    value: bigint;
    blockNumber: bigint | null;
  }>;
  getTransactionReceipt(args: { hash: Hex }): Promise<{
    status: 'success' | 'reverted';
    logs: ReadonlyArray<{ address: Address; topics: readonly Hex[]; data: Hex }>;
  }>;
}

const NOT_PROVEN = [
  'That any particular person controls the receiving address.',
  'Recognition itself: deciding a payment is yours needs the private viewing key, which stays on the recipient device.',
  'Amount privacy: the transferred value is public on-chain.',
  'Sender privacy: the payer address is public on-chain.',
  'That no offchain party (RPC, indexer) recorded this activity.',
];

export async function verifyPaymentProof(
  client: PaymentProofClient,
  ref: PaymentEvidenceRef,
): Promise<PaymentProof> {
  const checks: ProofCheck[] = [];
  const facts: PaymentProof['facts'] = {
    payer: null,
    stealthAddress: null,
    amountEth: null,
    announcer: null,
    schemeId: null,
    viewTag: null,
    ephemeralPublicKey: null,
    blockNumber: null,
  };
  const paymentUrl = `${ref.explorerBase}/tx/${ref.paymentTxHash}`;
  const announcementUrl = `${ref.explorerBase}/tx/${ref.announcementTxHash}`;
  const add = (id: string, label: string, state: CheckState, detail: string) =>
    checks.push({ id, label, state, detail });

  let payTx, payReceipt, annReceipt;
  try {
    [payTx, payReceipt, annReceipt] = await Promise.all([
      client.getTransaction({ hash: ref.paymentTxHash }),
      client.getTransactionReceipt({ hash: ref.paymentTxHash }),
      client.getTransactionReceipt({ hash: ref.announcementTxHash }),
    ]);
  } catch (err) {
    return {
      paymentTxHash: ref.paymentTxHash,
      announcementTxHash: ref.announcementTxHash,
      paymentUrl,
      announcementUrl,
      verified: false,
      checks: [
        {
          id: 'fetch',
          label: 'Transactions are readable from chain',
          state: 'unknown',
          detail: `Could not read the transactions: ${describeError(err)}`,
        },
      ],
      facts,
      notProven: NOT_PROVEN,
      error: describeError(err),
    };
  }

  facts.payer = payTx.from;
  facts.stealthAddress = payTx.to;
  facts.amountEth = formatEther(payTx.value);
  facts.blockNumber = payTx.blockNumber?.toString() ?? null;

  // 1. The payment landed.
  add(
    'payment',
    'Payment transaction succeeded',
    payReceipt.status === 'success' ? 'pass' : 'fail',
    `Receipt status: ${payReceipt.status}. Transferred ${formatEther(payTx.value)} ETH to ${payTx.to ?? 'unknown'}.`,
  );

  // 2. It carried value to a plain address, which is the one-time destination.
  add(
    'value',
    'Payment carried value to a one-time address',
    payTx.value > 0n && !!payTx.to ? 'pass' : 'fail',
    payTx.value > 0n
      ? `Value ${formatEther(payTx.value)} ETH sent to ${payTx.to}.`
      : 'The payment transaction carried no value.',
  );

  // 3. The announcement succeeded.
  add(
    'announcementReceipt',
    'Announcement transaction succeeded',
    annReceipt.status === 'success' ? 'pass' : 'fail',
    `Receipt status: ${annReceipt.status}.`,
  );

  // 4. It was emitted by the canonical ERC-5564 announcer singleton.
  const annLog = annReceipt.logs.find(
    (log) => log.address.toLowerCase() === ANNOUNCER_ADDRESS.toLowerCase(),
  );
  if (!annLog) {
    add(
      'announcer',
      'Emitted by the canonical ERC-5564 announcer',
      'fail',
      `No log from ${ANNOUNCER_ADDRESS} in the announcement receipt.`,
    );
  } else {
    facts.announcer = annLog.address;
    add(
      'announcer',
      'Emitted by the canonical ERC-5564 announcer',
      'pass',
      `Announcement emitted by the EIP-5564 singleton at ${annLog.address}.`,
    );
  }

  // 5. Decode it: scheme, announced address, ephemeral key and metadata.
  let announcedAddress: Address | null = null;
  if (annLog) {
    try {
      const decoded = decodeEventLog({
        abi: [ANNOUNCEMENT_EVENT],
        data: annLog.data,
        topics: annLog.topics as [Hex, ...Hex[]],
      });
      const args = decoded.args as unknown as {
        schemeId: bigint;
        stealthAddress: Address;
        caller: Address;
        ephemeralPubKey: Hex;
        metadata: Hex;
      };
      announcedAddress = args.stealthAddress;
      facts.schemeId = args.schemeId.toString();
      facts.ephemeralPublicKey = args.ephemeralPubKey;
      facts.viewTag = viewTagFromMetadata(args.metadata);

      add(
        'scheme',
        'Announcement uses ERC-5564 scheme 1',
        args.schemeId === SCHEME_ID ? 'pass' : 'fail',
        `Declared schemeId ${args.schemeId}.`,
      );

      // The ephemeral public key must be a 33-byte compressed SEC1 point, or
      // no sender-side derivation could have produced this destination.
      const ephBytes = (args.ephemeralPubKey.length - 2) / 2;
      const prefixOk = /^0x0[23]/.test(args.ephemeralPubKey);
      add(
        'ephemeral',
        'Announcement carries a compressed ephemeral public key',
        ephBytes === 33 && prefixOk ? 'pass' : 'fail',
        `Ephemeral key is ${ephBytes} bytes, prefix ${args.ephemeralPubKey.slice(0, 4)}.`,
      );

      // Metadata: view tag first, then the native-ETH marker and amount.
      const metaBytes = (args.metadata.length - 2) / 2;
      const markerPresent = args.metadata
        .toLowerCase()
        .includes(ETH_TOKEN_MARKER.slice(2).toLowerCase());
      let amountMatches = false;
      if (metaBytes === 57) {
        try {
          amountMatches = BigInt(`0x${args.metadata.slice(52)}`) === payTx.value;
        } catch {
          amountMatches = false;
        }
      }
      add(
        'metadata',
        'Metadata carries the view tag and matches the transferred amount',
        metaBytes === 57 && markerPresent && amountMatches ? 'pass' : 'fail',
        metaBytes === 57
          ? `View tag ${facts.viewTag}, native-ETH marker ${markerPresent ? 'present' : 'missing'}, declared amount ${amountMatches ? 'matches' : 'does not match'} the transfer.`
          : `Metadata is ${metaBytes} bytes; the native-ETH layout is 57.`,
      );
    } catch (err) {
      add(
        'scheme',
        'Announcement decodes as an ERC-5564 Announcement',
        'fail',
        `Could not decode the log: ${describeError(err)}`,
      );
    }
  }

  // 6. THE binding check: the announcement names the address actually funded.
  if (announcedAddress && payTx.to) {
    const matches = announcedAddress.toLowerCase() === payTx.to.toLowerCase();
    add(
      'binding',
      'Announcement names the address the payment funded',
      matches ? 'pass' : 'fail',
      matches
        ? `Announced ${announcedAddress}, which is exactly the address the payment funded. Without this the announcement would be unrelated to the transfer.`
        : `Announced ${announcedAddress} but the payment funded ${payTx.to}.`,
    );
  } else {
    add(
      'binding',
      'Announcement names the address the payment funded',
      'unknown',
      'The announcement could not be decoded, so the binding could not be checked.',
    );
  }

  const verified = checks.every((c) => c.state === 'pass');
  return {
    paymentTxHash: ref.paymentTxHash,
    announcementTxHash: ref.announcementTxHash,
    paymentUrl,
    announcementUrl,
    verified,
    checks,
    facts,
    notProven: NOT_PROVEN,
  };
}
