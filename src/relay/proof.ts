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
import { recoverAuthorizationAddress, verifyTypedData } from 'viem/utils';
import { decodeEventLog } from 'viem';
import {
  EXECUTOR_SWEEP_ABI,
  SWEEP_DOMAIN_NAME,
  SWEEP_DOMAIN_VERSION,
  SWEEP_TYPES,
  hasHighS,
} from './sweepTypes';
import type { SweepEvidenceRef } from './evidence';
import { describeError } from '../lib/describeError';

/** keccak256("Swept(address,uint256,uint256)") */
export const SWEPT_EVENT_TOPIC = keccak256(toHex('Swept(address,uint256,uint256)'));

export const SWEPT_EVENT = {
  name: 'Swept',
  type: 'event',
  inputs: [
    { name: 'to', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
    { name: 'nonce', type: 'uint256', indexed: false },
  ],
} as const;

/** EIP-7702 delegation designator prefix (EIP-7702: 0xef0100 || address). */
const DELEGATION_PREFIX = '0xef0100';

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
  /** Optional: present-state delegation designator of the swept account. */
  getCode?(args: { address: Address }): Promise<Hex | undefined>;
}

const NOT_PROVEN = [
  'That the destination address is unrelated to the recipient.',
  'That the swept account was never separately funded for gas at some earlier point (only this transaction is examined).',
  'That the sponsor is independent of the payer or recipient (in the published demo it is the same throwaway test wallet).',
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

  // 4. The delegation points at the expected executor AND was signed by the
  // account being swept. A type-4 transaction may carry several
  // authorizations; only one whose recovered authority is tx.to counts.
  if (!tx.authorizationList) {
    add(
      'delegation',
      'Delegation points at the expected executor',
      'unknown',
      'This RPC did not expose the authorization list, so the delegate could not be checked here.',
    );
  } else if (tx.authorizationList.length === 0) {
    add('delegation', 'Delegation points at the expected executor', 'fail', 'No authorization present.');
  } else {
    let matched: (typeof tx.authorizationList)[number] | null = null;
    let recoveryFailed = false;
    for (const candidate of tx.authorizationList) {
      try {
        const authority = await recoverAuthorizationAddress({
          authorization: {
            address: candidate.address,
            chainId: candidate.chainId,
            nonce: candidate.nonce,
            r: candidate.r,
            s: candidate.s,
            yParity: candidate.yParity,
          },
        });
        if (tx.to && authority.toLowerCase() === tx.to.toLowerCase()) {
          matched = candidate;
          break;
        }
      } catch {
        recoveryFailed = true;
      }
    }
    if (!matched) {
      add(
        'delegation',
        'Delegation points at the expected executor',
        'fail',
        recoveryFailed
          ? 'No authorization in this transaction recovers to the swept account (some could not be recovered).'
          : 'No authorization in this transaction was signed by the swept account.',
      );
    } else {
      facts.executor = matched.address;
      const matches = matched.address.toLowerCase() === ref.expectedExecutor.toLowerCase();
      const chainOk = matched.chainId === ref.chainId;
      add(
        'delegation',
        'Delegation points at the expected executor',
        matches && chainOk ? 'pass' : 'fail',
        matches && chainOk
          ? `The swept account delegated to ${matched.address} on chain ${matched.chainId} (account nonce ${matched.nonce}).`
          : !matches
            ? `The swept account delegated to ${matched.address}, expected ${ref.expectedExecutor}.`
            : matched.chainId === 0
              ? 'Delegation is chain-agnostic (chainId 0), which would install the executor on every chain; GhostName never produces this.'
              : `Delegation chain id ${matched.chainId} does not match ${ref.chainId}.`,
      );
    }
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
      if (hasHighS(signature)) throw new Error('non-canonical (high-s) signature');
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

  // 7. The executor emitted its Swept event FROM THE SWEPT ACCOUNT. Under
  // EIP-7702 the executor runs in the EOA's context, so the log address must
  // be tx.to; a matching topic from any other emitter proves nothing.
  const sweptLogs = receipt.logs.filter((log) => log.topics[0] === SWEPT_EVENT_TOPIC);
  const sweptFromEoa = sweptLogs.find(
    (log) => !!tx.to && log.address.toLowerCase() === tx.to.toLowerCase(),
  );
  if (sweptFromEoa) {
    let fieldsMatch: boolean | null = null;
    let fieldDetail = '';
    try {
      const decoded = decodeEventLog({
        abi: [SWEPT_EVENT],
        data: sweptFromEoa.data,
        topics: sweptFromEoa.topics as [Hex, ...Hex[]],
      });
      const ev = decoded.args as unknown as { to: Address; amount: bigint; nonce: bigint };
      fieldsMatch =
        destination !== null &&
        amount !== null &&
        sweepNonce !== null &&
        ev.to.toLowerCase() === destination.toLowerCase() &&
        ev.amount === amount &&
        ev.nonce === sweepNonce;
      fieldDetail = fieldsMatch
        ? ` Event fields (to, amount, nonce) match the calldata.`
        : ` Event fields (to=${ev.to}, amount=${ev.amount}, nonce=${ev.nonce}) do not match the calldata.`;
    } catch {
      fieldsMatch = false;
      fieldDetail = ' The event data could not be decoded as Swept(address,uint256,uint256).';
    }
    add(
      'event',
      'Executor emitted the Swept event from the swept account',
      fieldsMatch ? 'pass' : 'fail',
      `Swept emitted from ${sweptFromEoa.address}, the swept account itself, as EIP-7702 delegation implies.${fieldDetail}`,
    );
  } else if (sweptLogs.length > 0) {
    add(
      'event',
      'Executor emitted the Swept event from the swept account',
      'fail',
      `A Swept event was emitted by ${sweptLogs[0]!.address}, not by the swept account ${tx.to ?? 'unknown'}.`,
    );
  } else {
    add(
      'event',
      'Executor emitted the Swept event from the swept account',
      'fail',
      'No Swept event found in the receipt.',
    );
  }

  // 8. Present-state corroboration: under EIP-7702 the delegation persists, so
  // the swept account's code should still be the designator for the executor.
  // A different designator only means the account was re-delegated since; it
  // does not contradict the historical transaction, so it is unknown, not fail.
  if (tx.to && client.getCode) {
    try {
      const code = (await client.getCode({ address: tx.to })) ?? '0x';
      const expected = `${DELEGATION_PREFIX}${ref.expectedExecutor.slice(2)}`.toLowerCase();
      const stillDelegated = code.toLowerCase() === expected;
      add(
        'designator',
        'Swept account still carries the executor delegation (present state)',
        stillDelegated ? 'pass' : 'unknown',
        stillDelegated
          ? `Account code is ${DELEGATION_PREFIX}${ref.expectedExecutor.slice(2).toLowerCase()}, the EIP-7702 designator for the expected executor.`
          : code === '0x'
            ? 'The account currently has no code; the delegation has been cleared since the sweep.'
            : `The account currently delegates elsewhere (${code.slice(0, 50)}…); it was re-delegated since the sweep.`,
      );
    } catch {
      add('designator', 'Swept account still carries the executor delegation (present state)', 'unknown', 'Account code could not be read.');
    }
  }

  // 9. The stealth address holds nothing now. Current state only: without
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
