import { useState } from 'react';
import type { Address } from 'viem';
import { getMainnetClient } from '../chain/clients';
import { auditEnsName } from '../audit/auditEnsName';
import type { PrivacyAuditReport } from '../audit/types';
import { MAINNET_CHAIN_ID } from '../chain/guards';
import { DEMO_MAINNET_NAME } from '../config';
import Compare from '../components/Compare';
import ExposurePanel from '../components/ExposurePanel';
import PrivacyReadinessReport from '../components/PrivacyReadinessReport';

/**
 * GhostCheck: audit any ENS name against the emerging stealth-resolution
 * convention. Read-only, live, and honest about what it cannot establish.
 */
export default function Scan() {
  const [name, setName] = useState(DEMO_MAINNET_NAME);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PrivacyAuditReport | null>(null);

  async function audit() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      setReport(
        await auditEnsName(getMainnetClient(), name, {
          chainId: MAINNET_CHAIN_ID,
          derivationPath: 'local-client',
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Audit an ENS identity</h1>
      <p className="lead">
        GhostCheck reads any ENS name live on Ethereum mainnet and reports whether it is ready
        to receive private payments. Read-only. Nothing is written and nothing is uploaded.
      </p>
      <div className="row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name.eth"
          onKeyDown={(e) => e.key === 'Enter' && !busy && name.trim() && void audit()}
        />
        <button onClick={() => void audit()} disabled={busy || !name.trim()}>
          {busy ? 'Auditing…' : 'Run privacy audit'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {report && (
        <>
          <div className="card inset">
            <span className="label">Conventional resolution (static identity)</span>
            <div className="bigmono xl">{report.name}</div>
            <div className="bigmono" style={{ color: 'var(--static-col)', marginTop: '0.4rem' }}>
              {report.conventionalAddress ?? 'No ETH address record set.'}
            </div>
            <p className="small dim" style={{ marginBottom: 0 }}>
              {report.staticMappingNote}
            </p>
          </div>

          {report.conventionalAddress && (
            <div className="card danger">
              <strong>This mapping is public and permanent.</strong>
              <p className="small" style={{ marginBottom: 0 }}>
                Anyone can connect <span className="mono">{report.name}</span> to every past and
                future transaction of this address: balances, counterparties, timing. Past
                activity cannot be deleted. GhostName cannot fix the past. It prevents{' '}
                <em>future</em> receiving addresses from being linkable this way.
              </p>
            </div>
          )}

          <PrivacyReadinessReport report={report} />

          {report.conventionalAddress && (
            <ExposurePanel address={report.conventionalAddress as Address} />
          )}
          <Compare name={report.name} staticAddress={report.conventionalAddress ?? undefined} />
        </>
      )}
    </>
  );
}
