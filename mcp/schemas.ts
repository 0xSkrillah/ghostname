/**
 * Zod schemas for every MCP tool input and output.
 *
 * Inputs are strict: unknown fields such as `rpcUrl` are rejected, and the
 * chain id is a closed union of the server allowlist. Outputs mirror the
 * agent types field for field so `structuredContent` can be validated by the
 * SDK before it is sent and by tests after it is received.
 */
import * as z from 'zod';
import { ACTION_CODES, FINDING_CODES } from '../src/agent/findings';
import type {
  AgentPrivacyReport,
  EvidenceVerification,
  ReauditResult,
  UpgradePlan,
} from '../src/agent/types';

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

export const ChainIdSchema = z
  .union([z.literal(1), z.literal(11155111)])
  .describe('Chain id. Only Ethereum mainnet (1) and Sepolia (11155111) are supported.');

export const EnsNameSchema = z
  .string()
  .min(1)
  .max(253)
  .describe('ENS name to audit, for example name.eth. Normalized under ENSIP-15.');

export const TxHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'Expected a 32-byte 0x-prefixed transaction hash.')
  .describe('Transaction hash.');

export const AddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Expected a 20-byte 0x-prefixed address.');

export const ReportIdSchema = z
  .string()
  .regex(/^gcr1_[0-9a-f]{32}$/, 'Expected a GhostName report id such as gcr1_<32 hex chars>.');

const StatusSchema = z.enum(['private-ready', 'incomplete', 'misconfigured', 'unknown']);
const SeveritySchema = z.enum(['critical', 'warning', 'info']);
const EvidenceSchema = z.enum(['observed', 'model', 'unknown']);
const FindingCodeSchema = z.enum(FINDING_CODES);
const ActionCodeSchema = z.enum(ACTION_CODES);
const RecordStatusSchema = z.enum(['absent', 'present-valid', 'present-invalid', 'unreadable']);
const RecordKindSchema = z.enum(['default', 'chain-specific']);

export const FindingSchema = z.object({
  code: FindingCodeSchema,
  severity: SeveritySchema,
  evidence: EvidenceSchema,
  title: z.string(),
  detail: z.string(),
  recordKey: z.string().optional(),
});

export const RecommendedActionSchema = z.object({
  code: ActionCodeSchema,
  title: z.string(),
  reason: z.string(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  humanActionRequired: z.boolean(),
  status: z.enum(['open', 'advisory', 'satisfied']),
  safeNextStep: z.string(),
});

const ObservationSchema = z.object({
  mode: z.enum(['local', 'remote']),
  rpcSource: z.enum(['user-configured', 'built-in-public-default', 'injected']),
  visibleTo: z.array(z.string()),
  note: z.string(),
});

const ResolverSchema = z.object({
  address: z.string().nullable(),
  provenance: z.enum(['direct', 'inherited-or-wildcard', 'unknown']),
  note: z.string(),
});

const RecordSelectionSchema = z.object({
  selectedKey: z.string().nullable(),
  selectedKind: RecordKindSchema.nullable(),
  precedenceNote: z.string(),
  sourcesChecked: z.array(
    z.object({
      key: z.string(),
      kind: RecordKindSchema,
      normative: z.boolean(),
      status: RecordStatusSchema,
    }),
  ),
});

const DerivationCheckSchema = z.object({
  ran: z.boolean(),
  trials: z.number().int().min(0),
  allDistinct: z.boolean(),
  derivationPath: z.enum(['local-client', 'gateway-or-ccip', 'unknown']),
  proves: z.string(),
});

const SecureHandoffSchema = z.object({
  available: z.boolean(),
  url: z.string().nullable(),
  containsOnly: z.array(z.string()),
  note: z.string(),
});

const TechnicalEvidenceSchema = z.object({
  label: z.literal('untrusted-public-chain-data'),
  warning: z.string(),
  conventionalAddress: z.string().nullable(),
  resolverAddress: z.string().nullable(),
  records: z.array(
    z.object({
      key: z.string(),
      status: RecordStatusSchema,
      normative: z.boolean(),
      value: z.string().nullable(),
      truncated: z.boolean(),
      parseError: z.string().nullable(),
    }),
  ),
  spendingPublicKey: z.string().nullable(),
  viewingPublicKey: z.string().nullable(),
  omitted: z.array(z.string()),
});

/* ------------------------------------------------------------------ */
/* Outputs                                                             */
/* ------------------------------------------------------------------ */

export const AgentPrivacyReportSchema = z.object({
  schemaVersion: z.literal(1),
  reportId: ReportIdSchema,
  generatedAt: z.string(),
  observation: ObservationSchema,
  name: z.string(),
  chainId: ChainIdSchema,
  status: StatusSchema,
  summary: z.string(),
  findings: z.array(FindingSchema),
  resolver: ResolverSchema,
  recordSelection: RecordSelectionSchema,
  derivationCheck: DerivationCheckSchema,
  compatibleSenderRequired: z.boolean(),
  recommendedActions: z.array(RecommendedActionSchema),
  warnings: z.array(z.string()),
  unknowns: z.array(z.string()),
  protected: z.array(z.string()),
  notProtected: z.array(z.string()),
  secureHandoff: SecureHandoffSchema,
  technicalEvidence: TechnicalEvidenceSchema.optional(),
}) satisfies z.ZodType<AgentPrivacyReport>;

export const UpgradePlanSchema = z.object({
  schemaVersion: z.literal(1),
  planId: z.string().regex(/^gup1_[0-9a-f]{32}$/),
  generatedAt: z.string(),
  name: z.string(),
  chainId: ChainIdSchema,
  basedOn: z.object({
    reportId: ReportIdSchema,
    status: StatusSchema,
    freshAudit: z.literal(true),
    note: z.string(),
  }),
  suppliedReportId: z.object({
    value: z.string().nullable(),
    verified: z.literal(false),
    note: z.string(),
  }),
  alreadyConforming: z.boolean(),
  prerequisites: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      state: z.enum(['pass', 'fail', 'unknown']),
      detail: z.string(),
      humanCheck: z.boolean(),
    }),
  ),
  requiredRecordKey: z.string(),
  alternativeRecordKey: z.string(),
  recordValueFormat: z.string(),
  findingsToResolve: z.array(FindingSchema),
  recommendedActions: z.array(RecommendedActionSchema),
  steps: z.array(
    z.object({
      order: z.number().int(),
      actor: z.enum(['human', 'web', 'agent']),
      title: z.string(),
      detail: z.string(),
    }),
  ),
  privacyLimitations: z.array(z.string()),
  handoff: SecureHandoffSchema,
  notDoneByThisTool: z.array(z.string()),
}) satisfies z.ZodType<UpgradePlan>;

