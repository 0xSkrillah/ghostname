/**
 * Rendering helpers for a privacy audit report. Everything here is local:
 * reports are never uploaded anywhere.
 */
import type { OverallStatus, PrivacyAuditReport } from './types';

export const STATUS_LABEL: Record<OverallStatus, string> = {
  'private-ready': 'Private-ready',
  incomplete: 'Incomplete',
  misconfigured: 'Misconfigured',
  unknown: 'Unknown',
};

export const STATUS_EXPLANATION: Record<OverallStatus, string> = {
  'private-ready':
    'A valid scheme-1 stealth meta-address is published and senders can derive distinct one-time destinations from it.',
  incomplete:
    'No stealth meta-address is published, so future payments to this name stay linkable to its static address.',
  misconfigured:
    'A stealth record exists but is malformed, unsupported or conflicting, so conforming senders may ignore it.',
  unknown: 'The name could not be resolved, so its privacy readiness was not established.',
};

/** CSS pill class for a status. Not a score, just a category. */
export function statusPillClass(status: OverallStatus): string {
  if (status === 'private-ready') return 'pill ok';
  if (status === 'misconfigured') return 'pill bad';
  if (status === 'incomplete') return 'pill warn';
  return 'pill';
}

/** Human-readable summary suitable for the clipboard. Contains no secrets. */
export function formatSummary(report: PrivacyAuditReport): string {
  const lines: string[] = [];
  lines.push(`GhostCheck privacy audit: ${report.name}`);
  lines.push(`Status: ${STATUS_LABEL[report.overallStatus]}`);
  lines.push(STATUS_EXPLANATION[report.overallStatus]);
  lines.push(`Chain id: ${report.chainId}`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(
    `Conventional address: ${report.conventionalAddress ?? 'none'} (${report.staticMappingNote})`,
  );
  lines.push(`Resolver: ${report.resolver.address ?? 'unknown'} (${report.resolver.provenance})`);
  lines.push('');
  lines.push('Records checked, in precedence order:');
  for (const source of report.recordSources) {
    const tag = source.normative ? '' : ' [non-normative diagnostic]';
    lines.push(`  ${source.key}: ${source.status}${tag}`);
  }
  lines.push(
    report.selectedRecord
      ? `Selected: ${report.selectedRecord.key} (${report.selectedRecord.precedenceNote})`
      : 'Selected: none',
  );
  lines.push('');
  if (report.localDerivationTest.ran) {
    lines.push(
      `Local derivation: ${report.localDerivationTest.trials} trials, all distinct: ${report.localDerivationTest.allDistinct}`,
    );
    lines.push(`Derivation path: ${report.localDerivationTest.derivationPath}`);
    lines.push(`What this proves: ${report.localDerivationTest.proves}`);
    lines.push('');
  }
  if (report.warnings.length) {
    lines.push('Warnings:');
    for (const w of report.warnings) lines.push(`  - ${w}`);
    lines.push('');
  }
  if (report.unknowns.length) {
    lines.push('Unknown (not established, not assumed):');
    for (const u of report.unknowns) lines.push(`  - ${u}`);
    lines.push('');
  }
  lines.push('Protected:');
  for (const p of report.trustBoundaries.protected) lines.push(`  - ${p}`);
  lines.push('Not protected:');
  for (const n of report.trustBoundaries.notProtected) lines.push(`  - ${n}`);
  return lines.join('\n');
}

/** Suggested filename for a downloaded report. */
export function reportFilename(report: PrivacyAuditReport): string {
  const safe = report.name.replace(/[^a-z0-9.-]/gi, '_');
  return `ghostcheck-${safe}.json`;
}
