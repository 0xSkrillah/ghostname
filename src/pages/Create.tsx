import { useState } from 'react';
import { saveIdentity, useIdentity } from '../state/identity';
import type { StealthKeys } from '../crypto/stealth';
import { encryptCapsule } from '../swarm/capsule';
import { useWallet } from '../state/wallet';
import { publishStealthRecord } from '../ens/write';
import { getMainnetClient, getSepoliaClient } from '../chain/clients';
import { resolveStealthMetaAddress } from '../ens/resolve';
import { ENS_STEALTH_RECORD_KEY } from '../crypto/metaAddress';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../chain/guards';
import CopyField from '../components/CopyField';
import MainnetConfirm from '../components/MainnetConfirm';

export default function Create() {
  const { identity, create, clear } = useIdentity();
  const wallet = useWallet();
  const [ensName, setEnsName] = useState('');
  const [importJson, setImportJson] = useState('');
  const [capsulePass, setCapsulePass] = useState('');
  const [capsuleMsg, setCapsuleMsg] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishTx, setPublishTx] = useState<string | null>(null);
  const [verified, setVerified] = useState<string | null>(null);
  const [mainnetConfirmed, setMainnetConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSepolia = wallet.chainId === SEPOLIA_CHAIN_ID;
  const onMainnet = wallet.chainId === MAINNET_CHAIN_ID;
  const explorer = onMainnet ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
  const readClient = onMainnet ? getMainnetClient() : getSepoliaClient();
  const canPublish =
    wallet.onWritableNetwork && (!onMainnet || mainnetConfirmed) && !publishing && !!ensName.trim();

  async function publish() {
    if (!identity || !wallet.client || !wallet.account || !wallet.chain) return;
    setPublishing(true);
    setError(null);
    setPublishTx(null);
    setVerified(null);
    try {
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
      setCapsuleMsg('Encrypted capsule downloaded — safe to store on Swarm (testnet only).');
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
        Private keys never leave this device — there is no server.
      </p>

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
                  setError('Invalid identity JSON — expected the ghostname-identity.json backup.');
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
            label={`ENS text record — key: ${ENS_STEALTH_RECORD_KEY}`}
            value={identity.stealthMetaAddress}
            size="xl"
          />
          <p className="small dim">
            Publish this value under the text record key{' '}
            <code>{ENS_STEALTH_RECORD_KEY}</code> on any ENS name you own. Senders resolve
            it and derive fresh one-time addresses — no interaction with you required.
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
            Sepolia by default. {wallet.mainnetEnabled
              ? 'This build has guarded mainnet mode enabled: a mainnet publish is possible but requires an explicit typed confirmation below.'
              : 'Mainnet writes are blocked in this build — the publish path hard-fails on any chain other than Sepolia.'}
          </p>
          {!wallet.account ? (
            <button className="secondary" onClick={() => void wallet.connect()}>
              Connect wallet
            </button>
          ) : (
            <>
              <p className="small">
                <span className="pill">{wallet.account}</span>{' '}
                {onSepolia ? (
                  <span className="pill ok">Sepolia</span>
                ) : onMainnet ? (
                  <span className="pill warn">Mainnet — guarded</span>
                ) : (
                  <>
                    <span className="pill bad">chain {wallet.chainId ?? '?'} — writes blocked</span>{' '}
                    <button className="ghost" onClick={() => void wallet.switchToSepolia()}>
                      Switch to Sepolia
                    </button>
                    {wallet.mainnetEnabled && (
                      <button className="ghost" onClick={() => void wallet.switchToMainnet()}>
                        Switch to Mainnet
                      </button>
                    )}
                  </>
                )}
              </p>
              {onMainnet && (
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
                  placeholder={onMainnet ? 'your-name.eth (owned by this wallet)' : 'your-test-name.eth (Sepolia)'}
                />
                <button onClick={() => void publish()} disabled={!canPublish}>
                  {publishing ? 'Publishing…' : 'Publish record'}
                </button>
              </div>
            </>
          )}
          {publishTx && (
            <div className="card ok">
              <span className="label">Record published — transaction</span>
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
          {wallet.error && <p className="error">{wallet.error}</p>}
          {error && <p className="error">{error}</p>}
        </>
      )}
    </>
  );
}
