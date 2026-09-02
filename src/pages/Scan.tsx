import { useState } from 'react';
import type { Address } from 'viem';
import { getMainnetClient, getSepoliaClient } from '../chain/clients';
import { auditEnsName } from '../audit/auditEnsName';
import type { PrivacyAuditReport } from '../audit/types';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../chain/guards';
import { DEMO_MAINNET_NAME } from '../config';
import { describeError } from '../lib/describeError';
import Compare from '../components/Compare';
import ExposurePanel from '../components/ExposurePanel';
import PrivacyReadinessReport from '../components/PrivacyReadinessReport';

type Network = 'mainnet' | 'sepolia';

const NETWORK_LABEL: Record<Network, string> = {
  mainnet: 'Ethereum mainnet',
  sepolia: 'Sepolia testnet',
};

/**
 * GhostCheck: audit any ENS name against the emerging stealth-resolution
 * convention. Read-only, live, and honest about what it cannot establish.
 * Nothing is queried until the user runs the audit.
 */
export default function Scan() {
  const [name, setName] = useState(DEMO_MAINNET_NAME);
  const [network, setNetwork] = useState<Network>('mainnet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PrivacyAuditReport | null>(null);
  const [reportNetwork, setReportNetwork] = useState<Network>('mainnet');

  async function audit() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const client = network === 'mainnet' ? getMainnetClient() : getSepoliaClient();
      const chainId = network === 'mainnet' ? MAINNET_CHAIN_ID : SEPOLIA_CHAIN_ID;
      const result = await auditEnsName(client, name, { chainId, derivationPath: 'local-client' });
      setReport(result);
      setReportNetwork(network);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Audit an ENS identity</h1>
      <p className="lead">
        GhostCheck reads any ENS name live and reports whether it is ready to receive private
        payments. Read-only. Nothing is written and nothing is uploaded. Enter any name; nothing
        is queried until you run the audit. A name lives on one network, so pick the network it
        was registered on.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && name.trim()) void audit();
        }}
      >
        <label className="sr-only" htmlFor="scan-name">
          ENS name to audit
        </label>
        <input
          id="scan-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name.eth"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
        />
        <label className="small dim" htmlFor="scan-network">
          Network
        </label>
        <select
          id="scan-network"
          value={network}
          onChange={(e) => setNetwork(e.target.value as Network)}
        >
          <option value="mainnet">{NETWORK_LABEL.mainnet}</option>
          <option value="sepolia">{NETWORK_LABEL.sepolia}</option>
        </select>
        <button type="submit" disabled={busy || !name.trim()} aria-busy={busy}>
          {busy ? 'Auditing…' : 'Run privacy audit'}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div aria-live="polite" aria-busy={busy}>
        {busy && (
          <p className="dim small" role="status">
            Reading ENS records on {NETWORK_LABEL[network]}…
          </p>
        )}
        {report && (
          <>
            <div className="card inset">
              <span className="label">
                Conventional resolution on {NETWORK_LABEL[reportNetwork]} (static identity)
              </span>
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

            {report.conventionalAddress && reportNetwork === 'mainnet' && (
              <ExposurePanel address={report.conventionalAddress as Address} />
            )}
            <Compare name={report.name} staticAddress={report.conventionalAddress ?? undefined} />
          </>
        )}
      </div>
    </>
  );
}
