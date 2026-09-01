/**
 * Stealth record keys and precedence, per the current ENS stealth-resolution
 * RFC plus ENSIP-11 coin-type semantics.
 *
 * Status of each rule is labelled at the point of use:
 *  - the `stealth-meta-address[<schemeId>]` default key and the
 *    `stealth-meta-address[<schemeId>][<coinType>]` chain-specific key are the
 *    CURRENT PROPOSAL in an evolving RFC, not a ratified requirement;
 *  - `coinType = 0x80000000 | chainId` is the existing ENSIP-11 requirement;
 *  - ERC-6538 registry lookups are EXPERIMENTAL DIAGNOSTICS here and never
 *    override the record convention.
 */
import { SCHEME_ID } from '../crypto/metaAddress';

/** ENSIP-11: bitwise-OR the chain id with 0x80000000. */
export function evmCoinType(chainId: number): number {
  return (0x80000000 | chainId) >>> 0;
}

/**
 * SLIP-44 / ENSIP-9 legacy coin type for Ethereum. ENSIP-11 does not
 * special-case mainnet, but real-world mainnet records commonly use 60, so it
 * is probed as a labelled legacy diagnostic rather than a normative key.
 */
export const LEGACY_ETH_COIN_TYPE = 60;

/** Default, all-chain record key. Current RFC proposal. */
export function defaultRecordKey(schemeId: bigint = SCHEME_ID): string {
  return `stealth-meta-address[${schemeId}]`;
}

/** Chain-specific record key using the ENSIP-11 coin type. Current RFC proposal. */
export function chainSpecificRecordKey(coinType: number, schemeId: bigint = SCHEME_ID): string {
  return `stealth-meta-address[${schemeId}][${coinType}]`;
}

export interface RecordKeyPlan {
  key: string;
  kind: 'default' | 'chain-specific';
  coinType?: number;
  normative: boolean;
}

/**
 * The keys to query for a chain, in PRECEDENCE ORDER: chain-specific first,
 * then the all-chain default as fallback. On mainnet the legacy coinType 60
 * key is appended as a non-normative diagnostic only, so it can never take
 * precedence over the current convention.
 */
export function recordKeyPlan(chainId: number, schemeId: bigint = SCHEME_ID): RecordKeyPlan[] {
  const plan: RecordKeyPlan[] = [
    {
      key: chainSpecificRecordKey(evmCoinType(chainId), schemeId),
      kind: 'chain-specific',
      coinType: evmCoinType(chainId),
      normative: true,
    },
    { key: defaultRecordKey(schemeId), kind: 'default', normative: true },
  ];
  if (chainId === 1) {
    plan.push({
      key: chainSpecificRecordKey(LEGACY_ETH_COIN_TYPE, schemeId),
      kind: 'chain-specific',
      coinType: LEGACY_ETH_COIN_TYPE,
      normative: false,
    });
  }
  return plan;
}

/**
 * Apply precedence over already-fetched sources: the first NORMATIVE source
 * that is present and valid wins, in plan order. A non-normative diagnostic
 * never wins, so a legacy record cannot silently downgrade the result.
 */
export function selectByPrecedence<T extends { status: string; normative: boolean }>(
  sources: T[],
): T | null {
  return sources.find((s) => s.normative && s.status === 'present-valid') ?? null;
}
