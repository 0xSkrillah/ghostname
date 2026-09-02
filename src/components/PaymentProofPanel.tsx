import { useState } from 'react';
import { getSepoliaClient } from '../chain/clients';
import { STEALTH_PAYMENT_EVIDENCE } from '../relay/evidence';
import { verifyPaymentProof, type PaymentProof } from '../relay/paymentProof';

const STATE_PILL: Record<string, string> = {
  pass: 'pill ok',
  fail: 'pill bad',
  unknown: 'pill warn',
};

/**
 * Verify the published stealth payment and its ERC-5564 announcement live.
 * Only transaction hashes are configured; every claim is re-derived, so stale
 * evidence fails a check rather than showing a false green.
 */
export default function PaymentProofPanel() {
  const [proof, setProof] = useState<PaymentProof | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      setProof(await verifyPaymentProof(getSepoliaClient() as never, STEALTH_PAYMENT_EVIDENCE));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <span className="label">Published payment and announcement, verified from chain data</span>
      <p className="small dim" style={{ marginTop: 0 }}>
        A real stealth payment was sent on Sepolia and announced under ERC-5564. The check
        that matters is the last one: the announcement must name the same address the payment
        actually funded, otherwise it is an unrelated log.
      </p>

      {!proof && (
        <button className="secondary" onClick={() => void run()} disabled={busy}>
          {busy ? 'Verifying…' : 'Verify the payment and announcement'}
        </button>
      )}

      <div aria-live="polite" aria-busy={busy}>
      {proof && (
        <>
          <p className="small" style={{ marginBottom: '0.5rem' }}>
            {proof.verified ? (
              <span className="pill ok">pass: all checks passed</span>
            ) : (
              <span className="pill warn">not fully verified: see rows</span>
            )}{' '}
            <a href={proof.paymentUrl} target="_blank" rel="noreferrer" className="small">
              payment tx
            </a>{' '}
            <a href={proof.announcementUrl} target="_blank" rel="noreferrer" className="small">
              announcement tx
            </a>{' '}
            <button
              className="ghost"
              style={{ padding: '0.15rem 0.6rem', fontSize: '0.78rem' }}
              onClick={() => void run()}
              disabled={busy}
            >
              {busy ? 'Re-checking…' : 'Re-verify'}
            </button>
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

          {proof.facts.stealthAddress && (
            <p className="small dim" style={{ marginBottom: '0.4rem' }}>
              One-time destination{' '}
              <span className="mono" style={{ color: 'var(--stealth-col)' }}>
                {proof.facts.stealthAddress}
              </span>
              {proof.facts.amountEth && <> received {proof.facts.amountEth} ETH</>}
              {proof.facts.viewTag && <>, announced with view tag {proof.facts.viewTag}</>}.
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
