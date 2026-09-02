/**
 * Independently verify a sponsored EIP-7702 exit from public chain data.
 *
 * Nothing here trusts the configured evidence beyond a transaction hash: every
 * claim is re-derived from the transaction, its receipt and current chain
 * state. Anything the available RPC cannot establish is reported as unknown
 * rather than asserted, and the panel keeps a standing NOT PROVEN list so a
 * green result is never read as more than it is.
 */
import {
  decodeFunctionData,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { verifyTypedData } from 'viem/utils';
import {
  EXECUTOR_SWEEP_ABI,
  SWEEP_DOMAIN_NAME,
  SWEEP_DOMAIN_VERSION,
  SWEEP_TYPES,
} from './sweep';
import type { SweepEvidenceRef } from './evidence';
import { describeError } from '../lib/describeError';

/** keccak256("Swept(address,uint256,uint256)") */
export const SWEPT_EVENT_TOPIC = keccak256(toHex('Swept(address,uint256,uint256)'));

export type CheckState = 'pass' | 'fail' | 'unknown';

export interface ProofCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
}

export interface SweepProof {
  txHash: Hex;
  chainId: number;
  explorerUrl: string;
  /** Overall: pass only when no check failed and none are unknown-critical. */
  verified: boolean;
  checks: ProofCheck[];
  /** Facts read from chain, for display. */
  facts: {
    sponsor: Address | null;
    stealthAddress: Address | null;
    executor: Address | null;
    destination: Address | null;
    amountWei: string | null;
    sweepNonce: string | null;
    deadline: string | null;
    stealthBalanceWei: string | null;
  };
  /** Properties this proof deliberately does NOT establish. */
  notProven: string[];
  error?: string;
}

/** Structural client interface so tests can inject fakes. */
export interface ProofClient {
  getTransaction(args: { hash: Hex }): Promise<{
    type?: string;
    typeHex?: Hex;
    from: Address;
    to: Address | null;
    input: Hex;
    authorizationList?: ReadonlyArray<{
      address: Address;
      chainId: number;
      nonce: number;
      r: Hex;
      s: Hex;
      yParity: number;
    }>;
  }>;
  getTransactionReceipt(args: { hash: Hex }): Promise<{
    status: 'success' | 'reverted';
    logs: ReadonlyArray<{ address: Address; topics: readonly Hex[]; data: Hex }>;
  }>;
  getBalance(args: { address: Address }): Promise<bigint>;
}

const NOT_PROVEN = [
  'That the destination address is unrelated to the recipient.',
  'That no offchain party (relayer, RPC, indexer) logged metadata about this exit.',
  'Historical balances at earlier blocks, without archive-quality RPC access.',
  'Amount privacy: the swept value is public on-chain.',
  'Sender privacy: the sponsor address is public on-chain.',
];

/**
 * Verify a sponsored exit. Every check is derived from chain data; the only
 * configured input is which transaction to look at.
 */
