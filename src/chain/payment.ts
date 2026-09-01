/**
 * The private payment flow: resolve → derive fresh destination → send ETH →
 * announce. Sepolia-only, enforced before any wallet interaction.
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
}

/**
 * Step 1 (pure + read-only): resolve the ENS stealth record and derive a
 * FRESH one-time destination. Never reuses ephemeral randomness — calling
 * this twice always yields two different destinations.
 */
export async function planStealthPayment(
  ensClient: EnsReader,
  ensName: string,
  amountWei: bigint,
): Promise<StealthPaymentPlan> {
  const { name, record } = await resolveForStealthPayment(ensClient, ensName);
  return { ensName: name, derivation: generateStealthAddress(record), amountWei };
}

export interface ExecutedStealthPayment {
  paymentTx: Hash;
  announcementTx: Hash;
  stealthAddress: Address;
}

/**
 * Step 2 (writes): send the ETH and emit the EIP-5564 announcement so the
 * recipient can discover the payment. Sepolia by default; a mainnet payment
 * requires the build's mainnet opt-in AND `mainnetConfirmed: true`.
 */
export async function executeStealthPayment(args: {
  walletClient: PaymentWallet;
  chain: Chain;
  /** Address (browser wallet) or a local viem Account (scripts/tests). */
  account: Address | Account;
  plan: StealthPaymentPlan;
  /** Explicit per-action confirmation, required for a mainnet payment. */
  mainnetConfirmed?: boolean;
}): Promise<ExecutedStealthPayment> {
  const guard = { mainnetConfirmed: args.mainnetConfirmed };
  assertWritableNetwork(args.chain.id, guard);
  assertWritableNetwork(await args.walletClient.getChainId(), guard);

  const { derivation, amountWei } = args.plan;
  const paymentTx = await args.walletClient.sendTransaction({
    to: derivation.stealthAddress,
    value: amountWei,
    account: args.account,
    chain: args.chain,
  });
  const announcementTx = await args.walletClient.writeContract({
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
  return { paymentTx, announcementTx, stealthAddress: derivation.stealthAddress };
}
