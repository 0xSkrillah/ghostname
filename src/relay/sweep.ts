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
import { decodeFunctionData, encodeFunctionData, isAddress, parseSignature } from 'viem';
import { secp256k1 } from '@noble/curves/secp256k1';
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
  /** EIP-7702 account nonce of the stealth EOA. Read it from chain; never assume 0. */
  nonce: number;
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
    nonce: params.nonce,
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
/* Complete, destination-bound native sweep package                     */
/* ------------------------------------------------------------------ */

/**
 * A sweep needs TWO independent signatures, and shipping only the first one is
 * both non-executable and misleading:
 *
 *  1. the EIP-7702 delegation authorization, which binds only
 *     (chainId, executor, accountNonce) and says nothing about where funds go;
 *  2. the executor's EIP-712 `Sweep` intent, which is what actually binds
 *     destination, amount, sweep nonce and deadline.
 *
 * `signNativeSweepPackage` produces both plus the encoded calldata, so a
 * relayer has everything required and every displayed field is cryptographically
 * bound. `verifyNativeSweepPackage` re-checks all of it, so a package can be
 * audited independently of whoever produced it.
 *
 * The two nonces are deliberately kept separate and separately named:
 * `authorizationNonce` is the EOA's account nonce (EIP-7702 requires it to equal
 * the account nonce at processing time); `sweepNonce` is the executor's internal
 * replay guard.
 */

export const SWEEP_PACKAGE_SCHEMA = 'ghostname-native-sweep-package';
export const SWEEP_PACKAGE_VERSION = 1;

/** EIP-712 domain of StealthSweepExecutor. */
export const SWEEP_DOMAIN_NAME = 'GhostNameSweep';
export const SWEEP_DOMAIN_VERSION = '1';

