/**
 * Relayer/paymaster sweep — the production answer to the stealth-spending
 * problem.
 *
 * A stealth payment lands on a fresh EOA that holds funds but no gas. Spending
 * from it naively means sending gas to it from your main wallet, which re-links
 * the "private" stealth address to your public identity — defeating the point.
 *
 * The fix is to have someone ELSE pay the gas, authorized by the stealth key:
 *
 *  - Native ETH  → EIP-7702: the stealth EOA signs an authorization delegating
 *    to a batch-executor implementation; a sponsor submits a type-4 tx that
 *    runs the executor to move the ETH out. The sponsor pays gas; the stealth
 *    address never needs gas and is never funded from the recipient's wallet.
 *
 *  - ERC-20 (EIP-3009 tokens like USDC) → the stealth key signs a
 *    `transferWithAuthorization`; any relayer submits it and pays gas,
 *    optionally taking a fee out of the transfer.
 *
 * This module produces and verifies those signatures CLIENT-SIDE from a
 * recovered stealth private key. Submitting them needs a relayer/bundler +
 * an executor contract (real infrastructure with funds) — see RELAYERS.md.
 * The signing here is the part that must stay local, and it is fully tested.
 */
import { privateKeyToAccount } from 'viem/accounts';
import { verifyAuthorization, verifyTypedData } from 'viem/utils';
import type { Address, Hex, SignedAuthorization } from 'viem';

/* ------------------------------------------------------------------ */
/* EIP-7702 sponsored native-ETH sweep                                 */
/* ------------------------------------------------------------------ */

export interface SweepAuthorizationParams {
  /** Recovered stealth private key (from computeStealthPrivateKey). Local only. */
  stealthPrivateKey: Hex;
  chainId: number;
  /**
   * The EIP-7702 delegate the stealth EOA authorizes: a batch-executor /
   * smart-account implementation the sponsor's tx will invoke to move funds.
   */
  executor: Address;
  /** Authorization nonce; a fresh stealth EOA has account nonce 0. */
  nonce?: number;
}

export interface SweepAuthorizationResult {
  stealthAddress: Address;
  authorization: SignedAuthorization;
}

/**
 * Sign an EIP-7702 authorization delegating the stealth EOA to `executor`.
 * The sponsor attaches this to a type-4 transaction and pays the gas.
 */
export async function signSweepAuthorization(
  params: SweepAuthorizationParams,
): Promise<SweepAuthorizationResult> {
  const account = privateKeyToAccount(params.stealthPrivateKey);
  const authorization = await account.signAuthorization({
    chainId: params.chainId,
    address: params.executor,
    nonce: params.nonce ?? 0,
  });
  return { stealthAddress: account.address, authorization };
}

/** True iff `authorization` was signed by `stealthAddress`'s key. */
export function verifySweepAuthorization(
  stealthAddress: Address,
  authorization: SignedAuthorization,
): Promise<boolean> {
  return verifyAuthorization({ address: stealthAddress, authorization });
}

/* ------------------------------------------------------------------ */
/* EIP-3009 relayed ERC-20 sweep (USDC-style tokens)                   */
/* ------------------------------------------------------------------ */

export interface Erc3009SweepParams {
  stealthPrivateKey: Hex;
  /** Token contract implementing EIP-3009 transferWithAuthorization. */
  token: Address;
  /** EIP-712 domain name/version for the token (e.g. "USD Coin" / "2"). */
  tokenName: string;
  tokenVersion: string;
  chainId: number;
  /** Where the funds should end up (a clean address, not your main wallet). */
  to: Address;
  value: bigint;
  /** Valid-from timestamp (seconds); 0 = immediately. */
  validAfter?: bigint;
  /** Valid-until timestamp (seconds). */
  validBefore: bigint;
  /** 32-byte unique nonce (not sequential); random by default. */
  nonce?: Hex;
}

export interface Erc3009SweepResult {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
  signature: Hex;
}

const ERC3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

function randomNonce(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}` as Hex;
}

/**
 * Sign an EIP-3009 `TransferWithAuthorization`. A relayer submits it to the
 * token, pays gas, and (in practice) deducts a fee — the stealth address never
 * needs gas. Returns everything the relayer needs to call the token.
 */
export async function signErc3009Sweep(
  params: Erc3009SweepParams,
): Promise<Erc3009SweepResult> {
  const account = privateKeyToAccount(params.stealthPrivateKey);
  const message = {
    from: account.address,
    to: params.to,
    value: params.value,
    validAfter: params.validAfter ?? 0n,
    validBefore: params.validBefore,
    nonce: params.nonce ?? randomNonce(),
  };
  const signature = await account.signTypedData({
    domain: {
      name: params.tokenName,
      version: params.tokenVersion,
      chainId: params.chainId,
      verifyingContract: params.token,
    },
    types: ERC3009_TYPES,
    primaryType: 'TransferWithAuthorization',
    message,
  });
  return { ...message, signature };
}

/** Verify an EIP-3009 sweep signature recovers to `expectedFrom`. */
export function verifyErc3009Sweep(
  params: Pick<Erc3009SweepParams, 'token' | 'tokenName' | 'tokenVersion' | 'chainId'>,
  result: Erc3009SweepResult,
  expectedFrom: Address,
): Promise<boolean> {
  return verifyTypedData({
    address: expectedFrom,
    domain: {
      name: params.tokenName,
      version: params.tokenVersion,
      chainId: params.chainId,
      verifyingContract: params.token,
    },
    types: ERC3009_TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: result.from,
      to: result.to,
      value: result.value,
      validAfter: result.validAfter,
      validBefore: result.validBefore,
      nonce: result.nonce,
    },
    signature: result.signature,
  });
}
