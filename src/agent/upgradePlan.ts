/**
 * Non-secret upgrade plan.
 *
 * This module prepares a human handoff. It does not, and structurally cannot,
 * generate identity keys or a stealth meta-address, return a record value,
 * create calldata, request a wallet, or write a record. Every plan is based on
 * a fresh audit run by this call; a caller-supplied report id is echoed but
 * never trusted because the server keeps no state to validate it against.
 */
import type { AuditClient } from '../audit/auditEnsName';
import { chainSpecificRecordKey, defaultRecordKey, evmCoinType } from '../audit/records';
import { auditForAgent, type AuditForAgentOptions } from './auditForAgent';
import { computePlanId, isReportId } from './canonicalReport';
import { FINDING_CATALOGUE, MODEL_LIMITATION_CODES } from './findings';
import {
  UPGRADE_PLAN_SCHEMA_VERSION,
  type AgentPrivacyReport,
  type Prerequisite,
  type UpgradePlan,
  type UpgradeStep,
} from './types';

export const NOT_DONE_BY_THIS_TOOL = [
  'generate GhostName identity keys',
  'generate a stealth meta-address',
  'return a record value',
  'create calldata',
  'request or connect a wallet',
  'sign anything',
  'write an ENS record or switch a resolver',
] as const;

export interface PrepareUpgradeOptions extends Omit<AuditForAgentOptions, 'technicalEvidence'> {
  /** A report id the caller holds. Echoed, never trusted. */
  reportId?: string;
}

export async function prepareUpgradePlan(
  client: AuditClient,
  name: string,
  options: PrepareUpgradeOptions,
): Promise<UpgradePlan> {
  const audit = await auditForAgent(client, name, {
    chainId: options.chainId,
    observation: options.observation,
    webBaseUrl: options.webBaseUrl,
    now: options.now,
  });
  return upgradePlanFromReport(audit, { suppliedReportId: options.reportId ?? null });
}

function prerequisitesOf(audit: AgentPrivacyReport): Prerequisite[] {
  const nameInvalid = audit.findings.some((f) => f.code === 'NAME_INVALID');
  return [
    {
      code: 'NAME_VALID',
      label: 'The name is a valid ENS name',
      state: nameInvalid ? 'fail' : 'pass',
      detail: nameInvalid
        ? 'The name failed ENSIP-15 normalization.'
        : 'The name normalized under ENSIP-15.',
      humanCheck: false,
    },
    {
      code: 'CHAIN_SUPPORTED',
      label: 'The chain is on the server allowlist',
      state: 'pass',
      detail: 'Only Ethereum mainnet (1) and Sepolia (11155111) are reachable.',
      humanCheck: false,
    },
    {
      code: 'AUDIT_CURRENT',
      label: 'A fresh audit completed',
      state: audit.status === 'unknown' ? 'unknown' : 'pass',
      detail:
        audit.status === 'unknown'
          ? 'The audit result is unknown, so the plan cannot say what needs to change.'
          : `Current status: ${audit.status}.`,
      humanCheck: false,
    },
    {
      code: 'RESOLVER_PRESENT',
      label: 'The name has a readable resolver',
      state: audit.resolver.address ? 'pass' : 'unknown',
      detail: audit.resolver.address
        ? 'A resolver address was read. The handoff page discovers it again at transaction time.'
        : 'The resolver address was not readable here. The handoff page discovers it live and ' +
          'refuses to publish if none is set.',
      humanCheck: false,
    },
    {
      code: 'WALLET_CONTROLS_NAME',
      label: 'The connected wallet owns or manages the name',
      state: 'unknown',
      detail:
        'Only the human can confirm this by connecting the controlling wallet on the handoff ' +
        'page. The agent never sees or holds that wallet.',
      humanCheck: true,
    },
    {
      code: 'NETWORK_INTENT_CONFIRMED',
      label: 'The human understands which network the record will be written to',
      state: 'unknown',
      detail:
        audit.chainId === 1
          ? 'Mainnet writes are blocked in the shipped build. A guarded build requires a typed ' +
            'per-action confirmation and spends real ETH.'
          : 'Sepolia is the default write network for the demo. Test ETH only.',
      humanCheck: true,
    },
  ];
}

