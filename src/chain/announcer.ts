/**
 * ERC-5564 announcer integration: emitting announcements for stealth payments
 * and scanning/recognising them with the viewing key.
 *
 * The announcer is the canonical CREATE2 singleton from EIP-5564, deployed at
 * the same address on mainnet and Sepolia. GhostName only ever CALLS it on
 * Sepolia (enforced by assertWritableNetwork); scanning is read-only.
 */
import { concatHex, numberToHex, padHex, type Address, type Hex } from 'viem';
import { checkStealthAddress } from '../crypto/stealth';
import { SCHEME_ID } from '../crypto/metaAddress';

/** EIP-5564 singleton announcer (same address on all chains via CREATE2). */
export const ANNOUNCER_ADDRESS: Address = '0x55649E01B5Df198D18D95b5cc5051630cfD45564';

/** EIP-5564 marker for native-token (ETH) transfers in announcement metadata. */
export const ETH_TOKEN_MARKER: Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const ETH_FUNCTION_SELECTOR = '0xeeeeeeee' as Hex;

export const ANNOUNCER_ABI = [
  {
    name: 'announce',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'schemeId', type: 'uint256' },
      { name: 'stealthAddress', type: 'address' },
      { name: 'ephemeralPubKey', type: 'bytes' },
      { name: 'metadata', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

export const ANNOUNCEMENT_EVENT = {
  name: 'Announcement',
  type: 'event',
  inputs: [
    { name: 'schemeId', type: 'uint256', indexed: true },
    { name: 'stealthAddress', type: 'address', indexed: true },
    { name: 'caller', type: 'address', indexed: true },
    { name: 'ephemeralPubKey', type: 'bytes', indexed: false },
    { name: 'metadata', type: 'bytes', indexed: false },
  ],
} as const;

/**
 * EIP-5564 metadata for a native ETH transfer:
 *   byte 0        view tag
 *   bytes 1-4     0xeeeeeeee (native-token "selector")
 *   bytes 5-24    0xEeee...EEeE marker address
 *   bytes 25-56   amount in wei (uint256)
 */
export function buildEthAnnouncementMetadata(viewTag: Hex, amountWei: bigint): Hex {
  if (!/^0x[0-9a-fA-F]{2}$/.test(viewTag)) {
    throw new Error(`View tag must be a single byte, got ${viewTag}`);
  }
  return concatHex([
    viewTag,
    ETH_FUNCTION_SELECTOR,
    ETH_TOKEN_MARKER,
    padHex(numberToHex(amountWei), { size: 32 }),
  ]);
}

/** Parse the view tag (first metadata byte); null when metadata is empty. */
export function viewTagFromMetadata(metadata: Hex): Hex | null {
  if (!metadata || metadata.length < 4) return null;
  return `0x${metadata.slice(2, 4)}` as Hex;
}

export interface Announcement {
  schemeId: bigint;
  stealthAddress: Address;
  caller: Address;
  ephemeralPublicKey: Hex;
  metadata: Hex;
  viewTag: Hex | null;
  blockNumber: bigint;
  transactionHash: Hex;
}

/** Minimal structural interface satisfied by a viem PublicClient. */
export interface LogReader {
  getLogs(args: {
    address: Address;
    event: typeof ANNOUNCEMENT_EVENT;
    args: { schemeId: bigint };
    fromBlock: bigint;
    toBlock: bigint | 'latest';
  }): Promise<
    Array<{
      args: {
        schemeId?: bigint;
        stealthAddress?: Address;
        caller?: Address;
        ephemeralPubKey?: Hex;
        metadata?: Hex;
      };
      blockNumber: bigint;
      transactionHash: Hex;
    }>
  >;
}

/**
 * Fetch scheme-1 announcements in a constrained block range. Callers must
 * bound the range (demo config records the start block) — never scan from 0.
 */
export async function fetchAnnouncements(
  client: LogReader,
  range: { fromBlock: bigint; toBlock?: bigint | 'latest' },
): Promise<Announcement[]> {
  const logs = await client.getLogs({
    address: ANNOUNCER_ADDRESS,
    event: ANNOUNCEMENT_EVENT,
    args: { schemeId: SCHEME_ID },
    fromBlock: range.fromBlock,
    toBlock: range.toBlock ?? 'latest',
  });
  return logs
    .filter((log) => log.args.stealthAddress && log.args.ephemeralPubKey)
    .map((log) => ({
      schemeId: log.args.schemeId ?? SCHEME_ID,
      stealthAddress: log.args.stealthAddress!,
      caller: log.args.caller ?? '0x0000000000000000000000000000000000000000',
      ephemeralPublicKey: log.args.ephemeralPubKey!,
      metadata: log.args.metadata ?? '0x',
      viewTag: viewTagFromMetadata(log.args.metadata ?? '0x'),
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
    }));
}

/**
 * RECIPIENT: filter announcements down to the ones owned by this viewing key.
 * Uses the view-tag fast path when present, then full verification.
 */
export function recogniseOwnedAnnouncements(
  announcements: Announcement[],
  keys: { viewingPrivateKey: Hex; spendingPublicKey: Hex },
): Announcement[] {
  return announcements.filter((a) =>
    checkStealthAddress({
      stealthAddress: a.stealthAddress,
      ephemeralPublicKey: a.ephemeralPublicKey,
      viewTag: a.viewTag ?? undefined,
      viewingPrivateKey: keys.viewingPrivateKey,
      spendingPublicKey: keys.spendingPublicKey,
    }),
  );
}
