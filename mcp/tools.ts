/**
 * The approved read-only tool catalogue.
 *
 * Every tool calls the same service functions as the CLI, returns
 * `structuredContent` that conforms to its `outputSchema`, and adds a concise
 * text summary for clients without structured-content rendering. Annotations
 * are hints for clients; the restrictions themselves are enforced by the
 * service layer, the import boundary and the tests.
 */
import type { McpServer } from '@modelcontextprotocol/server';
import { auditForAgent } from '../src/agent/auditForAgent';
import type { AgentObservation } from '../src/agent/types';
import type { ClientFactory, SupportedChainId } from '../src/agent/chains';
import { prepareUpgradePlan } from '../src/agent/upgradePlan';
import { reauditForAgent } from '../src/agent/reaudit';
import { sanitizeText } from '../src/agent/sanitize';
import { verifyPaymentForAgent, verifySponsoredExitForAgent } from '../src/agent/verify';
import type {
  AgentPrivacyReport,
  EvidenceVerification,
  ReauditResult,
  UpgradePlan,
} from '../src/agent/types';
import {
  AgentPrivacyReportSchema,
  AuditInputSchema,
  EvidenceVerificationSchema,
  PrepareUpgradeInputSchema,
  ReauditInputSchema,
  ReauditResultSchema,
  UpgradePlanSchema,
  VerifyPaymentInputSchema,
  VerifySponsoredExitInputSchema,
} from './schemas';

export const TOOL_NAMES = [
  'ghostname_audit_ens_privacy',
  'ghostname_prepare_upgrade',
  'ghostname_reaudit_ens_privacy',
  'ghostname_verify_payment',
  'ghostname_verify_sponsored_exit',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/** Every GhostName tool is read-only, non-destructive, idempotent and queries a public chain. */
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export interface ToolDeps {
  getClient: ClientFactory;
  observationFor: (chainId: SupportedChainId) => Partial<AgentObservation>;
  webBaseUrl: string;
  now?: () => Date;
}

const NOT_ANONYMITY =
  'This is forward recipient-address privacy for compatible senders, not anonymity. Amounts, ' +
  'sender identity, timing, history and name ownership stay public.';

function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: `GhostName tool error: ${sanitizeText(message, 300)}` }],
  };
}

function result<T extends object>(text: string, structured: T) {
  return {
    content: [
      { type: 'text' as const, text },
      { type: 'text' as const, text: JSON.stringify(structured) },
    ],
    structuredContent: structured,
  };
}

export function auditText(report: AgentPrivacyReport): string {
  const lines = [
    `GhostName audit of ${report.name} (chain ${report.chainId}): ${report.status.toUpperCase()}`,
    report.summary,
    '',
    'Findings:',
    ...report.findings.map(
      (f) => `- ${f.code} [${f.severity}, ${f.evidence}]${f.recordKey ? ` key=${f.recordKey}` : ''}: ${f.title}`,
    ),
    '',
    'Recommended actions:',
    ...report.recommendedActions.map(
      (a) =>
        `- ${a.code} (${a.status}, priority ${a.priority}${a.humanActionRequired ? ', human wallet action required' : ''}): ${a.title}`,
    ),
  ];
  if (report.unknowns.length) lines.push('', 'Unknown, not assumed:', ...report.unknowns.map((u) => `- ${u}`));
  lines.push(
    '',
    `Secure handoff: ${report.secureHandoff.url ?? 'not offered while the result is unknown'}`,
    `Report id: ${report.reportId}`,
    `Observation: ${report.observation.mode} mode, visible to ${report.observation.visibleTo.join(' and ')}.`,
    NOT_ANONYMITY,
  );
  return lines.join('\n');
}

export function planText(plan: UpgradePlan): string {
  const lines = [
    `GhostName upgrade plan for ${plan.name} (chain ${plan.chainId}); current status ${plan.basedOn.status}`,
    plan.alreadyConforming
      ? 'The name is already private-ready. Publishing again would rotate the identity.'
      : `Record to publish: ${plan.requiredRecordKey} (alternative ${plan.alternativeRecordKey}).`,
    `Value format: ${plan.recordValueFormat}`,
    '',
    'Prerequisites:',
    ...plan.prerequisites.map((p) => `- ${p.code}: ${p.state}${p.humanCheck ? ' (human check)' : ''}. ${p.detail}`),
    '',
    'Findings to resolve:',
    ...(plan.findingsToResolve.length
      ? plan.findingsToResolve.map((f) => `- ${f.code}: ${f.title}`)
      : ['- none']),
    '',
    'Steps:',
    ...plan.steps.map((s) => `${s.order}. [${s.actor}] ${s.title}. ${s.detail}`),
    '',
    `Secure handoff: ${plan.handoff.url ?? 'not offered while the audit result is unknown'}`,
    `This tool did not: ${plan.notDoneByThisTool.join('; ')}.`,
    `Plan id: ${plan.planId}. Based on fresh audit ${plan.basedOn.reportId}.`,
    NOT_ANONYMITY,
  ];
  return lines.join('\n');
}

export function reauditText(res: ReauditResult): string {
  return [
    `GhostName re-audit of ${res.name} (chain ${res.chainId}): ${res.current.status.toUpperCase()}`,
    res.summary,
    `Prior report: ${res.prior.reportId ?? 'none supplied'} (${res.prior.source}, not validated).`,
    `Resolved: ${res.resolvedFindings.join(', ') || 'none'}.`,
    `Remaining: ${res.remainingFindings.join(', ') || 'none'}.`,
    `Newly observed: ${res.newFindings.join(', ') || 'none'}.`,
    `Still public: ${res.stillPublic.join('; ')}.`,
    `Current report id: ${res.current.reportId}`,
    NOT_ANONYMITY,
  ].join('\n');
}

