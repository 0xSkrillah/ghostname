import { useEffect, useRef, useState } from 'react';
import { formatEther } from 'viem';
import { getSepoliaClient } from '../chain/clients';
import { SPONSORED_SWEEP_EVIDENCE } from '../relay/evidence';
import { verifySweepProof, type SweepProof } from '../relay/proof';

const STATE_PILL: Record<string, string> = {
  pass: 'pill ok',
  fail: 'pill bad',
  unknown: 'pill warn',
};

/**
 * Verify the published sponsored exit live from public chain data. Only the
 * transaction hash is configured; every claim is re-derived here, so a stale
 * hash shows as a failed check rather than a false green.
 */
export default function SweepProofPanel({ autoRun = false }: { autoRun?: boolean }) {
  const [proof, setProof] = useState<SweepProof | null>(null);
  const [busy, setBusy] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  async function run() {
    setBusy(true);
    try {
      setProof(await verifySweepProof(getSepoliaClient() as never, SPONSORED_SWEEP_EVIDENCE));
    } finally {
      setBusy(false);
      setTimeout(() => resultsRef.current?.focus(), 0);
    }
  }

  useEffect(() => {
    if (autoRun) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  return (
    <div className="card">
      <span className="label">Sponsored exit, verified from chain data</span>
      <p className="small dim" style={{ marginTop: 0 }}>
        A stealth address holds funds but no gas. Funding it from your own wallet would
        re-link it, so a sponsor pays instead. This checks that the published exit really
        happened that way. Only the transaction hash is configured. Every claim below is
        re-verified live. The executor is an unaudited testnet demo contract.
      </p>

      <button className="secondary" onClick={() => void run()} disabled={busy} aria-busy={busy}>
        {busy ? 'Verifying…' : proof ? 'Re-verify' : 'Verify the sponsored exit'}
      </button>

      <div aria-live="polite" aria-busy={busy} ref={resultsRef} tabIndex={-1}>
      {proof && (
        <>
          <p className="small" style={{ marginBottom: '0.5rem' }}>
            {proof.verified ? (
              <span className="pill ok">pass: all checks passed</span>
            ) : (
              <span className="pill warn">not fully verified: see rows</span>
            )}{' '}
            <a href={proof.explorerUrl} target="_blank" rel="noreferrer" className="mono small">
              view transaction
            </a>{' '}

          </p>

          <table className="plain">
            <tbody>
              {proof.checks.map((check) => (
                <tr key={check.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className={STATE_PILL[check.state] ?? 'pill'}>{check.state}</span>
                  </td>
                  <td className="small">
                    <strong>{check.label}</strong>
                    <div className="dim" style={{ wordBreak: 'break-word' }}>
                      {check.detail}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {proof.facts.sponsor && proof.facts.stealthAddress && (
            <p className="small dim" style={{ marginBottom: '0.4rem' }}>
              This transaction's gas was paid by sponsor{' '}
              <span className="mono">{proof.facts.sponsor}</span>, not by the swept account{' '}
              <span className="mono">{proof.facts.stealthAddress}</span>
              {proof.facts.amountWei && <>, which released {formatEther(BigInt(proof.facts.amountWei))} ETH</>}.
              Whether that account was ever funded for gas by some other transaction is not
              examined here; see the list below.
            </p>
          )}

          <div className="card danger" style={{ marginBottom: 0 }}>
            <span className="label">Not proven by this evidence</span>
            <ul className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {proof.notProven.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
