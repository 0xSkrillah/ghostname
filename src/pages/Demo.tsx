/**
 * The 90-second guided demo. Pre-fills inputs (never outputs); every call is
 * live. Sequence follows 04_DEMO_AND_SUBMISSION.md.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getMainnetClient, getSepoliaClient } from '../chain/clients';
import { resolveConventionalAddress } from '../ens/resolve';
import { planStealthPayment, type StealthPaymentPlan } from '../chain/payment';
import { DEMO_MAINNET_NAME, DEMO_SEPOLIA_NAME } from '../config';
import Compare from '../components/Compare';

export default function Demo() {
  const [mainnetName, setMainnetName] = useState(DEMO_MAINNET_NAME);
  const [testName, setTestName] = useState(DEMO_SEPOLIA_NAME);
  const [staticResult, setStaticResult] = useState<{ name: string; address: string | null } | null>(null);
  const [derivations, setDerivations] = useState<StealthPaymentPlan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function step1() {
    setBusy('static');
    setError(null);
    try {
      const r = await resolveConventionalAddress(getMainnetClient(), mainnetName);
      setStaticResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function step2() {
    setBusy('derive');
    setError(null);
    try {
      const plan = await planStealthPayment(getSepoliaClient(), testName, 0n);
      setDerivations((d) => [...d, plan]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const a = derivations[0]?.derivation.stealthAddress;
  const b = derivations[1]?.derivation.stealthAddress;

  return (
    <>
      <h1>90-second demo</h1>
      <p className="lead">
        Every result below is resolved and derived live — inputs are pre-filled, outputs are
        not.
      </p>

      <ol className="steps">
        <li className={staticResult ? 'done' : 'active'}>
          <strong>An established public identity.</strong>
          <div className="row" style={{ marginTop: '0.4rem' }}>
            <input type="text" value={mainnetName} onChange={(e) => setMainnetName(e.target.value)} />
            <button onClick={() => void step1()} disabled={busy === 'static'}>
              {busy === 'static' ? 'Resolving…' : 'Resolve on mainnet (read-only)'}
            </button>
          </div>
          {staticResult && (
            <div className="card inset" style={{ marginBottom: 0 }}>
              <div className="bigmono">
                {staticResult.name} →{' '}
                <span style={{ color: 'var(--static-col)' }}>
                  {staticResult.address ?? 'no address record'}
                </span>
              </div>
              <p className="small dim" style={{ margin: '0.4rem 0 0' }}>
                Years of history, publicly linkable. <strong>I cannot delete it</strong> —
                blockchains have no delete button.
              </p>
            </div>
          )}
        </li>

        <li className={derivations.length > 0 ? 'done' : staticResult ? 'active' : ''}>
          <strong>The same identity model, GhostName-enabled (Sepolia test name).</strong>
          <div className="row" style={{ marginTop: '0.4rem' }}>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="ghostname-enabled test name (Sepolia)"
            />
            <button onClick={() => void step2()} disabled={busy === 'derive' || !testName.trim()}>
              {busy === 'derive'
                ? 'Deriving…'
                : derivations.length === 0
                  ? 'Resolve privately → A'
                  : 'Resolve again → B'}
            </button>
          </div>
          {a && (
            <div className="bigmono" style={{ color: 'var(--stealth-col)', marginTop: '0.5rem' }}>
              A: {a}
            </div>
          )}
          {b && (
            <>
              <div className="bigmono" style={{ color: 'var(--stealth-col)' }}>B: {b}</div>
              <p className="small" style={{ color: 'var(--accent)' }}>
                A ≠ B — same name, fresh destination each time, derived locally from new
                ephemeral randomness.
              </p>
            </>
          )}
        </li>

        <li className={derivations.length >= 2 ? 'active' : ''}>
          <strong>Send + discover.</strong>
          <p className="small dim" style={{ margin: '0.3rem 0 0' }}>
            Continue on <Link to="/pay">Pay</Link> (send Sepolia ETH to A with its
            announcement), then <Link to="/receive">Receive</Link> (the viewing key finds it;
            a random key finds nothing).
          </p>
        </li>

        <li>
          <strong>The honest boundary.</strong>
          <p className="small dim" style={{ margin: '0.3rem 0 0' }}>
            <Link to="/privacy">What is and is not protected.</Link> Keep the name. Break the
            payment graph.
          </p>
        </li>
      </ol>

      {error && <p className="error">{error}</p>}

      {derivations.length >= 2 && (
        <Compare
          name={derivations[0]!.ensName}
          staticAddress={staticResult?.address ?? undefined}
          stealthAddresses={derivations.map((d) => d.derivation.stealthAddress)}
        />
      )}
    </>
  );
}
