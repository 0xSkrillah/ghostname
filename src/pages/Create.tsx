import { useState } from 'react';
import { namehash, type Address, type Hex } from 'viem';
import { saveIdentity, useIdentity } from '../state/identity';
import { parseIdentityBackup } from '../crypto/identityBackup';
import { encryptCapsule } from '../swarm/capsule';
import { useWallet } from '../state/wallet';
import { getResolverAddress, publishStealthRecord } from '../ens/write';
import { getMainnetClient, getSepoliaClient } from '../chain/clients';
import {
  normalizeEnsName,
  resolveStealthMetaAddress,
  type StealthResolution,
} from '../ens/resolve';
import { ENS_STEALTH_RECORD_KEY } from '../crypto/metaAddress';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../chain/guards';
import { describeError } from '../lib/describeError';
import CopyField from '../components/CopyField';
import MainnetConfirm from '../components/MainnetConfirm';

/** Everything the user should see before signing the setText transaction. */
interface Prepared {
  name: string;
  chainId: number;
  resolver: Address;
  node: Hex;
  existing: StealthResolution;
}

function truncateRecord(value: string): string {
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}

export default function Create() {
  const { identity, create, clear } = useIdentity();
  const wallet = useWallet();
  const [ensName, setEnsName] = useState('');
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [capsulePass, setCapsulePass] = useState('');
  const [capsuleMsg, setCapsuleMsg] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [overwriteAck, setOverwriteAck] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishTx, setPublishTx] = useState<string | null>(null);
  const [verified, setVerified] = useState<string | null>(null);
  const [mainnetConfirmed, setMainnetConfirmed] = useState(false);
  const [confirmToken, setConfirmToken] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onSepolia = wallet.chainId === SEPOLIA_CHAIN_ID;
  const onMainnet = wallet.chainId === MAINNET_CHAIN_ID;
  const targetChainId = onMainnet ? MAINNET_CHAIN_ID : SEPOLIA_CHAIN_ID;
  const networkLabel = onMainnet ? 'Ethereum mainnet' : 'Sepolia';
  const explorer = onMainnet ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
  const readClient = onMainnet ? getMainnetClient() : getSepoliaClient();

  // A preflight is only valid for the network it was run against.
  const preparedValid = prepared !== null && prepared.chainId === targetChainId;
  const existing = preparedValid ? prepared.existing : null;
  const alreadyPublished =
    existing?.status === 'ok' && identity !== null && existing.record === identity.stealthMetaAddress;
  const needsAck = existing !== null && existing.status !== 'none' && !alreadyPublished;
  const canPublish =
    preparedValid &&
    wallet.onWritableNetwork &&
    (!onMainnet || mainnetConfirmed) &&
    !publishing &&
    (!needsAck || overwriteAck);

  function importIdentity() {
    setImportError(null);
    try {
      saveIdentity(parseIdentityBackup(importJson));
      setImportJson('');
    } catch (err) {
      setImportError(describeError(err));
    }
  }

  /** Read-only preflight: resolver, node and the record currently on the name. */
  async function prepare() {
    if (!identity) return;
    setPreparing(true);
    setError(null);
    setPrepared(null);
    setPublishTx(null);
    setVerified(null);
    setOverwriteAck(false);
    try {
      const name = normalizeEnsName(ensName);
      const resolver = await getResolverAddress(readClient, name);
      if (!resolver) {
        throw new Error(
          `${name} has no resolver configured on ${networkLabel}. Set a resolver for the name ` +
            '(for example in the ENS app) before publishing. GhostName never replaces resolvers.',
        );
      }
      const current = await resolveStealthMetaAddress(readClient, name);
      setPrepared({ name, chainId: targetChainId, resolver, node: namehash(name), existing: current });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPreparing(false);
    }
  }

  async function publish() {
    if (!identity || !wallet.client || !wallet.account || !wallet.chain || !prepared) return;
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
        name: prepared.name,
        stealthMetaAddress: identity.stealthMetaAddress,
        mainnetConfirmed,
      });
      setPublishTx(hash);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPublishing(false);
      // Every attempt consumes the confirmation: retype for the next action.
      setMainnetConfirmed(false);
      setConfirmToken((t) => t + 1);
      setOverwriteAck(false);
    }
  }

  async function verify() {
    if (!prepared) return;
    setError(null);
    try {
      const result = await resolveStealthMetaAddress(readClient, prepared.name);
      setVerified(
        result.status === 'ok' && result.record === identity?.stealthMetaAddress
          ? `Record live on ${networkLabel}: ${result.record.slice(0, 28)}…`
          : `Record not readable yet (status: ${result.status}). New blocks take about 15 seconds; try again.`,
      );
    } catch (err) {
      setError(describeError(err));
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
      const capsule = await encryptCapsule({ ...identity, network: 'testnet' }, capsulePass);
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
      setCapsuleMsg(describeError(err));
    }
  }

  return (
    <>
      <h1>Create a private receive identity</h1>
      <p className="lead">
        Two keypairs are generated in this browser with a cryptographically secure RNG.
        Private keys never leave this device. There is no server. Testnet demo custody: keys
        stay in this browser's local storage until you discard them.
      </p>

      {!identity && (
        <>
          <button onClick={() => create()}>Generate keys locally</button>
          <h2>Or import an existing identity</h2>
          <p className="small dim">
            Paste the <code>ghostname-identity.json</code> backup. It is validated locally
            (both keys must be valid and must match the meta-address) and stored only in this
            browser. Never paste keys that hold real assets.
          </p>
          <label className="sr-only" htmlFor="import-json">
            Identity backup JSON
          </label>
          <textarea
            id="import-json"
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='{"spendingPrivateKey":"0x…","viewingPrivateKey":"0x…", …}'
            autoComplete="off"
            spellCheck={false}
          />
          <div className="row" style={{ marginTop: '0.5rem' }}>
            <button className="secondary" onClick={importIdentity} disabled={!importJson.trim()}>
              Import
            </button>
          </div>
          {importError && (
            <p className="error" role="alert">
              {importError}
            </p>
          )}
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
              Download backup (plaintext JSON)
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
          <p className="small dim" style={{ marginTop: '0.3rem' }}>
            The plaintext backup contains both private keys. Store it offline. Prefer the
            encrypted capsule below for anything that leaves this device.
          </p>

          <div className="card inset">
            <span className="label">Encrypted recovery capsule (Swarm-ready, testnet only)</span>
            <p className="small dim" style={{ marginTop: 0 }}>
              Encrypts this identity locally (AES-256-GCM, passphrase-derived key) so it can be
              stored on Swarm without exposing keys. The passphrase never leaves this device.
            </p>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (capsulePass.length >= 8) void downloadEncryptedCapsule();
              }}
            >
              <label className="sr-only" htmlFor="capsule-pass">
                Capsule passphrase, at least 8 characters
              </label>
              <input
                id="capsule-pass"
                type="password"
                value={capsulePass}
                onChange={(e) => setCapsulePass(e.target.value)}
                placeholder="passphrase (min 8 chars)"
                autoComplete="new-password"
              />
              <button type="submit" className="ghost" disabled={capsulePass.length < 8}>
                Download encrypted capsule
              </button>
            </form>
            {capsuleMsg && (
              <p className="small dim" style={{ marginBottom: 0 }} role="status">
                {capsuleMsg}
              </p>
            )}
          </div>

          <h2>Publish to an ENS name</h2>
          <p className="small dim">
            You need: a browser wallet connected on {networkLabel}, a name that wallet
            controls, and a resolver already set on that name.{' '}
            {wallet.mainnetEnabled
              ? 'This build has guarded mainnet mode enabled: a mainnet publish is possible but requires an explicit typed confirmation for every action.'
              : 'Mainnet writes are blocked in this build. The publish path hard-fails on any chain other than Sepolia.'}
          </p>
          {!wallet.account ? (
            <button className="secondary" onClick={() => void wallet.connect()}>
              Connect wallet
            </button>
          ) : (
            <p className="small">
              <span className="pill">{wallet.account}</span>{' '}
              {onSepolia ? (
                <span className="pill ok">Sepolia</span>
              ) : onMainnet ? (
                <span className="pill warn">Mainnet (guarded)</span>
              ) : (
                <>
                  <span className="pill bad">chain {wallet.chainId ?? '?'}, writes blocked</span>{' '}
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
          )}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!preparing && ensName.trim()) void prepare();
            }}
          >
            <label className="sr-only" htmlFor="publish-name">
              ENS name you control
            </label>
            <input
              id="publish-name"
              type="text"
              value={ensName}
              onChange={(e) => {
                setEnsName(e.target.value);
                setPrepared(null);
                setPublishTx(null);
                setVerified(null);
              }}
              placeholder={onMainnet ? 'your-name.eth (owned by this wallet)' : 'your-test-name.eth (Sepolia)'}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
            />
            <button type="submit" className="secondary" disabled={preparing || !ensName.trim()}>
              {preparing ? 'Checking…' : preparedValid ? 'Check again' : `Check name on ${networkLabel}`}
            </button>
          </form>

          <div aria-live="polite" aria-busy={preparing || publishing}>
            {preparedValid && prepared && (
              <div className="card inset">
                <span className="label">You will sign one transaction on {networkLabel}</span>
                <table className="plain">
                  <tbody>
                    <tr>
                      <td className="small dim">contract (the name's resolver)</td>
                      <td className="mono small" style={{ wordBreak: 'break-all' }}>{prepared.resolver}</td>
                    </tr>
                    <tr>
                      <td className="small dim">function</td>
                      <td className="mono small">setText(node, key, value)</td>
                    </tr>
                    <tr>
                      <td className="small dim">node</td>
                      <td className="mono small" style={{ wordBreak: 'break-all' }}>{prepared.node}</td>
                    </tr>
                    <tr>
                      <td className="small dim">key</td>
                      <td className="mono small">{ENS_STEALTH_RECORD_KEY}</td>
                    </tr>
                    <tr>
                      <td className="small dim">value</td>
                      <td className="mono small" style={{ wordBreak: 'break-all' }}>{identity.stealthMetaAddress}</td>
                    </tr>
                  </tbody>
                </table>
                {alreadyPublished && (
                  <p className="small" style={{ color: 'var(--accent)' }}>
                    This exact record is already published on {prepared.name}. Publishing again
                    is not needed.
                  </p>
                )}
                {needsAck && existing && (
                  <div className="card danger" style={{ marginBottom: 0 }}>
                    <strong>
                      {prepared.name} already has a{' '}
                      {existing.status === 'ok' ? 'different' : 'malformed'} stealth record.
                    </strong>
                    <p className="small">
                      {existing.status === 'ok'
                        ? 'Senders who resolve the name today derive addresses for the identity below. Replacing it moves future payments to this browser identity; anything already sent to the old identity stays with whoever holds its keys.'
                        : 'The current value does not parse as a scheme-1 meta-address, so conforming senders already ignore it.'}
                    </p>
                    <div className="bigmono small" style={{ color: 'var(--static-col)' }}>
                      {truncateRecord(existing.record)}
                    </div>
                    <label
                      className="small"
                      style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.6rem' }}
                    >
                      <input
                        type="checkbox"
                        checked={overwriteAck}
                        onChange={(e) => setOverwriteAck(e.target.checked)}
                      />
                      I understand this replaces the existing record.
                    </label>
                  </div>
                )}
                {onMainnet && (
                  <MainnetConfirm
                    action="record publish"
                    confirmed={mainnetConfirmed}
                    setConfirmed={setMainnetConfirmed}
                    resetToken={confirmToken}
                  />
                )}
                <div className="row" style={{ marginTop: '0.7rem' }}>
                  <button onClick={() => void publish()} disabled={!canPublish}>
                    {publishing ? 'Confirm in wallet…' : `Publish record on ${networkLabel}`}
                  </button>
                  {!wallet.account && <span className="small dim">Connect a wallet to publish.</span>}
                  {wallet.account && !wallet.onWritableNetwork && (
                    <span className="small error">Switch the wallet to a permitted network first.</span>
                  )}
                </div>
              </div>
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
                  {verified && (
                    <span className="small dim" role="status">
                      {verified}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          {wallet.error && (
            <p className="error" role="alert">
              {wallet.error}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </>
  );
}