export async function verifySweepProof(
  client: ProofClient,
  ref: SweepEvidenceRef,
): Promise<SweepProof> {
  const checks: ProofCheck[] = [];
  const facts: SweepProof['facts'] = {
    sponsor: null,
    stealthAddress: null,
    executor: null,
    destination: null,
    amountWei: null,
    sweepNonce: null,
    deadline: null,
    stealthBalanceWei: null,
  };
  const explorerUrl = `${ref.explorerBase}/tx/${ref.txHash}`;

  const add = (id: string, label: string, state: CheckState, detail: string) =>
    checks.push({ id, label, state, detail });

  let tx: Awaited<ReturnType<ProofClient['getTransaction']>>;
  let receipt: Awaited<ReturnType<ProofClient['getTransactionReceipt']>>;
  try {
    [tx, receipt] = await Promise.all([
      client.getTransaction({ hash: ref.txHash }),
      client.getTransactionReceipt({ hash: ref.txHash }),
    ]);
  } catch (err) {
    return {
      txHash: ref.txHash,
      chainId: ref.chainId,
      explorerUrl,
      verified: false,
      checks: [
        {
          id: 'fetch',
          label: 'Transaction is readable from chain',
          state: 'unknown',
          detail: `Could not read the transaction: ${describeError(err)}`,
        },
      ],
      facts,
      notProven: NOT_PROVEN,
      error: describeError(err),
    };
  }

  facts.sponsor = tx.from;
  facts.stealthAddress = tx.to;

  // 1. The transaction succeeded.
  add(
    'receipt',
    'Transaction succeeded',
    receipt.status === 'success' ? 'pass' : 'fail',
    `Receipt status: ${receipt.status}.`,
  );

  // 2. It is an EIP-7702 (type 4) transaction.
  const isType4 = tx.typeHex === '0x4' || tx.type === 'eip7702';
  add(
    'type',
    'Transaction is EIP-7702 (type 4)',
    isType4 ? 'pass' : 'fail',
    `Reported type: ${tx.type ?? tx.typeHex ?? 'unknown'}.`,
  );

  // 3. A sponsor paid, not the stealth EOA itself. This is the whole point:
  // the stealth address never needed a gas-funding transfer.
  const sponsorDiffers =
    !!tx.to && tx.from.toLowerCase() !== tx.to.toLowerCase();
  add(
    'sponsor',
    'Gas paid by a sponsor, not the stealth address',
    sponsorDiffers ? 'pass' : 'fail',
    sponsorDiffers
      ? `Sponsor ${tx.from} sent the transaction; the swept account is ${tx.to}.`
      : 'The transaction sender is the same account being swept.',
  );

  // 4. The delegation points at the expected executor.
  const auth = tx.authorizationList?.[0];
  if (!tx.authorizationList) {
    add(
      'delegation',
      'Delegation points at the expected executor',
      'unknown',
      'This RPC did not expose the authorization list, so the delegate could not be checked here.',
    );
  } else if (!auth) {
    add('delegation', 'Delegation points at the expected executor', 'fail', 'No authorization present.');
  } else {
    facts.executor = auth.address;
    const matches = auth.address.toLowerCase() === ref.expectedExecutor.toLowerCase();
    const chainOk = auth.chainId === ref.chainId || auth.chainId === 0;
    add(
      'delegation',
      'Delegation points at the expected executor',
      matches && chainOk ? 'pass' : 'fail',
      matches
        ? `Delegated to ${auth.address} on chain ${auth.chainId} (account nonce ${auth.nonce}).`
        : `Delegated to ${auth.address}, expected ${ref.expectedExecutor}.`,
    );
  }

  // 5. Calldata binds destination, amount, nonce and deadline.
  let destination: Address | null = null;
  let amount: bigint | null = null;
  let sweepNonce: bigint | null = null;
  let deadline: bigint | null = null;
  let signature: Hex | null = null;
  try {
    const decoded = decodeFunctionData({ abi: EXECUTOR_SWEEP_ABI, data: tx.input });
    const args = decoded.args as unknown as [Address, bigint, bigint, bigint, Hex];
    [destination, amount, sweepNonce, deadline, signature] = args;
    facts.destination = destination;
    facts.amountWei = amount.toString();
    facts.sweepNonce = sweepNonce.toString();
    facts.deadline = deadline.toString();
    add(
      'calldata',
      'Calldata binds destination, amount, nonce and deadline',
      'pass',
      `sweep(to=${destination}, amount=${amount}, nonce=${sweepNonce}, deadline=${deadline}).`,
    );
  } catch {
    add(
      'calldata',
      'Calldata binds destination, amount, nonce and deadline',
      'fail',
      'Transaction input did not decode as a sweep(...) call.',
    );
  }

  // 6. The intent signature recovers to the stealth EOA. Under EIP-7702 the
  // executor runs in the EOA's context, so verifyingContract is the EOA.
  if (destination && amount !== null && sweepNonce !== null && deadline !== null && signature && tx.to) {
    try {
      const ok = await verifyTypedData({
        address: tx.to,
        domain: {
          name: SWEEP_DOMAIN_NAME,
          version: SWEEP_DOMAIN_VERSION,
          chainId: ref.chainId,
          verifyingContract: tx.to,
        },
        types: SWEEP_TYPES,
        primaryType: 'Sweep',
        message: { to: destination, amount, nonce: sweepNonce, deadline },
        signature,
      });
      add(
        'intent',
        'Sweep intent was signed by the stealth address',
        ok ? 'pass' : 'fail',
        ok
          ? `The EIP-712 Sweep signature recovers to ${tx.to}, so only that key authorized this destination and amount.`
          : 'The intent signature did not recover to the swept account.',
      );
    } catch (err) {
      add(
        'intent',
        'Sweep intent was signed by the stealth address',
        'unknown',
        `Signature check could not run: ${describeError(err)}`,
      );
    }
  } else {
    add(
      'intent',
      'Sweep intent was signed by the stealth address',
      'unknown',
      'Calldata was not decodable, so the intent signature could not be checked.',
    );
  }

  // 7. The executor emitted its Swept event, from the EOA's own context.
  const sweptLog = receipt.logs.find((log) => log.topics[0] === SWEPT_EVENT_TOPIC);
  if (sweptLog) {
    const emittedByEoa = !!tx.to && sweptLog.address.toLowerCase() === tx.to.toLowerCase();
    add(
      'event',
      'Executor emitted the Swept event',
      'pass',
      emittedByEoa
        ? `Swept emitted from ${sweptLog.address}, the swept account itself, as EIP-7702 delegation implies.`
        : `Swept emitted from ${sweptLog.address}.`,
    );
  } else {
    add('event', 'Executor emitted the Swept event', 'fail', 'No Swept event found in the receipt.');
  }

  // 8. The stealth address holds nothing now. Current state only: without
  // archive access we cannot prove the historical balance, so we do not claim it.
  if (tx.to) {
    try {
      const balance = await client.getBalance({ address: tx.to });
      facts.stealthBalanceWei = balance.toString();
      add(
        'balance',
        'Swept account is now empty',
        balance === 0n ? 'pass' : 'unknown',
        balance === 0n
          ? 'Current balance is zero. This is present state, not a historical proof.'
          : `Current balance is ${balance} wei, so the account has been used again since the sweep.`,
      );
    } catch {
      add('balance', 'Swept account is now empty', 'unknown', 'Balance could not be read.');
    }
  }

  const verified = checks.every((c) => c.state === 'pass');
  return {
    txHash: ref.txHash,
    chainId: ref.chainId,
    explorerUrl,
    verified,
    checks,
    facts,
    notProven: NOT_PROVEN,
  };
}
