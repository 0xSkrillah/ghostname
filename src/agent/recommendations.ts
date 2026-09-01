/**
 * Recommended actions derived from findings. Every action is a fixed template
 * and every one that touches chain state requires the human's wallet.
 */
import { ACTION_CATALOGUE, type ActionCode, type ActionStatus } from './findings';
import type { AgentFinding, AgentStatus, RecommendedAction } from './types';

export function makeAction(code: ActionCode, status: ActionStatus): RecommendedAction {
  const def = ACTION_CATALOGUE[code];
  return {
    code,
    title: def.title,
    reason: def.reason,
    priority: def.priority,
    humanActionRequired: def.humanActionRequired,
    status,
    safeNextStep: def.safeNextStep,
  };
}

const STATUS_ORDER: Record<ActionStatus, number> = { open: 0, advisory: 1, satisfied: 2 };

/** Deterministic action list: priority first, then open before advisory. */
export function deriveActions(findings: AgentFinding[], status: AgentStatus): RecommendedAction[] {
  const codes = new Set(findings.map((f) => f.code));
  const out: RecommendedAction[] = [];
  const add = (code: ActionCode, actionStatus: ActionStatus) => {
    if (!out.some((a) => a.code === code)) out.push(makeAction(code, actionStatus));
  };

  if (codes.has('NAME_INVALID')) {
    add('FIX_NAME', 'open');
    return out;
  }
  if (status === 'unknown') add('RETRY_WHEN_RPC_AVAILABLE', 'open');
  if (codes.has('STEALTH_RECORD_MISSING')) add('PUBLISH_STEALTH_RECORD', 'open');
  if (codes.has('STEALTH_RECORD_MALFORMED') || codes.has('LOCAL_DERIVATION_FAILED')) {
    add('REPLACE_MALFORMED_RECORD', 'open');
  }
  if (codes.has('LEGACY_RECORD_ONLY')) add('REPLACE_LEGACY_RECORD', 'open');
  if (codes.has('STEALTH_RECORD_CONFLICT')) add('RESOLVE_RECORD_CONFLICT', 'open');
  if (status === 'private-ready') {
    add('PUBLISH_STEALTH_RECORD', 'satisfied');
    add('USE_COMPATIBLE_SENDER', 'advisory');
    add('PLAN_SAFE_EXIT', 'advisory');
  }
  if (status !== 'unknown') add('PROTECT_KEYS', 'advisory');

  return out.sort(
    (a, b) => a.priority - b.priority || STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );
}
