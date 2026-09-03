/**
 * Agent-safe report types.
 *
 * These are the only shapes handed to a language model. They carry stable
 * codes and template text, never secret material, and no raw chain string
 * outside the explicitly labelled `technicalEvidence` block.
 *
 * There is deliberately no numeric privacy score.
 */
import type {
  ActionCode,
  ActionStatus,
  FindingCode,
  FindingEvidence,
  FindingSeverity,
} from './findings';
import type { RpcSource, SupportedChainId } from './chains';

export const AGENT_REPORT_SCHEMA_VERSION = 1 as const;
export const UPGRADE_PLAN_SCHEMA_VERSION = 1 as const;
export const REAUDIT_SCHEMA_VERSION = 1 as const;
export const EVIDENCE_SCHEMA_VERSION = 1 as const;

export type AgentStatus = 'private-ready' | 'incomplete' | 'misconfigured' | 'unknown';

export interface AgentFinding {
  code: FindingCode;
  severity: FindingSeverity;
  evidence: FindingEvidence;
  title: string;
  detail: string;
  /** The ENS text-record key concerned. Always one of GhostName's own keys. */
  recordKey?: string;
}

export interface RecommendedAction {
  code: ActionCode;
  title: string;
  reason: string;
  priority: 1 | 2 | 3;
  humanActionRequired: boolean;
  status: ActionStatus;
  safeNextStep: string;
}

export interface AgentObservation {
  /** local: user's own RPC, nothing leaves the machine except RPC reads. */
  mode: 'local' | 'remote';
  rpcSource: RpcSource;
  /** Who can observe that this name was queried. */
  visibleTo: string[];
  note: string;
}

export interface AgentResolverInfo {
  address: string | null;
  provenance: 'direct' | 'inherited-or-wildcard' | 'unknown';
  note: string;
}

export type RecordSourceStatus = 'absent' | 'present-valid' | 'present-invalid' | 'unreadable';

export interface AgentRecordSource {
  key: string;
  kind: 'default' | 'chain-specific';
  normative: boolean;
  status: RecordSourceStatus;
}

export interface AgentRecordSelection {
  selectedKey: string | null;
  selectedKind: 'default' | 'chain-specific' | null;
  precedenceNote: string;
  sourcesChecked: AgentRecordSource[];
}

export interface AgentDerivationCheck {
  ran: boolean;
  trials: number;
  allDistinct: boolean;
  derivationPath: 'local-client' | 'gateway-or-ccip' | 'unknown';
  proves: string;
}

export interface SecureHandoff {
  available: boolean;
  url: string | null;
  /** The only query parameters the URL can ever contain. */
  containsOnly: string[];
  note: string;
}

export interface TechnicalEvidenceRecord {
  key: string;
  status: RecordSourceStatus;
  normative: boolean;
  /** Escaped, length-capped public record value. Untrusted data. */
  value: string | null;
  truncated: boolean;
  parseError: string | null;
}

export interface TechnicalEvidence {
  label: 'untrusted-public-chain-data';
  warning: string;
  conventionalAddress: string | null;
  resolverAddress: string | null;
  records: TechnicalEvidenceRecord[];
  spendingPublicKey: string | null;
  viewingPublicKey: string | null;
  /** Material that is never included, even in evidence mode. */
  omitted: string[];
}

export interface AgentPrivacyReport {
  schemaVersion: typeof AGENT_REPORT_SCHEMA_VERSION;
  reportId: string;
  generatedAt: string;
  observation: AgentObservation;
  name: string;
  chainId: SupportedChainId;
  status: AgentStatus;
  summary: string;
  findings: AgentFinding[];
  resolver: AgentResolverInfo;
  recordSelection: AgentRecordSelection;
  derivationCheck: AgentDerivationCheck;
  compatibleSenderRequired: boolean;
  recommendedActions: RecommendedAction[];
  warnings: string[];
  unknowns: string[];
  protected: string[];
  notProtected: string[];
  secureHandoff: SecureHandoff;
  technicalEvidence?: TechnicalEvidence;
}

export type PrerequisiteState = 'pass' | 'fail' | 'unknown';

export interface Prerequisite {
  code: string;
  label: string;
  state: PrerequisiteState;
  detail: string;
  /** Only the human can establish this one. */
  humanCheck: boolean;
}

export interface UpgradeStep {
  order: number;
  actor: 'human' | 'web' | 'agent';
  title: string;
  detail: string;
}

export interface UpgradePlan {
  schemaVersion: typeof UPGRADE_PLAN_SCHEMA_VERSION;
  planId: string;
  generatedAt: string;
  name: string;
  chainId: SupportedChainId;
  /** The fresh audit this plan is based on. Always produced by this call. */
  basedOn: { reportId: string; status: AgentStatus; freshAudit: true; note: string };
  /** A caller-supplied id is echoed but never trusted: the server keeps no state. */
  suppliedReportId: { value: string | null; verified: false; note: string };
  alreadyConforming: boolean;
  prerequisites: Prerequisite[];
  requiredRecordKey: string;
  alternativeRecordKey: string;
  recordValueFormat: string;
  findingsToResolve: AgentFinding[];
  recommendedActions: RecommendedAction[];
  steps: UpgradeStep[];
  privacyLimitations: string[];
  handoff: SecureHandoff;
  notDoneByThisTool: string[];
}

export interface ReauditResult {
  schemaVersion: typeof REAUDIT_SCHEMA_VERSION;
  generatedAt: string;
  name: string;
  chainId: SupportedChainId;
  current: AgentPrivacyReport;
  prior: {
    reportId: string | null;
    status: AgentStatus | null;
    findingCodes: FindingCode[] | null;
    source: 'supplied-codes' | 'inferred-from-status' | 'none';
    verified: false;
    note: string;
  };
  statusChange: { from: AgentStatus | null; to: AgentStatus; improved: boolean | null };
  resolvedFindings: FindingCode[];
  remainingFindings: FindingCode[];
  newFindings: FindingCode[];
  newWarnings: string[];
  stillPublic: string[];
  summary: string;
}

export interface EvidenceCheck {
  id: string;
  label: string;
  detail: string;
}

export interface EvidenceVerification {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  kind: 'payment-and-announcement' | 'sponsored-exit';
  generatedAt: string;
  chainId: SupportedChainId;
  transactions: Record<string, string>;
  explorerUrls: Record<string, string>;
  verified: boolean;
  verifiedChecks: EvidenceCheck[];
  failedChecks: EvidenceCheck[];
  unknownChecks: EvidenceCheck[];
  publicFacts: Record<string, string | null>;
  notProven: string[];
  summary: string;
  error?: string;
}
