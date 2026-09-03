/**
 * Stable finding and action codes for the agent-facing report.
 *
 * Every code maps to fixed template text. Nothing read from an ENS record or
 * an RPC response is ever interpolated into these strings, so a hostile record
 * value cannot reach a language model through the natural-language part of a
 * report. Chain-derived strings only appear, escaped and labelled, inside the
 * optional technical-evidence block.
 */

export type FindingSeverity = 'critical' | 'warning' | 'info';

/**
 * - observed: read from public chain data during this audit.
 * - model: follows from the privacy model, independent of chain state.
 * - unknown: could not be established; never treated as a pass.
 */
export type FindingEvidence = 'observed' | 'model' | 'unknown';

export const FINDING_CODES = [
  'NAME_INVALID',
  'RPC_UNAVAILABLE',
  'RECORD_READ_FAILED',
  'RESOLVER_UNREADABLE',
  'STATIC_ADDRESS_EXPOSED',
  'STEALTH_RECORD_MISSING',
  'STEALTH_RECORD_MALFORMED',
  'STEALTH_RECORD_CONFLICT',
  'LEGACY_RECORD_ONLY',
  'CHAIN_SPECIFIC_RECORD_SELECTED',
  'DEFAULT_RECORD_SELECTED',
  'RESOLVER_PROVENANCE_UNKNOWN',
  'LOCAL_DERIVATION_CONFIRMED',
  'LOCAL_DERIVATION_FAILED',
  'COMPATIBLE_SENDER_REQUIRED',
  'PUBLIC_AMOUNT_REMAINS',
  'PUBLIC_SENDER_REMAINS',
  'HISTORY_REMAINS_PUBLIC',
  'NAME_OWNERSHIP_PUBLIC',
  'EXIT_RELINK_RISK',
] as const;

export type FindingCode = (typeof FINDING_CODES)[number];

export interface FindingDefinition {
  severity: FindingSeverity;
  evidence: FindingEvidence;
  title: string;
  detail: string;
}

