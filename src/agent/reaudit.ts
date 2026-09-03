/**
 * Re-audit after a human wallet action.
 *
 * The server is stateless, so a prior report is never "verified": the caller
 * may pass the prior status and finding codes, and the result says plainly
 * that these were supplied, not validated.
 */
import type { AuditClient } from '../audit/auditEnsName';
import { auditForAgent, type AuditForAgentOptions } from './auditForAgent';
import { FINDING_CATALOGUE, FINDING_CODES, type FindingCode } from './findings';
import { isReportId } from './canonicalReport';
import { REAUDIT_SCHEMA_VERSION, type AgentStatus, type ReauditResult } from './types';

export interface ReauditOptions extends Omit<AuditForAgentOptions, 'technicalEvidence'> {
  priorStatus?: AgentStatus;
  priorReportId?: string;
  priorFindingCodes?: string[];
}

const STATUS_RANK: Record<AgentStatus, number> = {
  unknown: 0,
  misconfigured: 1,
  incomplete: 1,
  'private-ready': 2,
};

/** Findings an earlier audit with the given status would have carried. */
export function inferPriorFindingCodes(status: AgentStatus): FindingCode[] {
  switch (status) {
    case 'incomplete':
      return ['STEALTH_RECORD_MISSING', 'STATIC_ADDRESS_EXPOSED'];
    case 'misconfigured':
      return ['STEALTH_RECORD_MALFORMED', 'STATIC_ADDRESS_EXPOSED'];
    case 'private-ready':
      return ['STATIC_ADDRESS_EXPOSED'];
    default:
      return [];
  }
}

function isFindingCode(value: string): value is FindingCode {
  return (FINDING_CODES as readonly string[]).includes(value);
}

/** Only observed, non-informational findings count as "to resolve". */
function actionable(codes: FindingCode[]): FindingCode[] {
  return codes.filter((code) => {
    const def = FINDING_CATALOGUE[code];
    return def.evidence === 'observed' && def.severity !== 'info';
  });
}

export async function reauditForAgent(
  client: AuditClient,
  name: string,
  options: ReauditOptions,
): Promise<ReauditResult> {
  const current = await auditForAgent(client, name, {
    chainId: options.chainId,
    observation: options.observation,
    webBaseUrl: options.webBaseUrl,
    now: options.now,
  });

  const suppliedCodes = (options.priorFindingCodes ?? []).filter(isFindingCode);
  let priorCodes: FindingCode[] | null = null;
  let source: ReauditResult['prior']['source'] = 'none';
  if (options.priorFindingCodes && suppliedCodes.length > 0) {
    priorCodes = suppliedCodes;
    source = 'supplied-codes';
  } else if (options.priorStatus) {
    priorCodes = inferPriorFindingCodes(options.priorStatus);
    source = 'inferred-from-status';
  }

  const currentCodes = current.findings.map((f) => f.code);
  const currentActionable = actionable(currentCodes);
  const priorActionable = priorCodes ? actionable(priorCodes) : [];
  const resolvedFindings = priorActionable.filter((c) => !currentCodes.includes(c));
  const remainingFindings = currentActionable.filter(
    (c) => priorCodes === null || priorActionable.includes(c),
  );
  const newFindings = currentActionable.filter(
    (c) => priorCodes !== null && !priorActionable.includes(c),
  );

  const from = options.priorStatus ?? null;
  const improved =
    from === null ? null : STATUS_RANK[current.status] > STATUS_RANK[from];

  const priorId = options.priorReportId ?? null;
  const stillPublic = current.findings
    .filter((f) => f.evidence === 'model')
    .map((f) => f.title);

  const summary = [
    from
      ? `Status went from ${from} to ${current.status}${improved ? ' (improved)' : improved === false && from === current.status ? ' (unchanged)' : ''}.`
      : `Current status: ${current.status}. No prior status was supplied, so no change is claimed.`,
    resolvedFindings.length
      ? `Resolved: ${resolvedFindings.join(', ')}.`
      : 'No prior finding is confirmed resolved.',
    remainingFindings.length ? `Remaining: ${remainingFindings.join(', ')}.` : 'Nothing actionable remains.',
    newFindings.length ? `Newly observed: ${newFindings.join(', ')}.` : '',
    'Still public regardless: amounts, sender identity, history, name ownership and timing.',
    current.status === 'private-ready'
      ? 'Privacy applies only to payments from compatible senders. This is not anonymity.'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    schemaVersion: REAUDIT_SCHEMA_VERSION,
    generatedAt: current.generatedAt,
    name: current.name,
    chainId: current.chainId,
    current,
    prior: {
      reportId: priorId && isReportId(priorId) ? priorId : null,
      status: from,
      findingCodes: priorCodes,
      source,
      verified: false,
      note:
        'The prior report was supplied by the caller and was not validated: this server keeps ' +
        'no state. Resolved and remaining findings compare the supplied or inferred prior ' +
        'codes with the fresh audit.',
    },
    statusChange: { from, to: current.status, improved },
    resolvedFindings,
    remainingFindings,
    newFindings,
    newWarnings: current.warnings,
    stillPublic,
    summary,
  };
}
