import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { saveIdentity, useIdentity } from '../state/identity';
import type { StealthKeys } from '../crypto/stealth';
import { encryptCapsule } from '../swarm/capsule';
import { useWallet } from '../state/wallet';
import { publishStealthRecord } from '../ens/write';
import { getMainnetClient, getSepoliaClient } from '../chain/clients';
import { resolveStealthMetaAddress } from '../ens/resolve';
import { ENS_STEALTH_RECORD_KEY } from '../crypto/metaAddress';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../chain/guards';
import { auditEnsName } from '../audit/auditEnsName';
import type { PrivacyAuditReport } from '../audit/types';
import { STATUS_EXPLANATION, STATUS_LABEL, statusPillClass } from '../audit/report';
import { parseHandoffParams, reauditInstruction } from '../agent/handoff';
import CopyField from '../components/CopyField';
import MainnetConfirm from '../components/MainnetConfirm';

/**
 * Create a private receive identity and publish its record.
 *
 * This page is also the secure handoff target for AI agents. An agent can only
 * pass a name, a chain id, source=agent, a report id and a version. Every
 * sensitive step happens here: key generation, the live re-resolution of the
 * name, resolver discovery at transaction time, and the wallet approval.
 * Nothing in the URL is trusted for the privacy result.
 */