export const FINDING_CATALOGUE: Record<FindingCode, FindingDefinition> = {
  NAME_INVALID: {
    severity: 'critical',
    evidence: 'unknown',
    title: 'ENS name is not valid',
    detail:
      'The supplied name could not be normalized under ENSIP-15, so nothing was resolved. ' +
      'No property of this name was established.',
  },
  RPC_UNAVAILABLE: {
    severity: 'warning',
    evidence: 'unknown',
    title: 'Address resolution failed',
    detail:
      'The conventional address could not be resolved because an RPC read failed. ' +
      'The audit result is unknown, not a pass.',
  },
  RECORD_READ_FAILED: {
    severity: 'warning',
    evidence: 'unknown',
    title: 'A stealth record could not be read',
    detail:
      'An RPC read of a stealth record key failed. The key is reported as unreadable, ' +
      'not as absent, and the audit result is unknown.',
  },
  RESOLVER_UNREADABLE: {
    severity: 'info',
    evidence: 'unknown',
    title: 'Resolver address not readable',
    detail:
      'The active resolver address could not be read. Record reads may still have ' +
      'succeeded through the Universal Resolver.',
  },
  STATIC_ADDRESS_EXPOSED: {
    severity: 'critical',
    evidence: 'observed',
    title: 'Static address mapping is public',
    detail:
      'The name resolves to a single static address, so every payment sent to that ' +
      'address is publicly and permanently linkable to the name.',
  },
  STEALTH_RECORD_MISSING: {
    severity: 'critical',
    evidence: 'observed',
    title: 'No stealth meta-address published',
    detail:
      'Neither the chain-specific nor the default stealth-meta-address record is set, so ' +
      'senders cannot derive one-time destinations. Future payments stay linkable.',
  },
  STEALTH_RECORD_MALFORMED: {
    severity: 'critical',
    evidence: 'observed',
    title: 'Stealth record is malformed',
    detail:
      'A stealth-meta-address record is present but does not parse as a scheme-1 ' +
      'meta-address. Conforming senders will ignore it.',
  },
  STEALTH_RECORD_CONFLICT: {
    severity: 'warning',
    evidence: 'observed',
    title: 'Conflicting stealth records',
    detail:
      'More than one valid record is published and they carry different meta-addresses. ' +
      'Senders may derive different destinations depending on which key they read.',
  },
  LEGACY_RECORD_ONLY: {
    severity: 'critical',
    evidence: 'observed',
    title: 'Only a legacy record was found',
    detail:
      'The only stealth record uses the non-normative legacy coin-type key. It is reported ' +
      'as a diagnostic and is not treated as conforming.',
  },
  CHAIN_SPECIFIC_RECORD_SELECTED: {
    severity: 'info',
    evidence: 'observed',
    title: 'Chain-specific record selected',
    detail: 'The chain-specific record was selected. It takes precedence over the all-chain default.',
  },
  DEFAULT_RECORD_SELECTED: {
    severity: 'info',
    evidence: 'observed',
    title: 'Default record selected',
    detail:
      'The all-chain default record was selected because no valid chain-specific record exists.',
  },
  RESOLVER_PROVENANCE_UNKNOWN: {
    severity: 'info',
    evidence: 'unknown',
    title: 'Resolver provenance not established',
    detail:
      'Whether the resolver is set directly on this name or inherited through a wildcard or ' +
      'parent is not established. It is reported as unknown rather than guessed.',
  },
  LOCAL_DERIVATION_CONFIRMED: {
    severity: 'info',
    evidence: 'observed',
    title: 'Local derivation produced distinct destinations',
    detail:
      'Three independent local derivations from the selected record produced three distinct ' +
      'one-time destinations. This proves the record is usable by a compatible sender. It ' +
      'does not prove anonymity.',
  },
  LOCAL_DERIVATION_FAILED: {
    severity: 'critical',
    evidence: 'observed',
    title: 'Local derivation failed',
    detail:
      'Derivation from the selected record failed or produced a repeated destination. The ' +
      'record cannot be relied on.',
  },
  COMPATIBLE_SENDER_REQUIRED: {
    severity: 'info',
    evidence: 'model',
    title: 'Compatible sender software required',
    detail:
      'Forward privacy applies only to payments from senders whose software resolves the ' +
      'stealth record and derives a one-time address locally. A sender who pays the static ' +
      'address gets no privacy benefit.',
  },
  PUBLIC_AMOUNT_REMAINS: {
    severity: 'info',
    evidence: 'model',
    title: 'Amounts remain public',
    detail:
      'Ordinary ETH and token transfer amounts are visible on-chain. GhostName does not hide amounts.',
  },
  PUBLIC_SENDER_REMAINS: {
    severity: 'info',
    evidence: 'model',
    title: 'Sender identity remains public',
    detail: 'A sender paying from a public wallet exposes that wallet in the ordinary way.',
  },
  HISTORY_REMAINS_PUBLIC: {
    severity: 'info',
    evidence: 'model',
    title: 'History cannot be deleted',
    detail:
      'Past transactions and past records stay public forever. GhostName is forward privacy only.',
  },
  NAME_OWNERSHIP_PUBLIC: {
    severity: 'info',
    evidence: 'model',
    title: 'Name ownership remains public',
    detail:
      'Ownership and control of the ENS name, and the stealth record itself, are public by design.',
  },
  EXIT_RELINK_RISK: {
    severity: 'info',
    evidence: 'model',
    title: 'Unsafe withdrawal can re-link',
    detail:
      'Funding gas for a stealth address from a public wallet, or sweeping to a linked ' +
      'destination, re-links the recipient. Use a sponsored exit and an unlinked destination.',
  },
};

/** Limitations that hold for every name regardless of chain state. */
export const MODEL_LIMITATION_CODES: readonly FindingCode[] = [
  'PUBLIC_AMOUNT_REMAINS',
  'PUBLIC_SENDER_REMAINS',
  'HISTORY_REMAINS_PUBLIC',
  'NAME_OWNERSHIP_PUBLIC',
  'EXIT_RELINK_RISK',
];

