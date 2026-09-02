import { useState } from 'react';
import type { Address } from 'viem';
import { getMainnetClient, getSepoliaClient } from '../chain/clients';
import { auditEnsName } from '../audit/auditEnsName';
import type { PrivacyAuditReport } from '../audit/types';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../chain/guards';
import { DEMO_MAINNET_NAME } from '../config';
import { describeError } from '../lib/describeError';
import { normalizeEnsName } from '../ens/resolve';
import Compare from '../components/Compare';
import ExposurePanel from '../components/ExposurePanel';
import PrivacyReadinessReport from '../components/PrivacyReadinessReport';

type Network = 'mainnet' | 'sepolia';

const NETWORK_LABEL: Record<Network, string> = {
  mainnet: 'Ethereum mainnet',
  sepolia: 'Sepolia testnet',
};

function otherNetwork(network: Network): Network {
  return network === 'mainnet' ? 'sepolia' : 'mainnet';
}

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

  async function audit(target: Network = network) {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const client = target === 'mainnet' ? getMainnetClient() : getSepoliaClient();
      const chainId = target === 'mainnet' ? MAINNET_CHAIN_ID : SEPOLIA_CHAIN_ID;
      const result = await auditEnsName(client, name, { chainId, derivationPath: 'local-client' });
      setReport(result);
      setReportNetwork(target);
    } catch (err) {
      setError(
        `Audit on ${NETWORK_LABEL[target]} failed: ${describeError(err)} Retry; if it persists, ` +
          'set VITE_MAINNET_RPC_URL or VITE_SEPOLIA_RPC_URL in .env to a provider you control.',
      );
    } finally {
      setBusy(false);
    }
  }

  /** One click to re-run the same name on the other network. */
  function auditOn(target: Network) {
    setNetwork(target);
    void audit(target);
  }

  // The report on screen must visibly belong to the name and network in the inputs.
  let normalizedInput: string | null = null;
  try {
    normalizedInput = name.trim() ? normalizeEnsName(name) : null;
  } catch {
    normalizedInput = null;
  }
  const reportStale =
    report !== null && (report.name !== normalizedInput || reportNetwork !== network);
  const addressFailed = report?.conventionalAddressStatus === 'failed';

  return (
    <>
      <h1>Audit an ENS identity</h1>
      <p className="lead">
        GhostCheck reads any ENS name live and reports whether it is ready to receive private
        payments. Read-only: nothing is written and nothing about you is uploaded.
      </p>
      <label className="label" htmlFor="scan-name">
        ENS name to audit
      </label>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && name.trim()) void audit();
        }}
      >
        <input
          id="scan-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name.eth"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          disabled={busy}
        />
        <label className="small dim" htmlFor="scan-network">
          Network
        </label>
        <select
          id="scan-network"
          value={network}
          onChange={(e) => setNetwork(e.target.value as Network)}
          disabled={busy}
        >
          <option value="mainnet">{NETWORK_LABEL.mainnet}</option>
          <option value="sepolia">{NETWORK_LABEL.sepolia}</option>
        </select>
        <button type="submit" disabled={busy || !name.trim()} aria-busy={busy}>
          {busy ? 'Auditing…' : 'Run privacy audit'}
        </button>
      </form>
      <p className="small dim" style={{ margin: '0.5rem 0 0' }}>
        Nothing is queried until you run the audit. A name lives on one network, so pick the
        one it was registered on. Two things leave your browser: RPC requests naming the
        audited name and, for names with an offchain (CCIP-read) resolver, a request to that
        resolver's gateway. The optional Mobula panel sends the resolved address to Mobula.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div aria-live="polite" aria-busy={busy}>
        {busy && <p className="dim small">Reading ENS records on {NETWORK_LABEL[network]}…</p>}
        {report && (
          <>
            {reportStale && (
              <p className="small" style={{ color: 'var(--warn)' }}>
                The result below is for <span className="mono">{report.name}</span> on{' '}
                {NETWORK_LABEL[reportNetwork]}; the inputs have changed since. Run the audit
                again to refresh it.
              </p>
            )}
            <div className="card inset">
              <span className="label">
                Conventional resolution on {NETWORK_LABEL[reportNetwork]} (static identity)
              </span>
              <div className="bigmono xl">{report.name}</div>
              <div
                className="bigmono"
                style={{
                  color: addressFailed ? 'var(--warn)' : 'var(--static-col)',
                  marginTop: '0.4rem',
                }}
              >
                {report.conventionalAddress ??
                  (addressFailed
                    ? 'Not determined: address resolution failed.'
                    : report.overallStatus === 'unknown'
                      ? 'Nothing found for this name on this network.'
                      : 'No ETH address record set.')}
              </div>
              <p className="small dim" style={{ marginBottom: 0 }}>
                {report.staticMappingNote}
              </p>
              {report.overallStatus === 'unknown' && !addressFailed && (
                <div className="row" style={{ marginTop: '0.7rem' }}>
                  <button
                    className="secondary"
                    onClick={() => auditOn(otherNetwork(reportNetwork))}
                    disabled={busy}
                  >
                    Try on {NETWORK_LABEL[otherNetwork(reportNetwork)]}
                  </button>
                  <span className="small dim">
                    A name registered on the other network reports as unknown here.
                  </span>
                </div>
              )}
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
            <Compare
              name={report.name}
              staticAddress={report.conventionalAddress ?? undefined}
              stealthAddresses={
                report.localDerivationTest.ran ? report.localDerivationTest.addresses : undefined
              }
            />
          </>
        )}
      </div>
    </>
  );
}
