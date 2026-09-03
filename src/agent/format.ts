/**
 * Concise plain-text renderings of agent results, shared by the MCP tools
 * (as the text fallback) and the CLI (as the human-readable output).
 *
 * Only template text and report fields that are themselves sanitised appear
 * here; no raw chain string is ever formatted into these lines.
 */
import type {
  AgentPrivacyReport,
  EvidenceVerification,
  ReauditResult,
  UpgradePlan,
} from './types';

export const NOT_ANONYMITY =
  'This is forward recipient-address privacy for compatible senders, not anonymity. Amounts, ' +
  'sender identity, timing, history and name ownership stay public.';

export function auditText(report: AgentPrivacyReport): string {
  const lines = [
    `GhostName audit of ${report.name} (chain ${report.chainId}): ${report.status.toUpperCase()}`,
    report.summary,
    '',
    'Findings:',
    ...report.findings.map(
      (f) =>
        `- ${f.code} [${f.severity}, ${f.evidence}]${f.recordKey ? ` key=${f.recordKey}` : ''}: ${f.title}`,
    ),
    '',
    'Recommended actions:',
    ...report.recommendedActions.map(
      (a) =>
        `- ${a.code} (${a.status}, priority ${a.priority}${a.humanActionRequired ? ', human wallet action required' : ''}): ${a.title}`,
    ),
  ];
  if (report.unknowns.length) {
    lines.push('', 'Unknown, not assumed:', ...report.unknowns.map((u) => `- ${u}`));
  }
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
    ...plan.prerequisites.map(
      (p) => `- ${p.code}: ${p.state}${p.humanCheck ? ' (human check)' : ''}. ${p.detail}`,
    ),
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
    checks.length
      ? [`${label}:`, ...checks.map((c) => `- ${c.id}: ${c.label}`)]
      : [`${label}: none`];
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