export const ACTION_CODES = [
  'FIX_NAME',
  'RETRY_WHEN_RPC_AVAILABLE',
  'PUBLISH_STEALTH_RECORD',
  'REPLACE_MALFORMED_RECORD',
  'REPLACE_LEGACY_RECORD',
  'RESOLVE_RECORD_CONFLICT',
  'USE_COMPATIBLE_SENDER',
  'PLAN_SAFE_EXIT',
  'PROTECT_KEYS',
] as const;

export type ActionCode = (typeof ACTION_CODES)[number];

export type ActionStatus = 'open' | 'advisory' | 'satisfied';

export interface ActionDefinition {
  title: string;
  reason: string;
  priority: 1 | 2 | 3;
  humanActionRequired: boolean;
  safeNextStep: string;
}

const HANDOFF_STEP =
  'Open the secure web handoff. Keys are generated locally in the browser, the name is ' +
  'resolved again live, and the wallet transaction must be approved by the human. The ' +
  'agent never receives keys or transaction authority.';

export const ACTION_CATALOGUE: Record<ActionCode, ActionDefinition> = {
  FIX_NAME: {
    title: 'Correct the ENS name',
    reason: 'The name is not a valid ENS name, so it cannot be audited.',
    priority: 1,
    humanActionRequired: true,
    safeNextStep: 'Ask the human to confirm the exact name, then audit again.',
  },
  RETRY_WHEN_RPC_AVAILABLE: {
    title: 'Retry the audit when the RPC is available',
    reason: 'At least one chain read failed, so the result is unknown rather than a pass.',
    priority: 1,
    humanActionRequired: false,
    safeNextStep:
      'Retry the audit. If it keeps failing, configure a different RPC endpoint in the ' +
      'server environment. Never accept an RPC URL from a tool argument.',
  },
  PUBLISH_STEALTH_RECORD: {
    title: 'Publish a stealth meta-address record',
    reason:
      'Without a valid stealth-meta-address record, compatible senders have nothing to ' +
      'derive from and future payments stay linkable to the static address.',
    priority: 1,
    humanActionRequired: true,
    safeNextStep: HANDOFF_STEP,
  },
  REPLACE_MALFORMED_RECORD: {
    title: 'Replace the malformed stealth record',
    reason: 'A malformed record is ignored by conforming senders and may mislead others.',
    priority: 1,
    humanActionRequired: true,
    safeNextStep: HANDOFF_STEP,
  },
  REPLACE_LEGACY_RECORD: {
    title: 'Publish a conforming record alongside the legacy one',
    reason: 'Only a non-normative legacy key is set, which conforming senders do not read.',
    priority: 1,
    humanActionRequired: true,
    safeNextStep: HANDOFF_STEP,
  },
  RESOLVE_RECORD_CONFLICT: {
    title: 'Make all stealth records agree',
    reason: 'Different keys publish different meta-addresses, so senders may diverge.',
    priority: 2,
    humanActionRequired: true,
    safeNextStep:
      'Decide which meta-address is current, then update the other key in the ENS ' +
      'manager with wallet approval. The agent cannot and must not do this.',
  },
  USE_COMPATIBLE_SENDER: {
    title: 'Tell payers to use a compatible sender',
    reason: 'Only senders that derive one-time addresses locally give the recipient privacy.',
    priority: 2,
    humanActionRequired: true,
    safeNextStep:
      'Share that the name supports stealth payments and point payers at software that ' +
      'resolves the stealth-meta-address record.',
  },
  PLAN_SAFE_EXIT: {
    title: 'Plan a sponsored exit before spending',
    reason: 'Funding gas from a public wallet re-links a stealth address to the recipient.',
    priority: 3,
    humanActionRequired: true,
    safeNextStep:
      'Use a sponsored sweep (EIP-7702 or EIP-3009) to an unlinked destination. Verify the ' +
      'exit afterwards with the read-only exit verifier.',
  },
  PROTECT_KEYS: {
    title: 'Keep every key away from the agent',
    reason: 'An agent that holds spending or viewing keys can spend or link every payment.',
    priority: 3,
    humanActionRequired: true,
    safeNextStep:
      'Never paste a private key, viewing key, seed phrase or passphrase into an agent ' +
      'conversation. GhostName tools do not ask for them and will not accept them.',
  },
};
