/**
 * The private payment flow: resolve → derive fresh destination → send ETH →
 * announce. Sepolia-only by default, enforced before any wallet interaction.
 *
 * Two safety properties beyond the network guards:
 *  - a plan is BOUND to the chain it was resolved on. A record read on Sepolia
 *    must never be paid on mainnet (or vice versa), because the same name can
 *    publish different records on different networks;
 *  - the flow is two transactions. If the transfer lands but the announcement
 *    does not, the caller receives everything needed to retry the announcement
 *    (the ephemeral public key in particular), because without it the
 *    recipient cannot discover the payment.
 */
import type { Account, Address, Chain, Hash, Hex } from 'viem';
import { assertWritableNetwork } from './guards';
import {
  ANNOUNCER_ABI,
  ANNOUNCER_ADDRESS,
  buildEthAnnouncementMetadata,
} from './announcer';
import { generateStealthAddress, type StealthAddressResult } from '../crypto/stealth';
import { SCHEME_ID } from '../crypto/metaAddress';
import { resolveForStealthPayment, type EnsReader } from '../ens/resolve';
import { describeError } from '../lib/describeError';

/** Minimal structural wallet interface so tests can inject fakes. */
export interface PaymentWallet {
  getChainId(): Promise<number>;
  sendTransaction(args: {
    to: Address;
    value: bigint;
    account: Address | Account;
    chain: Chain | null | undefined;
  }): Promise<Hash>;
  writeContract(args: {
    address: Address;
    abi: typeof ANNOUNCER_ABI;
    functionName: 'announce';
    args: readonly [bigint, Address, Hex, Hex];
    account: Address | Account;
    chain: Chain | null | undefined;
  }): Promise<Hash>;
}

export interface StealthPaymentPlan {
  ensName: string;
  derivation: StealthAddressResult;
  amountWei: bigint;
  /** Chain the record was resolved on; the payment must go to the same chain. */
  chainId: number;
}

/** Thrown when a plan resolved on one chain is about to be paid on another. */
export class PlanChainMismatchError extends Error {
  constructor(planChainId: number, actualChainId: number) {
    super(
      `This destination was derived from the record on chain ${planChainId}, but the wallet ` +
        `is on chain ${actualChainId}. Derive again on the current network before paying.`,
    );
    this.name = 'PlanChainMismatchError';
  }
}

/**
 * Thrown when the ETH transfer was sent but the announcement was not. Carries
 * the recovery data: the payment hash and the full plan (stealth address,
 * ephemeral public key, view tag) so the announcement can be retried.
 */
export class AnnouncementFailedError extends Error {
  readonly paymentTx: Hash;
  readonly plan: StealthPaymentPlan;
  constructor(paymentTx: Hash, plan: StealthPaymentPlan, cause: unknown) {
    // The hash is carried in a field, not in the message: user-facing error
    // text is passed through describeError, which redacts 32-byte hex values.
    super(
      'The ETH transfer was sent but the ERC-5564 announcement was not: ' +
        `${describeError(cause)}. Keep the recovery data shown and retry the announcement; ` +
        'without it the recipient cannot discover this payment.',
    );
    this.name = 'AnnouncementFailedError';
    this.paymentTx = paymentTx;
    this.plan = plan;
  }
}

/**
 * Step 1 (pure + read-only): resolve the ENS stealth record and derive a
 * FRESH one-time destination. Never reuses ephemeral randomness — calling
 * this twice always yields two different destinations. `chainId` is the chain
 * `ensClient` reads from; it is recorded on the plan and enforced at pay time.
 */
export async function planStealthPayment(
  ensClient: EnsReader,
  ensName: string,
  amountWei: bigint,
  chainId: number,
): Promise<StealthPaymentPlan> {
  const { name, record } = await resolveForStealthPayment(ensClient, ensName);
  return { ensName: name, derivation: generateStealthAddress(record), amountWei, chainId };
}

export interface ExecutedStealthPayment {
  paymentTx: Hash;
  announcementTx: Hash;
  stealthAddress: Address;
}

export interface WriteArgs {
  walletClient: PaymentWallet;
  chain: Chain;
  /** Address (browser wallet) or a local viem Account (scripts/tests). */
  account: Address | Account;
  plan: StealthPaymentPlan;
  /** Explicit per-action confirmation, required for a mainnet write. */
  mainnetConfirmed?: boolean;
}

async function assertPlanWritable(args: WriteArgs): Promise<void> {
  if (args.plan.amountWei <= 0n) {
    throw new Error('Payment amount must be greater than zero.');
  }
  const guard = { mainnetConfirmed: args.mainnetConfirmed };
  // Guard 1: the chain the caller intends to use must be a permitted write target.
  assertWritableNetwork(args.chain.id, guard);
  // Guard 2: the plan must have been resolved on that same chain.
  if (args.plan.chainId !== args.chain.id) {
    throw new PlanChainMismatchError(args.plan.chainId, args.chain.id);
  }
  // Guard 3: the chain the wallet actually reports, checked the same two ways.
  const walletChain = await args.walletClient.getChainId();
  assertWritableNetwork(walletChain, guard);
  if (walletChain !== args.plan.chainId) {
    throw new PlanChainMismatchError(args.plan.chainId, walletChain);
  }
}

/**
 * Emit only the ERC-5564 announcement for an already-sent payment. Used to
 * retry after an AnnouncementFailedError. Same guards as a full payment.
 */
export async function announceStealthPayment(args: WriteArgs): Promise<Hash> {
  await assertPlanWritable(args);
  const { derivation, amountWei } = args.plan;
  return args.walletClient.writeContract({
    address: ANNOUNCER_ADDRESS,
    abi: ANNOUNCER_ABI,
    functionName: 'announce',
    args: [
      SCHEME_ID,
      derivation.stealthAddress,
      derivation.ephemeralPublicKey,
      buildEthAnnouncementMetadata(derivation.viewTag, amountWei),
    ],
    account: args.account,
    chain: args.chain,
  });
}

/**
 * Step 2 (writes): send the ETH and emit the EIP-5564 announcement so the
 * recipient can discover the payment. Sepolia by default; a mainnet payment
 * requires the build's mainnet opt-in AND `mainnetConfirmed: true`.
 */
export async function executeStealthPayment(args: WriteArgs): Promise<ExecutedStealthPayment> {
  await assertPlanWritable(args);
  const { derivation, amountWei } = args.plan;
  const paymentTx = await args.walletClient.sendTransaction({
    to: derivation.stealthAddress,
    value: amountWei,
    account: args.account,
    chain: args.chain,
  });
  let announcementTx: Hash;
  try {
    announcementTx = await announceStealthPayment(args);
  } catch (err) {
    throw new AnnouncementFailedError(paymentTx, args.plan, err);
  }
  return { paymentTx, announcementTx, stealthAddress: derivation.stealthAddress };
}