export function evidenceText(ev: EvidenceVerification): string {
  const list = (label: string, checks: EvidenceVerification['verifiedChecks']) =>
    checks.length ? [`${label}:`, ...checks.map((c) => `- ${c.id}: ${c.label}`)] : [`${label}: none`];
  return [
    `GhostName ${ev.kind} verification on chain ${ev.chainId}: ${ev.verified ? 'VERIFIED' : 'NOT VERIFIED'}`,
    ev.summary,
    ...list('Verified', ev.verifiedChecks),
    ...list('Failed', ev.failedChecks),
    ...list('Unknown', ev.unknownChecks),
    'Not proven:',
    ...ev.notProven.map((n) => `- ${n}`),
    ...Object.entries(ev.explorerUrls).map(([k, v]) => `${k}: ${v}`),
  ].join('\n');
}

export function registerGhostNameTools(server: McpServer, deps: ToolDeps): void {
  const common = (chainId: SupportedChainId) => ({
    chainId,
    observation: deps.observationFor(chainId),
    webBaseUrl: deps.webBaseUrl,
    now: deps.now,
  });

  server.registerTool(
    'ghostname_audit_ens_privacy',
    {
      title: 'Audit ENS privacy readiness',
      description:
        'Read-only GhostCheck audit of an ENS name against the ENS stealth-resolution ' +
        'convention (ERC-5564 scheme 1). Returns stable finding codes, recommended actions, ' +
        'unknowns and a secure human handoff. Never reads or returns keys. RPC failures ' +
        'return status unknown, never a pass. A pass means private-ready for compatible ' +
        'senders, not anonymity.',
      inputSchema: AuditInputSchema,
      outputSchema: AgentPrivacyReportSchema,
      annotations: { ...READ_ONLY_ANNOTATIONS, title: 'Audit ENS privacy readiness' },
    },
    async ({ name, chainId, technicalEvidence }) => {
      try {
        const report = await auditForAgent(deps.getClient(chainId), name, {
          ...common(chainId),
          technicalEvidence,
        });
        return result(auditText(report), report);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'ghostname_prepare_upgrade',
    {
      title: 'Prepare a secure upgrade handoff',
      description:
        'Prepares a non-secret upgrade plan for publishing a stealth meta-address record: ' +
        'prerequisite checks, the required record key, findings to resolve, privacy ' +
        'limitations and a secure web handoff URL. Runs a fresh audit. Does not generate ' +
        'keys, does not return a record value, does not create calldata, does not touch a ' +
        'wallet and does not write anything. The human completes the upgrade in their own ' +
        'browser and wallet.',
      inputSchema: PrepareUpgradeInputSchema,
      outputSchema: UpgradePlanSchema,
      annotations: { ...READ_ONLY_ANNOTATIONS, title: 'Prepare a secure upgrade handoff' },
    },
    async ({ name, chainId, reportId }) => {
      try {
        const plan = await prepareUpgradePlan(deps.getClient(chainId), name, {
          ...common(chainId),
          reportId,
        });
        return result(planText(plan), plan);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'ghostname_reaudit_ens_privacy',
    {
      title: 'Re-audit after the human wallet action',
      description:
        'Runs a fresh audit and compares it with a prior status or prior finding codes ' +
        'supplied by the caller, reporting resolved, remaining and newly observed findings. ' +
        'The prior report is never treated as validated: this server keeps no state.',
      inputSchema: ReauditInputSchema,
      outputSchema: ReauditResultSchema,
      annotations: { ...READ_ONLY_ANNOTATIONS, title: 'Re-audit after the human wallet action' },
    },
    async ({ name, chainId, priorStatus, priorReportId, priorFindingCodes }) => {
      try {
        const res = await reauditForAgent(deps.getClient(chainId), name, {
          ...common(chainId),
          priorStatus,
          priorReportId,
          priorFindingCodes,
        });
        return result(reauditText(res), res);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'ghostname_verify_payment',
    {
      title: 'Verify a stealth payment and its announcement',
      description:
        'Re-derives from public chain data that a payment funded a one-time address and that ' +
        'an ERC-5564 announcement names that same address. Returns verified, failed and ' +
        'unknown checks plus a not-proven list. Recognition of the payment needs the private ' +
        'viewing key, which this tool never requests, so it is listed as not proven.',
      inputSchema: VerifyPaymentInputSchema,
      outputSchema: EvidenceVerificationSchema,
      annotations: { ...READ_ONLY_ANNOTATIONS, title: 'Verify a stealth payment and its announcement' },
    },
    async ({ chainId, paymentTxHash, announcementTxHash }) => {
      try {
        const ev = await verifyPaymentForAgent(deps.getClient(chainId), {
          chainId,
          paymentTxHash,
          announcementTxHash,
          now: deps.now,
        });
        return result(evidenceText(ev), ev);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    'ghostname_verify_sponsored_exit',
    {
      title: 'Verify a sponsored EIP-7702 exit',
      description:
        'Re-derives from public chain data that a stealth address was swept by a sponsored ' +
        'EIP-7702 transaction: sponsor paid gas, delegation targets the expected executor, ' +
        'calldata binds the destination, the intent signature recovers to the stealth ' +
        'address. Read-only. No execution, no signature creation.',
      inputSchema: VerifySponsoredExitInputSchema,
      outputSchema: EvidenceVerificationSchema,
      annotations: { ...READ_ONLY_ANNOTATIONS, title: 'Verify a sponsored EIP-7702 exit' },
    },
    async ({ chainId, txHash, expectedExecutor }) => {
      try {
        const ev = await verifySponsoredExitForAgent(deps.getClient(chainId), {
          chainId,
          txHash,
          expectedExecutor,
          now: deps.now,
        });
        return result(evidenceText(ev), ev);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