export const ReauditResultSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  name: z.string(),
  chainId: ChainIdSchema,
  current: AgentPrivacyReportSchema,
  prior: z.object({
    reportId: z.string().nullable(),
    status: StatusSchema.nullable(),
    findingCodes: z.array(FindingCodeSchema).nullable(),
    source: z.enum(['supplied-codes', 'inferred-from-status', 'none']),
    verified: z.literal(false),
    note: z.string(),
  }),
  statusChange: z.object({
    from: StatusSchema.nullable(),
    to: StatusSchema,
    improved: z.boolean().nullable(),
  }),
  resolvedFindings: z.array(FindingCodeSchema),
  remainingFindings: z.array(FindingCodeSchema),
  newFindings: z.array(FindingCodeSchema),
  newWarnings: z.array(z.string()),
  stillPublic: z.array(z.string()),
  summary: z.string(),
}) satisfies z.ZodType<ReauditResult>;

const EvidenceCheckSchema = z.object({ id: z.string(), label: z.string(), detail: z.string() });

export const EvidenceVerificationSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.enum(['payment-and-announcement', 'sponsored-exit']),
  generatedAt: z.string(),
  chainId: ChainIdSchema,
  transactions: z.record(z.string(), z.string()),
  explorerUrls: z.record(z.string(), z.string()),
  verified: z.boolean(),
  verifiedChecks: z.array(EvidenceCheckSchema),
  failedChecks: z.array(EvidenceCheckSchema),
  unknownChecks: z.array(EvidenceCheckSchema),
  publicFacts: z.record(z.string(), z.string().nullable()),
  notProven: z.array(z.string()),
  summary: z.string(),
  error: z.string().optional(),
}) satisfies z.ZodType<EvidenceVerification>;

/* ------------------------------------------------------------------ */
/* Inputs (strict: unknown fields rejected)                            */
/* ------------------------------------------------------------------ */

export const AuditInputSchema = z.strictObject({
  name: EnsNameSchema,
  chainId: ChainIdSchema,
  technicalEvidence: z
    .boolean()
    .default(false)
    .describe(
      'When true, include escaped public resolver and record values in a labelled ' +
        'technical-evidence block. Never includes keys, signatures or sample addresses.',
    ),
});

export const PrepareUpgradeInputSchema = z.strictObject({
  name: EnsNameSchema,
  chainId: ChainIdSchema,
  reportId: ReportIdSchema.optional().describe(
    'Report id from a previous audit. Echoed for reference; a fresh audit is always run.',
  ),
});

export const ReauditInputSchema = z.strictObject({
  name: EnsNameSchema,
  chainId: ChainIdSchema,
  priorStatus: StatusSchema.optional().describe('Status reported by the earlier audit.'),
  priorReportId: ReportIdSchema.optional().describe('Report id of the earlier audit.'),
  priorFindingCodes: z
    .array(FindingCodeSchema)
    .max(64)
    .optional()
    .describe('Finding codes from the earlier audit, used to compute what was resolved.'),
});

export const VerifyPaymentInputSchema = z.strictObject({
  chainId: ChainIdSchema,
  paymentTxHash: TxHashSchema.describe('The ETH transfer to the one-time stealth address.'),
  announcementTxHash: TxHashSchema.describe('The ERC-5564 announcement transaction.'),
});

export const VerifySponsoredExitInputSchema = z.strictObject({
  chainId: ChainIdSchema,
  txHash: TxHashSchema.describe('The sponsored EIP-7702 sweep transaction.'),
  expectedExecutor: AddressSchema.optional().describe(
    'Executor the delegation must point at. Required on mainnet; defaults to the deployed ' +
      'Sepolia demo executor otherwise.',
  ),
});

/** JSON Schema documents served as MCP resources. */
export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;
}