export default function Create() {
  const [searchParams] = useSearchParams();
  const handoff = useMemo(() => parseHandoffParams(searchParams), [searchParams]);
  const handoffParams = handoff?.ok ? handoff.params : null;

  const { identity, create, clear } = useIdentity();
  const wallet = useWallet();
  const [ensName, setEnsName] = useState(handoffParams?.name ?? '');
  const [importJson, setImportJson] = useState('');
  const [capsulePass, setCapsulePass] = useState('');
  const [capsuleMsg, setCapsuleMsg] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishTx, setPublishTx] = useState<string | null>(null);
  const [verified, setVerified] = useState<string | null>(null);
  const [mainnetConfirmed, setMainnetConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveAudit, setLiveAudit] = useState<PrivacyAuditReport | null>(null);
  const [auditing, setAuditing] = useState(false);

  const onSepolia = wallet.chainId === SEPOLIA_CHAIN_ID;
  const onMainnet = wallet.chainId === MAINNET_CHAIN_ID;
  // The target chain comes from the handoff when present, otherwise from the wallet.
  const targetChainId = handoffParams?.chainId ?? (onMainnet ? MAINNET_CHAIN_ID : SEPOLIA_CHAIN_ID);
  const targetIsMainnet = targetChainId === MAINNET_CHAIN_ID;
  const chainName = targetIsMainnet ? 'Ethereum mainnet' : 'Sepolia';
  const explorer = targetIsMainnet ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
  const readClient = targetIsMainnet ? getMainnetClient() : getSepoliaClient();
  const walletOnTarget = wallet.chainId === targetChainId;
  const canPublish =
    wallet.onWritableNetwork &&
    walletOnTarget &&
    (!targetIsMainnet || mainnetConfirmed) &&
    !publishing &&
    !!ensName.trim();

  /** Resolve the name again, live. The handoff link is never trusted for this. */
  async function runLiveAudit(name: string = ensName) {
    if (!name.trim()) return;
    setAuditing(true);
    try {
      setLiveAudit(await auditEnsName(readClient, name, { chainId: targetChainId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAuditing(false);
    }
  }

  useEffect(() => {
    if (handoffParams) void runLiveAudit(handoffParams.name);
    // Re-run only when the handoff itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffParams?.name, handoffParams?.chainId]);

  async function publish() {
    if (!identity || !wallet.client || !wallet.account || !wallet.chain) return;
    setPublishing(true);
    setError(null);
    setPublishTx(null);
    setVerified(null);
    try {
      // The resolver is discovered inside publishStealthRecord, at transaction time.
      const hash = await publishStealthRecord({
        publicClient: readClient,
        walletClient: wallet.client,
        chain: wallet.chain,
        account: wallet.account,
        name: ensName,
        stealthMetaAddress: identity.stealthMetaAddress,
        mainnetConfirmed,
      });
      setPublishTx(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }

  async function verify() {
    setError(null);
    try {
      const result = await resolveStealthMetaAddress(readClient, ensName);
      setVerified(
        result.status === 'ok'
          ? `Record live: ${result.record.slice(0, 28)}…`
          : `Record not readable yet (status: ${result.status}). New blocks take ~15s.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function downloadBackup() {
    if (!identity) return;
    const blob = new Blob([JSON.stringify(identity, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ghostname-identity.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadEncryptedCapsule() {
    if (!identity) return;
    setCapsuleMsg(null);
    try {
      const capsule = await encryptCapsule(
        { ...identity, network: 'testnet' },
        capsulePass,
      );
      const blob = new Blob([JSON.stringify(capsule, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ghostname-capsule.json';
      a.click();
      URL.revokeObjectURL(url);
      setCapsuleMsg('Encrypted capsule downloaded. Safe to store on Swarm (testnet only).');
      setCapsulePass('');
    } catch (err) {
      setCapsuleMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <h1>Create a private receive identity</h1>
      <p className="lead">
        Two keypairs are generated in this browser with a cryptographically secure RNG.
        Private keys never leave this device. There is no server.
      </p>

      {handoff && !handoff.ok && (
        <div className="card danger">
          <strong>Invalid agent handoff.</strong>
          <p className="small" style={{ marginBottom: 0 }}>
            {handoff.reason} Nothing was pre-filled. You can still use this page normally.
          </p>
        </div>
      )}

      {handoffParams && (
        <>
          <div className="card inset" data-testid="agent-handoff">
            <span className="label">Agent handoff</span>
            <p className="small" style={{ marginTop: 0 }}>
              You arrived from an AI agent. It passed only a name, a chain id and a report id.{' '}
              <strong>Key generation happens here, in this browser, outside the agent.</strong> The
              agent has not received, and will not receive, any key, record value or transaction
              authority. Publishing needs your own wallet approval.
            </p>
            <p className="small dim" style={{ marginBottom: 0 }}>
              Name <span className="mono">{handoffParams.name}</span>, chain {targetChainId} ({chainName}),
              report id <span className="mono">{handoffParams.reportId ?? 'none'}</span>. Nothing in
              the link is trusted for the privacy result: the name is resolved again live below.
              {handoff && handoff.ignored.length > 0 && (
                <> Ignored link parameters: {handoff.ignored.join(', ')}.</>
              )}
            </p>
          </div>

          <div className="card inset" data-testid="live-check">
            <span className="label">
              Live check of {handoffParams.name} on {chainName}
            </span>
            {auditing ? (
              <p className="small" style={{ margin: 0 }}>
                Resolving live…
              </p>
            ) : liveAudit ? (
              <p className="small" style={{ margin: 0 }}>
                <span className={statusPillClass(liveAudit.overallStatus)}>
                  {STATUS_LABEL[liveAudit.overallStatus]}
                </span>{' '}
                <span className="dim">{STATUS_EXPLANATION[liveAudit.overallStatus]}</span>
              </p>
            ) : null}
            <p className="small dim">
              Resolver read now:{' '}
              <span className="mono">{liveAudit?.resolver.address ?? 'not readable'}</span>. The
              resolver is discovered again at transaction time; publishing fails if none is set.
            </p>
            <button className="ghost" onClick={() => void runLiveAudit()} disabled={auditing}>
              Re-check now
            </button>
          </div>
        </>
      )}

      {!identity && (
        <>
          <button onClick={() => create()}>Generate keys locally</button>
          <h2>Or import an existing identity</h2>
          <p className="small dim">
            Paste a GhostName identity backup (JSON). It is parsed locally and stored only in
            this browser.
          </p>
          <div className="row">
            <input
              type="text"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{"spendingPrivateKey":"0x…", …}'
            />
            <button
              className="secondary"
              onClick={() => {
                try {
                  const parsed = JSON.parse(importJson) as StealthKeys;
                  if (
                    !parsed.spendingPrivateKey ||
                    !parsed.viewingPrivateKey ||
                    !parsed.stealthMetaAddress
                  ) {
                    throw new Error('missing fields');
                  }
                  saveIdentity(parsed);
                  setImportJson('');
                } catch {
                  setError('Invalid identity JSON. Expected the ghostname-identity.json backup.');
                }
              }}
              disabled={!importJson.trim()}
            >
              Import
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </>
      )}

      {identity && (
        <>
          <CopyField
            label={`ENS text record, key: ${ENS_STEALTH_RECORD_KEY}`}
            value={identity.stealthMetaAddress}
            size="xl"
          />
          <p className="small dim">
            Publish this value under the text record key{' '}
            <code>{ENS_STEALTH_RECORD_KEY}</code> on any ENS name you own. Senders resolve
            it and derive fresh one-time addresses, with no interaction with you required.
          </p>
          <CopyField label="Spending private key" value={identity.spendingPrivateKey} sensitive />
          <CopyField label="Viewing private key" value={identity.viewingPrivateKey} sensitive />
          <div className="row">
            <button className="ghost" onClick={downloadBackup}>
              Download backup (JSON)
            </button>
            <button
              className="ghost"
              onClick={() => {
                if (confirm('Discard this identity? Funds at its stealth addresses become unrecoverable.')) {
                  clear();
                }
              }}
            >
              Discard identity
            </button>
          </div>

          <div className="card inset">
            <span className="label">Encrypted recovery capsule (Swarm-ready, testnet only)</span>
            <p className="small dim" style={{ marginTop: 0 }}>
              Encrypts this identity locally (AES-256-GCM, passphrase-derived key) so it can be
              stored on Swarm without exposing keys. The passphrase never leaves this device.
            </p>
            <div className="row">
              <input
                type="text"
                value={capsulePass}
                onChange={(e) => setCapsulePass(e.target.value)}
                placeholder="passphrase (min 8 chars)"
              />
              <button
                className="ghost"
                onClick={() => void downloadEncryptedCapsule()}
                disabled={capsulePass.length < 8}
              >
                Download encrypted capsule
              </button>
            </div>
            {capsuleMsg && <p className="small dim" style={{ marginBottom: 0 }}>{capsuleMsg}</p>}
          </div>

          <h2>Publish to an ENS name</h2>
          <p className="small dim">
            {handoffParams ? `Target: ${chainName}, from the agent handoff. ` : 'Sepolia by default. '}
            {wallet.mainnetEnabled
              ? 'This build has guarded mainnet mode enabled: a mainnet publish is possible but requires an explicit typed confirmation below.'
              : 'Mainnet writes are blocked in this build. The publish path hard-fails on any chain other than Sepolia.'}
          </p>
          <div className="card danger">
            <strong>Before you approve:</strong>
            <p className="small" style={{ marginBottom: 0 }}>
              Publishing sends a real transaction from your wallet on {chainName}, writing the{' '}
              <span className="mono">{ENS_STEALTH_RECORD_KEY}</span> record to the resolver
              discovered at that moment. Review it in your wallet before approving.{' '}
              {targetIsMainnet
                ? 'Mainnet spends real ETH and the record is public and permanent.'
                : 'Sepolia uses test ETH only.'}
            </p>
          </div>
          {!wallet.account ? (
            <button className="secondary" onClick={() => void wallet.connect()}>
              Connect wallet
            </button>
          ) : (
            <>
              <p className="small">
                <span className="pill">{wallet.account}</span>{' '}
                {walletOnTarget && onSepolia ? (
                  <span className="pill ok">Sepolia</span>
                ) : walletOnTarget && onMainnet ? (
                  <span className="pill warn">Mainnet (guarded)</span>
                ) : (
                  <>
                    <span className="pill bad">
                      chain {wallet.chainId ?? '?'}, expected {targetChainId} ({chainName}), writes blocked
                    </span>{' '}
                    {!targetIsMainnet && (
                      <button className="ghost" onClick={() => void wallet.switchToSepolia()}>
                        Switch to Sepolia
                      </button>
                    )}
                    {targetIsMainnet && wallet.mainnetEnabled && (
                      <button className="ghost" onClick={() => void wallet.switchToMainnet()}>
                        Switch to Mainnet
                      </button>
                    )}
                  </>
                )}
              </p>
              {onMainnet && walletOnTarget && (
                <MainnetConfirm
                  action="record publish"
                  confirmed={mainnetConfirmed}
                  setConfirmed={setMainnetConfirmed}
                />
              )}
              <div className="row">
                <input
                  type="text"
                  value={ensName}
                  onChange={(e) => setEnsName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canPublish && void publish()}
                  placeholder={targetIsMainnet ? 'your-name.eth (owned by this wallet)' : 'your-test-name.eth (Sepolia)'}
                />
                <button onClick={() => void publish()} disabled={!canPublish}>
                  {publishing ? 'Publishing…' : 'Publish record'}
                </button>
              </div>
            </>
          )}
          {publishTx && (
            <div className="card ok">
              <span className="label">Record published. Transaction</span>
              <div className="bigmono">
                <a href={`${explorer}/tx/${publishTx}`} target="_blank" rel="noreferrer">
                  {publishTx}
                </a>
              </div>
              <div className="row" style={{ marginTop: '0.6rem' }}>
                <button className="ghost" onClick={() => void verify()}>
                  Verify record resolves
                </button>
                {verified && <span className="small dim">{verified}</span>}
              </div>
            </div>
          )}
          {publishTx && handoffParams && (
            <div className="card inset" data-testid="return-to-agent">
              <span className="label">Return to your agent</span>
              <p className="small" style={{ marginTop: 0 }}>
                Give this to your agent so it can re-audit the name and explain what improved and
                what remains public. It contains no key.
              </p>
              <CopyField
                label="Re-audit instruction"
                value={reauditInstruction({
                  name: handoffParams.name,
                  chainId: targetChainId,
                  reportId: handoffParams.reportId,
                  priorStatus: liveAudit?.overallStatus ?? null,
                })}
              />
              <button className="ghost" onClick={() => void runLiveAudit()} disabled={auditing}>
                Re-check here
              </button>
            </div>
          )}
          {wallet.error && <p className="error">{wallet.error}</p>}
          {error && <p className="error">{error}</p>}
        </>
      )}
    </>
  );
}
