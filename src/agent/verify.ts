/**
 * Agent-safe wrappers over the read-only evidence verifiers.
 *
 * Both verifiers re-derive every claim from public chain data. The wrappers
 * keep verified, failed and unknown checks apart, carry the standing
 * not-proven list, and never accept or request a viewing key: recognition of
 * a payment is deliberately listed as not proven.
 */
import { SWEEP_EXECUTOR } from '../config';
import { verifyPaymentProof, type PaymentProofClient } from '../relay/paymentProof';
import { verifySweepProof, type ProofClient, type ProofCheck } from '../relay/proof';
import { SUPPORTED_CHAINS, assertSupportedChainId } from './chains';
import { safeAddress, safeHash, sanitizeText } from './sanitize';
import { EVIDENCE_SCHEMA_VERSION, type EvidenceCheck, type EvidenceVerification } from './types';

export class InvalidEvidenceArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEvidenceArgumentError';
  }
}

function split(checks: ProofCheck[]) {
  const map = (c: ProofCheck): EvidenceCheck => ({
    id: c.id,
    label: c.label,
    detail: sanitizeText(c.detail, 400),
  });
  return {
    verifiedChecks: checks.filter((c) => c.state === 'pass').map(map),
    failedChecks: checks.filter((c) => c.state === 'fail').map(map),
    unknownChecks: checks.filter((c) => c.state === 'unknown').map(map),
  };
}

function facts(input: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = value === null || value === undefined ? null : sanitizeText(String(value), 200);
  }
  return out;
}

function summarize(kind: string, total: number, failed: number, unknown: number): string {
  const verified = failed === 0 && unknown === 0;
  return verified
    ? `${kind}: all ${total} checks passed from public chain data. The not-proven list still applies.`
    : `${kind}: ${failed} check(s) failed and ${unknown} could not be established out of ${total}. Not verified.`;
}

export interface VerifyPaymentArgs {
  chainId: number;
  paymentTxHash: string;
  announcementTxHash: string;
  now?: () => Date;
}

export async function verifyPaymentForAgent(
  client: PaymentProofClient,
  args: VerifyPaymentArgs,
): Promise<EvidenceVerification> {
  const chainId = assertSupportedChainId(args.chainId);
  const paymentTxHash = safeHash(args.paymentTxHash);
  const announcementTxHash = safeHash(args.announcementTxHash);
  if (!paymentTxHash) throw new InvalidEvidenceArgumentError('paymentTxHash must be a 32-byte hex hash.');
  if (!announcementTxHash) {
    throw new InvalidEvidenceArgumentError('announcementTxHash must be a 32-byte hex hash.');
  }
  const proof = await verifyPaymentProof(client, {
    label: 'agent',
    chainId,
    paymentTxHash,
    announcementTxHash,
    explorerBase: SUPPORTED_CHAINS[chainId].explorerBase,
  });
  const parts = split(proof.checks);
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    kind: 'payment-and-announcement',
    generatedAt: (args.now ?? (() => new Date()))().toISOString(),
    chainId,
    transactions: { paymentTxHash, announcementTxHash },
    explorerUrls: { payment: proof.paymentUrl, announcement: proof.announcementUrl },
    verified: proof.verified,
    ...parts,
    publicFacts: facts(proof.facts),
    notProven: proof.notProven,
    summary: summarize(
      'Payment and announcement',
      proof.checks.length,
      parts.failedChecks.length,
      parts.unknownChecks.length,
    ),
    ...(proof.error ? { error: sanitizeText(proof.error, 300) } : {}),
  };
}

export interface VerifySponsoredExitArgs {
  chainId: number;
  txHash: string;
  /** Required on mainnet. Defaults to the deployed Sepolia demo executor. */
  expectedExecutor?: string;
  now?: () => Date;
}

export async function verifySponsoredExitForAgent(
  client: ProofClient,
  args: VerifySponsoredExitArgs,
): Promise<EvidenceVerification> {
  const chainId = assertSupportedChainId(args.chainId);
  const txHash = safeHash(args.txHash);
  if (!txHash) throw new InvalidEvidenceArgumentError('txHash must be a 32-byte hex hash.');
  const executorInput = args.expectedExecutor ?? (chainId === 11155111 ? SWEEP_EXECUTOR : undefined);
  const expectedExecutor = safeAddress(executorInput);
  if (!expectedExecutor) {
    throw new InvalidEvidenceArgumentError(
      'expectedExecutor must be an address. It is required on mainnet; on Sepolia it defaults ' +
        'to the deployed demo executor.',
    );
  }
  const proof = await verifySweepProof(client, {
    label: 'agent',
    chainId,
    txHash,
    expectedExecutor: expectedExecutor as `0x${string}`,
    explorerBase: SUPPORTED_CHAINS[chainId].explorerBase,
  });
  const parts = split(proof.checks);
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    kind: 'sponsored-exit',
    generatedAt: (args.now ?? (() => new Date()))().toISOString(),
    chainId,
    transactions: { txHash },
    explorerUrls: { sweep: proof.explorerUrl },
    verified: proof.verified,
    ...parts,
    publicFacts: { ...facts(proof.facts), expectedExecutor },
    notProven: proof.notProven,
    summary: summarize(
      'Sponsored exit',
      proof.checks.length,
      parts.failedChecks.length,
      parts.unknownChecks.length,
    ),
    ...(proof.error ? { error: sanitizeText(proof.error, 300) } : {}),
  };
}
