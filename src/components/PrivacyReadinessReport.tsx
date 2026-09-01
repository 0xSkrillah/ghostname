import { useState } from 'react';
import type { PrivacyAuditReport } from '../audit/types';
import {
  STATUS_EXPLANATION,
  STATUS_LABEL,
  formatSummary,
  reportFilename,
  statusPillClass,
} from '../audit/report';

/**
 * GhostCheck result. Everything shown is derived locally from public data and
 * the report is never uploaded anywhere.
 */
export default function PrivacyReadinessReport({ report }: { report: PrivacyAuditReport }) {
  const [copied, setCopied] = useState(false);

  function download() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = reportFilename(report);
    a.click();
    URL.revokeObjectURL(url);
  }

  function copy() {
    void navigator.clipboard.writeText(formatSummary(report)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const derivation = report.localDerivationTest;

  return (
    <>
      <div className="card">
        <span className="label">GhostCheck: privacy readiness</span>
        <div className="row" style={{ alignItems: 'baseline' }}>
          <span className={statusPillClass(report.overallStatus)}>
            {STATUS_LABEL[report.overallStatus]}
          </span>
          <span className="small dim">{STATUS_EXPLANATION[report.overallStatus]}</span>
        </div>
        <div className="row" style={{ marginTop: '0.6rem' }}>
          <button className="ghost" onClick={download}>
            Download JSON report
          </button>
          <button className="ghost" onClick={copy}>
            {copied ? 'Copied' : 'Copy summary'}
          </button>
          <span className="small dim">Generated locally. Nothing is uploaded.</span>
        </div>
      </div>

      <div className="card inset">
        <span className="label">Records checked, in precedence order</span>
        <table className="plain">
          <thead>
            <tr>
              <th>Record key</th>
              <th>Kind</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {report.recordSources.map((source) => (
              <tr key={source.key}>
                <td className="mono small" style={{ wordBreak: 'break-all' }}>
                  {source.key}
                  {!source.normative && (
                    <>
                      {' '}
                      <span className="pill">diagnostic</span>
                    </>
                  )}
                </td>
                <td className="small dim">{source.kind}</td>
                <td className="small">
                  {source.status === 'present-valid' && <span className="pill ok">valid</span>}
                  {source.status === 'absent' && <span className="dim">absent</span>}
                  {source.status === 'present-invalid' && (
                    <>
                      <span className="pill bad">malformed</span>{' '}
                      <span className="small dim">{source.error}</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.selectedRecord ? (
          <p className="small" style={{ marginBottom: 0 }}>
            <strong>Selected:</strong>{' '}
            <span className="mono">{report.selectedRecord.key}</span>.{' '}
            <span className="dim">{report.selectedRecord.precedenceNote}</span>
          </p>
        ) : (
          <p className="small dim" style={{ marginBottom: 0 }}>
            No conforming record was selected.
          </p>
        )}
      </div>

      {derivation.ran && (
        <div className={`card ${derivation.allDistinct ? 'ok' : 'danger'}`}>
          <span className="label">Local derivation test</span>
          <p className="small" style={{ marginTop: 0 }}>
            {derivation.trials} independent derivations from the selected record,{' '}
            {derivation.allDistinct ? 'all distinct' : 'NOT all distinct'}. Derivation path:{' '}
            <span className="mono">{derivation.derivationPath}</span>.
          </p>
          {derivation.addresses.map((address) => (
            <div key={address} className="bigmono small" style={{ color: 'var(--stealth-col)' }}>
              {address}
            </div>
          ))}
          <p className="small dim" style={{ marginBottom: 0, marginTop: '0.5rem' }}>
            {derivation.proves}
          </p>
        </div>
      )}

      <div className="card inset">
        <span className="label">Resolver</span>
        <p className="small" style={{ margin: 0 }}>
          <span className="mono">{report.resolver.address ?? 'not readable'}</span>{' '}
          <span className="pill">{report.resolver.provenance}</span>
        </p>
        <p className="small dim" style={{ marginBottom: 0 }}>
          {report.resolver.provenanceNote}
        </p>
      </div>

      {report.warnings.length > 0 && (
        <div className="card danger">
          <span className="label">Warnings</span>
          <ul className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {report.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {report.unknowns.length > 0 && (
        <div className="card">
          <span className="label">Unknown: not established, not assumed</span>
          <ul className="small dim" style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {report.unknowns.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="compare">
        <div className="col stealth">
          <div className="title">Protected</div>
          <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {report.trustBoundaries.protected.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="col static">
          <div className="title">Not protected</div>
          <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {report.trustBoundaries.notProtected.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
