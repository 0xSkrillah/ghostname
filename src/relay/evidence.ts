/**
 * Public, configured evidence of the live sponsored exit.
 *
 * Only the transaction hash and the expected executor are configured here.
 * Every displayed claim is re-verified against chain data at runtime by
 * `src/relay/proof.ts`. Nothing about the outcome is asserted in this file, so
 * a stale or wrong hash surfaces as a failed check rather than a false claim.
 */
import type { Address, Hex } from 'viem';
import { SEPOLIA_CHAIN_ID } from '../chain/guards';
import { SWEEP_EXECUTOR } from '../config';

export interface SweepEvidenceRef {
  label: string;
  chainId: number;
  txHash: Hex;
  expectedExecutor: Address;
  explorerBase: string;
}

/** The sponsored EIP-7702 sweep published as GhostName's exit proof. */
export const SPONSORED_SWEEP_EVIDENCE: SweepEvidenceRef = {
  label: 'Sponsored EIP-7702 exit (Sepolia)',
  chainId: SEPOLIA_CHAIN_ID,
  txHash: '0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25',
  expectedExecutor: SWEEP_EXECUTOR as Address,
  explorerBase: 'https://sepolia.etherscan.io',
};