function stepsOf(audit: AgentPrivacyReport): UpgradeStep[] {
  const steps: UpgradeStep[] = [
    {
      order: 1,
      actor: 'human',
      title: 'Open the secure web handoff',
      detail:
        'Open the handoff URL in a browser. It carries only the name, chain id, source, ' +
        'report id and version.',
    },
    {
      order: 2,
      actor: 'web',
      title: 'Generate identity keys locally',
      detail:
        'The page states that key generation happens outside the AI agent, then generates ' +
        'the spending and viewing keys in the browser with a CSPRNG. Nothing is uploaded.',
    },
    {
      order: 3,
      actor: 'web',
      title: 'Re-resolve the name and discover the resolver',
      detail:
        'The page ignores any status in the URL, resolves the name again live, and discovers ' +
        'the current resolver at transaction time.',
    },
    {
      order: 4,
      actor: 'human',
      title: 'Approve the wallet transaction',
      detail:
        'Connect the wallet that controls the name, read the warning, and approve the ' +
        'setText transaction for the stealth-meta-address record.',
    },
    {
      order: 5,
      actor: 'human',
      title: 'Back up the identity, away from the agent',
      detail:
        'Download the identity backup or an encrypted capsule. Never paste keys into an ' +
        'agent conversation.',
    },
    {
      order: 6,
      actor: 'agent',
      title: 'Re-audit and explain',
      detail:
        'Call ghostname_reaudit_ens_privacy with the prior report id and status, then explain ' +
        'what improved and what remains public.',
    },
  ];
  if (audit.status === 'private-ready') {
    steps.splice(1, 0, {
      order: 0,
      actor: 'human',
      title: 'Decide whether a new record is needed',
      detail:
        'The name is already private-ready. Publishing again rotates the identity: payments ' +
        'to the old meta-address stay recoverable only with the old keys.',
    });
    steps.forEach((s, i) => (s.order = i + 1));
  }
  return steps;
}

export function upgradePlanFromReport(
  audit: AgentPrivacyReport,
  ctx: { suppliedReportId: string | null },
): UpgradePlan {
  const supplied = ctx.suppliedReportId;
  const plan: UpgradePlan = {
    schemaVersion: UPGRADE_PLAN_SCHEMA_VERSION,
    planId: '',
    generatedAt: audit.generatedAt,
    name: audit.name,
    chainId: audit.chainId,
    basedOn: {
      reportId: audit.reportId,
      status: audit.status,
      freshAudit: true,
      note: 'This plan is based on an audit run by this call, not on any supplied report.',
    },
    suppliedReportId: {
      value: supplied && isReportId(supplied) ? supplied : null,
      verified: false,
      note: supplied
        ? isReportId(supplied)
          ? 'A report id was supplied. This server keeps no state, so it was not validated. ' +
            'The plan uses the fresh audit above instead.'
          : 'The supplied report id is not a GhostName report id and was ignored.'
        : 'No prior report id was supplied.',
    },
    alreadyConforming: audit.status === 'private-ready',
    prerequisites: prerequisitesOf(audit),
    requiredRecordKey: defaultRecordKey(),
    alternativeRecordKey: chainSpecificRecordKey(evmCoinType(audit.chainId)),
    recordValueFormat:
      'st:eth:0x followed by a 33-byte compressed spending public key and a 33-byte ' +
      'compressed viewing public key. The value is produced in the browser handoff from keys ' +
      'generated there. This tool never produces it.',
    findingsToResolve: audit.findings.filter(
      (f) => f.evidence === 'observed' && f.severity !== 'info',
    ),
    recommendedActions: audit.recommendedActions,
    steps: stepsOf(audit),
    privacyLimitations: [
      FINDING_CATALOGUE.COMPATIBLE_SENDER_REQUIRED.detail,
      ...MODEL_LIMITATION_CODES.map((code) => FINDING_CATALOGUE[code].detail),
    ],
    handoff: audit.secureHandoff,
    notDoneByThisTool: [...NOT_DONE_BY_THIS_TOOL],
  };
  plan.planId = computePlanId(plan);
  return plan;
}
