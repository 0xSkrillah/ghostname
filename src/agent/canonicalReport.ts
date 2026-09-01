/**
 * Canonical JSON and content-derived identifiers for agent reports.
 *
 * A report id is the first 128 bits of the SHA-256 of the report's canonical
 * JSON body. The body excludes the id itself and the fields derived from it
 * (`secureHandoff`, whose URL embeds the id) as well as the optional technical
 * evidence block, so the id names the audit outcome rather than its rendering.
 * The secure web handoff can then refer to an exact audit by id without the
 * report ever entering a URL.
 */
import { sha256, stringToBytes } from 'viem';

export const CANONICALIZATION = 'ghostname-canonical-json-v1';
export const REPORT_ID_PREFIX = 'gcr1_';
export const PLAN_ID_PREFIX = 'gup1_';
export const REPORT_ID_PATTERN = /^gcr1_[0-9a-f]{32}$/;
export const PLAN_ID_PATTERN = /^gup1_[0-9a-f]{32}$/;

/** Fields excluded from the report body before hashing. */
export const REPORT_DIGEST_EXCLUDES = ['reportId', 'secureHandoff', 'technicalEvidence'] as const;
export const PLAN_DIGEST_EXCLUDES = ['planId', 'handoff'] as const;

function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON cannot encode a non-finite number.');
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const child = (value as Record<string, unknown>)[key];
    if (child === undefined) continue;
    out[key] = canonicalize(child);
  }
  return out;
}

/** Deterministic JSON: sorted keys, no whitespace, undefined dropped. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(text: string): string {
  return sha256(stringToBytes(text)).slice(2);
}

function withoutKeys<T extends object>(value: T, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!keys.includes(key)) out[key] = child;
  }
  return out;
}

export interface Digest {
  algorithm: 'sha256';
  canonicalization: typeof CANONICALIZATION;
  excludes: readonly string[];
  value: `0x${string}`;
}

/** Full digest of a report or plan body. */
export function digestOf(value: object, excludes: readonly string[]): Digest {
  return {
    algorithm: 'sha256',
    canonicalization: CANONICALIZATION,
    excludes,
    value: `0x${sha256Hex(canonicalJson(withoutKeys(value, excludes)))}`,
  };
}

function idFromDigest(prefix: string, digest: Digest): string {
  return prefix + digest.value.slice(2, 34);
}

export function computeReportId(report: object): string {
  return idFromDigest(REPORT_ID_PREFIX, digestOf(report, REPORT_DIGEST_EXCLUDES));
}

export function computePlanId(plan: object): string {
  return idFromDigest(PLAN_ID_PREFIX, digestOf(plan, PLAN_DIGEST_EXCLUDES));
}

/** True when the id embedded in the report matches its body. */
export function verifyReportId<T extends { reportId: string }>(report: T): boolean {
  return REPORT_ID_PATTERN.test(report.reportId) && computeReportId(report) === report.reportId;
}

export function verifyPlanId<T extends { planId: string }>(plan: T): boolean {
  return PLAN_ID_PATTERN.test(plan.planId) && computePlanId(plan) === plan.planId;
}

export function isReportId(value: unknown): value is string {
  return typeof value === 'string' && REPORT_ID_PATTERN.test(value);
}