export const SWEEP_TYPES = {
  Sweep: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

/** Minimal ABI of the executor entry point the sponsor calls. */
export const EXECUTOR_SWEEP_ABI = [
  {
    name: 'sweep',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

export interface NativeSweepPackageParams {
  /** Recovered stealth private key. Used locally for signing only. */
  stealthPrivateKey: Hex;
  /** Optional expected address; mismatch with the key is rejected. */
  stealthAddress?: Address;
  chainId: number;
  executor: Address;
  destination: Address;
  amount: bigint;
  /** EIP-7702 account nonce of the stealth EOA. Read it; do not assume 0. */
  authorizationNonce: number;
  /** Executor replay-guard nonce. Unrelated to the account nonce. */
  sweepNonce: bigint;
  /** Unix seconds after which the executor rejects the sweep. */
  deadline: bigint;
}

/**
 * The complete relayer hand-off. Uint256 values are decimal strings so the
 * package survives JSON round-trips without BigInt loss. Contains no secrets.
 */
export interface NativeSweepPackage {
  schema: typeof SWEEP_PACKAGE_SCHEMA;
  version: number;
  chainId: number;
  executor: Address;
  /** The EOA being swept; also the EIP-712 `verifyingContract` under 7702. */
  stealthAddress: Address;
  destination: Address;
  amount: string;
  sweepNonce: string;
  deadline: string;
  authorizationNonce: number;
  /** EIP-7702 delegation: binds chain + executor + account nonce only. */
  authorization: {
    chainId: number;
    address: Address;
    nonce: number;
    r: Hex;
    s: Hex;
    yParity: number;
  };
  /** EIP-712 intent: binds destination, amount, sweep nonce and deadline. */
  sweepSignature: Hex;
  /** `sweep(...)` calldata the sponsor sends to the stealth address. */
  calldata: Hex;
}

function assertAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`${label} is not a valid address: ${value}`);
  return value as Address;
}

/** Build both signatures plus calldata for a sponsored native-ETH sweep. */
export async function signNativeSweepPackage(
  params: NativeSweepPackageParams,
): Promise<NativeSweepPackage> {
  const executor = assertAddress(params.executor, 'executor');
  const destination = assertAddress(params.destination, 'destination');
  if (params.amount <= 0n) throw new Error('amount must be greater than zero');
  if (params.sweepNonce < 0n) throw new Error('sweepNonce must not be negative');
  if (params.deadline <= 0n) throw new Error('deadline must be a unix timestamp');
  if (!Number.isInteger(params.authorizationNonce) || params.authorizationNonce < 0) {
    throw new Error('authorizationNonce must be a non-negative integer');
  }

  const account = privateKeyToAccount(params.stealthPrivateKey);
  if (
    params.stealthAddress &&
    params.stealthAddress.toLowerCase() !== account.address.toLowerCase()
  ) {
    throw new Error('stealthPrivateKey does not match the expected stealthAddress');
  }

  // 1. Delegation: chain + executor + account nonce.
  const authorization = await account.signAuthorization({
    chainId: params.chainId,
    address: executor,
    nonce: params.authorizationNonce,
  });

  // 2. Intent: destination, amount, sweep nonce, deadline. Under EIP-7702 the
  // executor runs in the EOA's context, so verifyingContract is the EOA itself.
  const sweepSignature = await account.signTypedData({
    domain: {
      name: SWEEP_DOMAIN_NAME,
      version: SWEEP_DOMAIN_VERSION,
      chainId: params.chainId,
      verifyingContract: account.address,
    },
    types: SWEEP_TYPES,
    primaryType: 'Sweep',
    message: {
      to: destination,
      amount: params.amount,
      nonce: params.sweepNonce,
      deadline: params.deadline,
    },
  });

  const calldata = encodeFunctionData({
    abi: EXECUTOR_SWEEP_ABI,
    functionName: 'sweep',
    args: [destination, params.amount, params.sweepNonce, params.deadline, sweepSignature],
  });

  return {
    schema: SWEEP_PACKAGE_SCHEMA,
    version: SWEEP_PACKAGE_VERSION,
    chainId: params.chainId,
    executor,
    stealthAddress: account.address,
    destination,
    amount: params.amount.toString(),
    sweepNonce: params.sweepNonce.toString(),
    deadline: params.deadline.toString(),
    authorizationNonce: params.authorizationNonce,
    authorization: {
      chainId: authorization.chainId,
      address: authorization.address as Address,
      nonce: authorization.nonce,
      r: authorization.r,
      s: authorization.s,
      yParity: authorization.yParity as number,
    },
    sweepSignature,
    calldata,
  };
}

export interface SweepPackageVerification {
  valid: boolean;
  checks: {
    schema: boolean;
    delegationSigner: boolean;
    executorMatches: boolean;
    chainIdMatches: boolean;
    sweepSigner: boolean;
    calldataMatches: boolean;
    notExpired: boolean;
  };
  failures: string[];
  stealthAddress: Address | null;
}

const HALF_ORDER = secp256k1.CURVE.n >> 1n;

/** True when the signature's s value is in the upper half of the curve order (malleable form). */
export function hasHighS(signature: Hex): boolean {
  try {
    return BigInt(parseSignature(signature).s) > HALF_ORDER;
  } catch {
    return true;
  }
}

const DECIMAL_UINT = /^[0-9]+$/;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;

/** Structural validation of an untrusted package. Returns a reason or null. */
export function packageShapeProblem(pkg: unknown): string | null {
  if (pkg === null || typeof pkg !== 'object') return 'Package is not an object.';
  const p = pkg as Record<string, unknown>;
  if (p['schema'] !== SWEEP_PACKAGE_SCHEMA || p['version'] !== SWEEP_PACKAGE_VERSION) {
    return 'Unrecognised package schema or version.';
  }
  if (typeof p['chainId'] !== 'number' || !Number.isInteger(p['chainId']) || p['chainId'] <= 0) {
    return 'chainId must be a positive integer.';
  }
  for (const field of ['executor', 'stealthAddress', 'destination'] as const) {
    if (typeof p[field] !== 'string' || !isAddress(p[field] as string)) {
      return `${field} is not a valid address.`;
    }
  }
  for (const field of ['amount', 'sweepNonce', 'deadline'] as const) {
    if (typeof p[field] !== 'string' || !DECIMAL_UINT.test(p[field] as string)) {
      return `${field} must be a decimal integer string.`;
    }
  }
  if (typeof p['authorizationNonce'] !== 'number' || !Number.isInteger(p['authorizationNonce']) || p['authorizationNonce'] < 0) {
    return 'authorizationNonce must be a non-negative integer.';
  }
  const auth = p['authorization'];
  if (auth === null || typeof auth !== 'object') return 'authorization is missing.';
  const a = auth as Record<string, unknown>;
  if (typeof a['chainId'] !== 'number' || !Number.isInteger(a['chainId']) || a['chainId'] < 0) {
    return 'authorization.chainId must be a non-negative integer.';
  }
  if (typeof a['address'] !== 'string' || !isAddress(a['address'] as string)) {
    return 'authorization.address is not a valid address.';
  }
  if (typeof a['nonce'] !== 'number' || !Number.isInteger(a['nonce']) || a['nonce'] < 0) {
    return 'authorization.nonce must be a non-negative integer.';
  }
  if (typeof a['r'] !== 'string' || !HEX32.test(a['r'] as string) || typeof a['s'] !== 'string' || !HEX32.test(a['s'] as string)) {
    return 'authorization.r and authorization.s must be 32-byte hex values.';
  }
  if (a['yParity'] !== 0 && a['yParity'] !== 1) return 'authorization.yParity must be 0 or 1.';
  if (a['nonce'] !== p['authorizationNonce']) return 'authorizationNonce must equal authorization.nonce.';
  if (typeof p['sweepSignature'] !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(p['sweepSignature'] as string)) {
    return 'sweepSignature must be a 65-byte hex signature.';
  }
  if (typeof p['calldata'] !== 'string' || !/^0x[0-9a-fA-F]*$/.test(p['calldata'] as string)) {
    return 'calldata must be hex.';
  }
  return null;
}

/**
 * Independently verify every bound field of a sweep package. Tampering with the
 * destination, amount, sweep nonce, deadline, executor or chain must fail here.
 * Structurally malformed input fails closed (valid: false) and never throws.
 *
 * `now` is injectable so expiry is deterministic in tests.
 */
export async function verifyNativeSweepPackage(
  pkg: NativeSweepPackage,
  opts: { now?: bigint } = {},
): Promise<SweepPackageVerification> {
  const failures: string[] = [];
  const checks: SweepPackageVerification['checks'] = {
    schema: false,
    delegationSigner: false,
    executorMatches: false,
    chainIdMatches: false,
    sweepSigner: false,
    calldataMatches: false,
    notExpired: false,
  };

  const fail = (msg: string) => {
    failures.push(msg);
  };

  // Shape first: a package is untrusted input (pasted, downloaded, relayed).
  // Anything structurally wrong fails closed instead of throwing.
  const shapeProblem = packageShapeProblem(pkg);
  if (shapeProblem) {
    fail(shapeProblem);
    return { valid: false, checks, failures, stealthAddress: null };
  }
  checks.schema = true;

  const amount = BigInt(pkg.amount);
  const sweepNonce = BigInt(pkg.sweepNonce);
  const deadline = BigInt(pkg.deadline);

  // Executor identity: the delegation must point at the declared executor.
  if (pkg.authorization.address?.toLowerCase() === pkg.executor?.toLowerCase()) {
    checks.executorMatches = true;
  } else {
    fail('Delegation authorization does not point at the declared executor.');
  }

  // Chain binding. EIP-7702 permits chainId 0 (any chain) in the tuple, but a
  // chain-agnostic delegation would install the executor on every chain, and
  // GhostName never produces one, so it is rejected here.
  if (pkg.authorization.chainId === pkg.chainId) {
    checks.chainIdMatches = true;
  } else if (pkg.authorization.chainId === 0) {
    fail('Delegation is chain-agnostic (chainId 0); GhostName requires a chain-bound delegation.');
  } else {
    fail('Delegation chain id does not match the package chain id.');
  }

  // Delegation signer must be the stealth EOA, and the signature canonical:
  // nodes reject high-s authorizations, and a non-canonical form would let a
  // relayer alter the package bytes without invalidating it.
  try {
    if (BigInt(pkg.authorization.s) > HALF_ORDER) throw new Error('high-s delegation');
    checks.delegationSigner = await verifyAuthorization({
      address: pkg.stealthAddress,
      authorization: {
        chainId: pkg.authorization.chainId,
        address: pkg.authorization.address,
        nonce: pkg.authorization.nonce,
        r: pkg.authorization.r,
        s: pkg.authorization.s,
        yParity: pkg.authorization.yParity,
      } as SignedAuthorization,
    });
  } catch {
    checks.delegationSigner = false;
  }
  if (!checks.delegationSigner) fail('Delegation signature was not made by the stealth address.');

  // The intent signature is what actually binds destination/amount/nonce/deadline.
  // Only canonical low-s signatures are accepted, so a relayer cannot produce
  // a second, differently-encoded but equally valid package.
  try {
    if (hasHighS(pkg.sweepSignature)) throw new Error('high-s signature');
    checks.sweepSigner = await verifyTypedData({
      address: pkg.stealthAddress,
      domain: {
        name: SWEEP_DOMAIN_NAME,
        version: SWEEP_DOMAIN_VERSION,
        chainId: pkg.chainId,
        verifyingContract: pkg.stealthAddress,
      },
      types: SWEEP_TYPES,
      primaryType: 'Sweep',
      message: { to: pkg.destination, amount, nonce: sweepNonce, deadline },
      signature: pkg.sweepSignature,
    });
  } catch {
    checks.sweepSigner = false;
  }
  if (!checks.sweepSigner) {
    fail('Sweep intent signature does not bind these destination/amount/nonce/deadline values.');
  }

  // Calldata must decode to exactly the declared fields.
  try {
    const decoded = decodeFunctionData({ abi: EXECUTOR_SWEEP_ABI, data: pkg.calldata });
    const [to, dAmount, dNonce, dDeadline, dSig] = decoded.args as unknown as [
      Address,
      bigint,
      bigint,
      bigint,
      Hex,
    ];
    checks.calldataMatches =
      decoded.functionName === 'sweep' &&
      to.toLowerCase() === pkg.destination.toLowerCase() &&
      dAmount === amount &&
      dNonce === sweepNonce &&
      dDeadline === deadline &&
      dSig.toLowerCase() === pkg.sweepSignature.toLowerCase();
  } catch {
    checks.calldataMatches = false;
  }
  if (!checks.calldataMatches) fail('Calldata does not decode to the declared sweep fields.');

  const now = opts.now ?? BigInt(Math.floor(Date.now() / 1000));
  checks.notExpired = deadline > now;
  if (!checks.notExpired) fail('Package deadline has passed.');

  const valid = Object.values(checks).every(Boolean);
  return { valid, checks, failures, stealthAddress: pkg.stealthAddress };
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
 * Fresh random 256-bit executor sweep nonce. The executor accepts any unused
 * uint256, so a random nonce means two packages for the SAME stealth EOA (for
 * example a partial sweep followed by a second one) never collide on
 * "nonce used", without reading executor storage first.
 */
export function randomSweepNonce(): bigint {
  return BigInt(randomNonce());
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
