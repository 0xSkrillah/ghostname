/**
 * The guided demo: audit, upgrade, prove, in one route.
 *
 * Every claim is verified live from chain data. Inputs are pre-filled but no
 * output is ever precomputed, and no step sends the presenter to another page.
 * The route stays usable when no fresh transaction is sent live, because the
 * published evidence is re-verified rather than asserted.
 */
import { useState } from 'react';
import type { Hex } from 'viem';
import { getMainnetClient, getSepoliaClient } from '../chain/clients';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../chain/guards';
import { auditEnsName } from '../audit/auditEnsName';
import type { PrivacyAuditReport } from '../audit/types';
import { STATUS_EXPLANATION, STATUS_LABEL, statusPillClass } from '../audit/report';
import { generateStealthAddress } from '../crypto/stealth';
import { checkStealthAddress, generateStealthKeys } from '../crypto/stealth';
import { DEMO_MAINNET_NAME, DEMO_SEPOLIA_NAME } from '../config';
import SweepProofPanel from '../components/SweepProofPanel';
import Compare from '../components/Compare';

interface RecognitionDemo {
  stealthAddress: string;
  ownerRecognised: boolean;
  strangerRecognised: boolean;
}

export default function Demo() {
  const [auditName, setAuditName] = useState(DEMO_MAINNET_NAME);
  const [upgradeName, setUpgradeName] = useState(DEMO_SEPOLIA_NAME);
  const [audit, setAudit] = useState<PrivacyAuditReport | null>(null);
  const [upgrade, setUpgrade] = useState<PrivacyAuditReport | null>(null);
  const [derived, setDerived] = useState<string[]>([]);
  const [recognition, setRecognition] = useState<RecognitionDemo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (err: unknown) => setError(err instanceof Error ? err.message : String(err));

  async function step1() {
    setBusy('audit');
    setError(null);
    try {
      setAudit(
        await auditEnsName(getMainnetClient(), auditName, {
          chainId: MAINNET_CHAIN_ID,
          derivationPath: 'local-client',
        }),
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function step2() {
    setBusy('upgrade');
    setError(null);
    try {
      setUpgrade(
        await auditEnsName(getSepoliaClient(), upgradeName, {
          chainId: SEPOLIA_CHAIN_ID,
          derivationPath: 'local-client',
        }),
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  function step3() {
    setError(null);
    const record = upgrade?.selectedRecord?.value;
    if (!record) {
      setError('Run step 2 first so there is a published record to derive from.');
      return;
    }
    // Fresh ephemeral randomness per derivation. Nothing precomputed.
    setDerived([
      generateStealthAddress(record).stealthAddress,
      generateStealthAddress(record).stealthAddress,
      generateStealthAddress(record).stealthAddress,
    ]);
  }

  function step4() {
    setError(null);
    // A live, self-contained proof of the recognition property, run with the
    // real production code paths: the intended viewing key recognises the
    // payment and an unrelated key does not.
    const recipient = generateStealthKeys();
    const stranger = generateStealthKeys();
    const announcement = generateStealthAddress(recipient.stealthMetaAddress);
    setRecognition({
      stealthAddress: announcement.stealthAddress,
      ownerRecognised: checkStealthAddress({
        stealthAddress: announcement.stealthAddress,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        viewTag: announcement.viewTag,
        viewingPrivateKey: recipient.viewingPrivateKey as Hex,
        spendingPublicKey: recipient.spendingPublicKey as Hex,
      }),
      strangerRecognised: checkStealthAddress({
        stealthAddress: announcement.stealthAddress,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        viewTag: announcement.viewTag,
        viewingPrivateKey: stranger.viewingPrivateKey as Hex,
        spendingPublicKey: stranger.spendingPublicKey as Hex,
      }),
    });
  }

  const allDistinct = derived.length === 3 && new Set(derived).size === 3;

  return (
    <>
      <h1>GhostName in two minutes</h1>
      <p className="lead">
        Audit an ENS name, upgrade it without replacing it, and prove the whole private
        payment lifecycle. Every result below is read live from chain data. Inputs are
        pre-filled; no output is precomputed.
      </p>
      {error && <p className="error">{error}</p>}

      <ol className="steps">
        {/* 1. AUDIT */}
        <li className={audit ? 'done' : 'active'}>
          <strong>Audit: what does an established name commit to today?</strong>
          <div className="row" style={{ marginTop: '0.4rem' }}>
            <input
              type="text"
              value={auditName}
              onChange={(e) => setAuditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && busy !== 'audit' && void step1()}
            />
            <button onClick={() => void step1()} disabled={busy === 'audit'}>
              {busy === 'audit' ? 'Auditing…' : 'Audit on mainnet (read-only)'}
            </button>
          </div>
          {audit && (
            <div className="card inset" style={{ marginBottom: 0 }}>
              <div className="bigmono">
                {audit.name} →{' '}
                <span style={{ color: 'var(--static-col)' }}>
                  {audit.conventionalAddress ?? 'no address record'}
                </span>
              </div>
              <p className="small" style={{ margin: '0.5rem 0 0.3rem' }}>
                <span className={statusPillClass(audit.overallStatus)}>
                  {STATUS_LABEL[audit.overallStatus]}
                </span>{' '}
                <span className="dim">{STATUS_EXPLANATION[audit.overallStatus]}</span>
              </p>
              <p className="small dim" style={{ marginBottom: 0 }}>
                {audit.staticMappingNote} This history cannot be deleted.
              </p>
            </div>
          )}
        </li>

        {/* 2. UPGRADE */}
        <li className={upgrade ? 'done' : audit ? 'active' : ''}>
          <strong>Upgrade: the same identity, now publishing a stealth record.</strong>
          <p className="small dim" style={{ margin: '0.2rem 0 0.4rem' }}>
            The name is kept. No service-owned subdomain, no new wallet.
          </p>
          <div className="row">
            <input
              type="text"
              value={upgradeName}
              onChange={(e) => setUpgradeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && busy !== 'upgrade' && void step2()}
              placeholder="GhostName-enabled name (Sepolia)"
            />
            <button onClick={() => void step2()} disabled={busy === 'upgrade' || !upgradeName.trim()}>
              {busy === 'upgrade' ? 'Checking…' : 'Check conformance'}
            </button>
          </div>
          {upgrade && (
            <div className="card inset" style={{ marginBottom: 0 }}>
              <p className="small" style={{ marginTop: 0 }}>
                <span className={statusPillClass(upgrade.overallStatus)}>
                  {STATUS_LABEL[upgrade.overallStatus]}
                </span>{' '}
                <span className="dim">resolver</span>{' '}
                <span className="mono small">{upgrade.resolver.address ?? 'unknown'}</span>
              </p>
              {upgrade.selectedRecord && (
                <p className="small" style={{ margin: 0 }}>
                  <span className="dim">selected record</span>{' '}
                  <span className="mono">{upgrade.selectedRecord.key}</span>
                  <br />
                  <span className="dim small">{upgrade.selectedRecord.precedenceNote}</span>
                </p>
              )}
            </div>
          )}
        </li>

        {/* 3. DERIVE */}
        <li className={derived.length ? 'done' : upgrade ? 'active' : ''}>
          <strong>Derive: every sender computes a different destination, locally.</strong>
          <div className="row" style={{ marginTop: '0.4rem' }}>
            <button onClick={step3} disabled={!upgrade?.selectedRecord}>
              Derive A, B and C
            </button>
            {derived.length > 0 && (
              <span className="small dim">Fresh ephemeral randomness each time.</span>
            )}
          </div>
          {derived.map((address, i) => (
            <div key={address} className="bigmono" style={{ color: 'var(--stealth-col)' }}>
              {String.fromCharCode(65 + i)}: {address}
            </div>
          ))}
          {derived.length === 3 && (
            <p className="small" style={{ color: allDistinct ? 'var(--accent)' : 'var(--danger)' }}>
              {allDistinct
                ? 'A, B and C are all different. Same name, a new one-time address every time.'
                : 'Repeated destination detected. This must not happen.'}
            </p>
          )}
        </li>

        {/* 4. PROVE RECEIVE */}
        <li className={recognition ? 'done' : derived.length ? 'active' : ''}>
          <strong>Prove receive: only the right viewing key finds the money.</strong>
          <div className="row" style={{ marginTop: '0.4rem' }}>
            <button onClick={step4}>Run recognition test</button>
            <span className="small dim">
              Live, using the same code the recipient scanner uses.
            </span>
          </div>
          {recognition && (
            <div className="card inset" style={{ marginBottom: 0 }}>
              <div className="bigmono small" style={{ color: 'var(--stealth-col)' }}>
                {recognition.stealthAddress}
              </div>
              <p className="small" style={{ margin: '0.4rem 0 0' }}>
                intended viewing key:{' '}
                {recognition.ownerRecognised ? (
                  <span className="pill ok">recognised</span>
                ) : (
                  <span className="pill bad">failed</span>
                )}{' '}
                unrelated viewing key:{' '}
                {recognition.strangerRecognised ? (
                  <span className="pill bad">recognised, wrong</span>
                ) : (
                  <span className="pill ok">finds nothing</span>
                )}
              </p>
              <p className="small dim" style={{ marginBottom: 0 }}>
                Recognition needs the private viewing key, not just public data.
              </p>
            </div>
          )}
        </li>

        {/* 5. PROVE EXIT */}
        <li className={recognition ? 'active' : ''}>
          <strong>Prove exit: the funds leave without the stealth address paying gas.</strong>
          <SweepProofPanel />
        </li>

        {/* 6. BOUNDARY */}
        <li>
          <strong>The boundary, stated plainly.</strong>
          <div className="compare" style={{ marginTop: '0.5rem' }}>
            <div className="col stealth">
              <div className="title">Protected</div>
              <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                <li>Future receiving addresses are unlinkable to the name.</li>
                <li>Derivation is local, so no gateway learns the destination.</li>
                <li>Recipient address reuse is avoided.</li>
              </ul>
            </div>
            <div className="col static">
              <div className="title">Not protected</div>
              <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                <li>Past transaction history, which cannot be erased.</li>
                <li>ENS ownership, amounts, and sender identity.</li>
                <li>Timing and RPC metadata.</li>
              </ul>
            </div>
          </div>
        </li>

        {/* 7. CLOSE */}
        <li>
          <strong>Close.</strong>
          <p className="small" style={{ margin: '0.3rem 0 0' }}>
            GhostName does not replace your ENS identity or ask you to trust another wallet
            provider. It audits, upgrades and proves private ENS payments.
          </p>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--accent)' }}>
            <strong>Keep the ENS name. Break the payment graph.</strong>
          </p>
        </li>
      </ol>

      {derived.length === 3 && (
        <Compare
          name={upgrade?.name ?? 'name.eth'}
          staticAddress={audit?.conventionalAddress ?? undefined}
          stealthAddresses={derived}
        />
      )}
    </>
  );
}
