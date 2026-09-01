import { useState } from 'react';
import { sepolia } from 'viem/chains';
import { saveIdentity, useIdentity } from '../state/identity';
import type { StealthKeys } from '../crypto/stealth';
import { useWallet } from '../state/wallet';
import { publishStealthRecord } from '../ens/write';
import { getSepoliaClient } from '../chain/clients';
import { resolveStealthMetaAddress } from '../ens/resolve';
import { ENS_STEALTH_RECORD_KEY } from '../crypto/metaAddress';
import { WRITABLE_CHAIN_ID } from '../chain/guards';
import CopyField from '../components/CopyField';

export default function Create() {
  const { identity, create, clear } = useIdentity();
  const wallet = useWallet();
  const [ensName, setEnsName] = useState('');
  const [importJson, setImportJson] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishTx, setPublishTx] = useState<string | null>(null);
  const [verified, setVerified] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSepolia = wallet.chainId === WRITABLE_CHAIN_ID;

  async function publish() {
    if (!identity || !wallet.client || !wallet.account) return;
    setPublishing(true);
    setError(null);
    setPublishTx(null);
    setVerified(null);
    try {
      const hash = await publishStealthRecord({
        publicClient: getSepoliaClient(),
        walletClient: wallet.client,
        chain: sepolia,
        account: wallet.account,
        name: ensName,
        stealthMetaAddress: identity.stealthMetaAddress,
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
      const result = await resolveStealthMetaAddress(getSepoliaClient(), ensName);
      setVerified(
        result.status === 'ok'
          ? `Record live on Sepolia: ${result.record.slice(0, 28)}…`
          : `Record not readable yet (status: ${result.status}). Sepolia blocks take ~15s.`,
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

          <h2>Publish to a Sepolia ENS name</h2>
          <p className="small dim">
            Testnet only. Mainnet writes are blocked in code — the publish path hard-fails on
            any chain other than Sepolia ({WRITABLE_CHAIN_ID}).
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
                ) : (
                  <>
                    <span className="pill bad">chain {wallet.chainId ?? '?'} — writes blocked</span>{' '}
                    <button className="ghost" onClick={() => void wallet.switchToSepolia()}>
                      Switch to Sepolia
                    </button>
                  </>
                )}
              </p>
              <div className="row">
                <input
                  type="text"
                  value={ensName}
                  onChange={(e) => setEnsName(e.target.value)}
                  placeholder="your-test-name.eth (owned by this wallet, on Sepolia)"
                />
                <button
                  onClick={() => void publish()}
                  disabled={publishing || !onSepolia || !ensName.trim()}
                >
                  {publishing ? 'Publishing…' : 'Publish record'}
                </button>
              </div>
            </>
          )}
          {publishTx && (
            <div className="card ok">
              <span className="label">Record published — transaction</span>
              <div className="bigmono">
                <a
                  href={`https://sepolia.etherscan.io/tx/${publishTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
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
