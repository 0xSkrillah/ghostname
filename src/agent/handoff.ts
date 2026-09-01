/**
 * Secure web handoff parameters.
 *
 * The agent side (auditForAgent.buildHandoffUrl) can only ever emit five
 * parameters. This is the receiving side, used by the /create page: it
 * validates each one, ignores everything else by name, and never carries an
 * audit status, a record value, a key or a signature. The page resolves the
 * name again live; nothing here is trusted for the privacy result.
 */
import { normalizeEnsName } from '../ens/resolve';
import { HANDOFF_VERSION } from './auditForAgent';
import { isReportId } from './canonicalReport';
import { isSupportedChainId, type SupportedChainId } from './chains';

export interface HandoffParams {
  source: 'agent';
  name: string;
  chainId: SupportedChainId;
  reportId: string | null;
  version: number;
}

export type HandoffParseResult =
  | { ok: true; params: HandoffParams; ignored: string[] }
  | { ok: false; reason: string; ignored: string[] };

const ACCEPTED = ['name', 'chainId', 'source', 'reportId', 'version'] as const;

function read(search: URLSearchParams | Record<string, string | undefined>, key: string) {
  return search instanceof URLSearchParams ? search.get(key) : (search[key] ?? null);
}

function keys(search: URLSearchParams | Record<string, string | undefined>): string[] {
  return search instanceof URLSearchParams ? [...new Set(search.keys())] : Object.keys(search);
}

/**
 * Returns null when the query is not an agent handoff at all, so the page
 * behaves exactly as before. Otherwise validates strictly.
 */
export function parseHandoffParams(
  search: URLSearchParams | Record<string, string | undefined>,
): HandoffParseResult | null {
  if (read(search, 'source') !== 'agent') return null;
  const ignored = keys(search).filter((k) => !(ACCEPTED as readonly string[]).includes(k));

  const rawVersion = read(search, 'version');
  if (rawVersion !== String(HANDOFF_VERSION)) {
    return { ok: false, reason: `Unsupported handoff version "${(rawVersion ?? '').slice(0, 8)}".`, ignored };
  }

  let name: string;
  try {
    name = normalizeEnsName(read(search, 'name') ?? '');
    if (!name) throw new Error('empty');
  } catch {
    return { ok: false, reason: 'The name in the handoff link is not a valid ENS name.', ignored };
  }

  const chainId = Number(read(search, 'chainId'));
  if (!isSupportedChainId(chainId)) {
    return { ok: false, reason: 'The chain id in the handoff link is not supported.', ignored };
  }

  const rawReport = read(search, 'reportId');
  let reportId: string | null = null;
  if (rawReport !== null && rawReport !== '') {
    if (isReportId(rawReport)) reportId = rawReport;
    else ignored.push('reportId');
  }

  return { ok: true, params: { source: 'agent', name, chainId, reportId, version: HANDOFF_VERSION }, ignored };
}

/** The sentence the human gives back to their agent after the wallet action. */
export function reauditInstruction(args: {
  name: string;
  chainId: number;
  reportId: string | null;
  priorStatus?: string | null;
}): string {
  const prior = args.reportId ? ` The prior report id is ${args.reportId}.` : '';
  const status = args.priorStatus ? ` The prior status was ${args.priorStatus}.` : '';
  return `I have published the stealth record for ${args.name} on chain ${args.chainId} from my own wallet. Please re-audit it with ghostname_reaudit_ens_privacy and explain what improved and what remains public.${prior}${status}`;
}
