/**
 * GhostCheck: types for the ENS privacy-readiness audit.
 *
 * Deliberately there is NO numeric score. A privacy property is either
 * evidenced, explicitly experimental, or unknown. Collapsing that into a number
 * would imply precision the evidence does not support.
 */
import type { Address } from 'viem';

export const AUDIT_SCHEMA_VERSION = 1;

/**
 * - private-ready: a valid scheme-1 record was selected and local derivation
 *   produced distinct destinations.
 * - incomplete: no stealth record published, so future payments stay linkable.
 * - misconfigured: a record exists but is malformed, unsupported or conflicting.
 * - unknown: resolution itself could not be completed (RPC or name failure).
 */
export type OverallStatus = 'private-ready' | 'incomplete' | 'misconfigured' | 'unknown';

/** Where a stealth record was found, and whether it parsed. */
export interface RecordSource {
  /** The exact ENS text-record key queried. */
  key: string;
  /** 'default' = all-chain record; 'chain-specific' = ENSIP-11 coinType record. */
  kind: 'default' | 'chain-specific';
  /** ENSIP-11 coin type for chain-specific keys. */
  coinType?: number;
  /** Raw record value, or null when absent. Public data only. */
  value: string | null;
  status: 'absent' | 'present-valid' | 'present-invalid';
  /** Parse failure reason when status is present-invalid. */
  error?: string;
  /** Non-normative diagnostics (e.g. legacy conventions) are labelled. */
  normative: boolean;
}

export interface MetaAddressValidation {
  checked: boolean;
  valid: boolean;
  scheme: number;
  /** Public keys only. Never any private material. */
  spendingPublicKey?: string;
  viewingPublicKey?: string;
  error?: string;
}

export interface LocalDerivationTest {
  ran: boolean;
  /** Number of independent local derivations attempted. */
  trials: number;
  /** Derived one-time destination addresses. Public by construction. */
  addresses: Address[];
  allDistinct: boolean;
  /** Local derivation, or a gateway/CCIP path. */
  derivationPath: 'local-client' | 'gateway-or-ccip' | 'unknown';
  error?: string;
  /**
   * States plainly what a pass does and does not prove, so a green result is
   * never read as "anonymous".
   */
  proves: string;
}

export interface ResolverInfo {
  address: Address | null;
  /**
   * Whether the resolver is set directly on this node or inherited via a
   * wildcard/parent. Returned as 'unknown' unless on-chain evidence is
   * conclusive; never guessed.
   */
  provenance: 'direct' | 'inherited-or-wildcard' | 'unknown';
  provenanceNote: string;
}

export interface TrustBoundaries {
  protected: string[];
  notProtected: string[];
}

export interface PrivacyAuditReport {
  schemaVersion: number;
  generatedAt: string;
  name: string;
  chainId: number;
  overallStatus: OverallStatus;
  /** The static identity-to-wallet mapping, if any. */
  conventionalAddress: Address | null;
  /**
   * How conventionalAddress was obtained: resolved to an address, absent (the
   * RPC answered and there is no record), or failed (the RPC did not answer,
   * so nothing is known). UIs must never render 'failed' as 'no record'.
   */
  conventionalAddressStatus: 'resolved' | 'absent' | 'failed';
  staticMappingNote: string;
  resolver: ResolverInfo;
  recordSources: RecordSource[];
  /** Which source won under the proposed precedence rules. */
  selectedRecord: {
    key: string;
    kind: RecordSource['kind'];
    value: string;
    precedenceNote: string;
  } | null;
  metaAddressValidation: MetaAddressValidation;
  localDerivationTest: LocalDerivationTest;
  trustBoundaries: TrustBoundaries;
  warnings: string[];
  /** Properties that could not be established. Never silently treated as pass. */
  unknowns: string[];
  /**
   * Structured diagnostics for programmatic consumers such as the agent layer.
   * Additive and optional: the rendered report and its schema version are unchanged.
   */
  diagnostics?: AuditDiagnostics;
}

/** Machine-readable reasons a property could not be established. */
export interface AuditDiagnostics {
  /** The name failed ENSIP-15 normalization, so nothing was resolved. */
  nameInvalid: boolean;
  /** The conventional address read threw (RPC or resolver failure). */
  addressResolutionFailed: boolean;
  /** The active resolver address could not be read. */
  resolverReadFailed: boolean;
  /** Record keys whose read threw. Reported as unreadable, never as absent. */
  recordReadFailures: string[];
}
