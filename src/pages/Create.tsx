import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { namehash, type Address, type Hex } from 'viem';
import { saveIdentity, useIdentity } from '../state/identity';
import { parseIdentityBackup } from '../crypto/identityBackup';
import { MIN_PASSPHRASE_LENGTH, assertTestnetOnly, decryptCapsule, encryptCapsule } from '../swarm/capsule';
import { useWallet } from '../state/wallet';
import {
  checkStealthRecordWritable,
  lookupResolver,
  publishStealthRecord,
  type TextSimulator,
  type WritableCheck,
} from '../ens/write';
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
  const [capsuleJson, setCapsuleJson] = useState('');
  const [capsuleRestorePass, setCapsuleRestorePass] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [writable, setWritable] = useState<WritableCheck | null>(null);
  const [checkingWritable, setCheckingWritable] = useState(false);
  const [overwriteAck, setOverwriteAck] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishTx, setPublishTx] = useState<{ hash: string; chainId: number } | null>(null);
  const [verified, setVerified] = useState<string | null>(null);
  const [mainnetConfirmed, setMainnetConfirmed] = useState(false);
  const [confirmToken, setConfirmToken] = useState(0);
  /** Preflight problems sit under the name form; publish problems inside the sign card. */
  const [checkError, setCheckError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardAck, setDiscardAck] = useState(false);
  // Focus targets for controls that unmount themselves after activation.
  const recordRef = useRef<HTMLDivElement>(null);
  const walletStatusRef = useRef<HTMLParagraphElement>(null);
  const generateRef = useRef<HTMLButtonElement>(null);
  const backupRef = useRef<HTMLDivElement>(null);

  const onSepolia = wallet.chainId === SEPOLIA_CHAIN_ID;
  // Mainnet is a write target only when the build opted in; otherwise a wallet
  // on mainnet is blocked and the page keeps working against Sepolia.
  const onMainnet = wallet.chainId === MAINNET_CHAIN_ID && wallet.mainnetEnabled;
  const mainnetBlocked = wallet.chainId === MAINNET_CHAIN_ID && !wallet.mainnetEnabled;
  const targetChainId = onMainnet ? MAINNET_CHAIN_ID : SEPOLIA_CHAIN_ID;
  const networkLabel = onMainnet ? 'Ethereum mainnet' : 'Sepolia';
  const readClient = onMainnet ? getMainnetClient() : getSepoliaClient();

  // A preflight is only valid for the network it was run against.
  const preparedValid = prepared !== null && prepared.chainId === targetChainId;
  const existing = preparedValid ? prepared.existing : null;
  const alreadyPublished =
    existing?.status === 'ok' && identity !== null && existing.record === identity.stealthMetaAddress;
  const needsAck = existing !== null && existing.status !== 'none' && !alreadyPublished;
  const writableBlocked = writable?.status === 'blocked';
  const canPublish =
    preparedValid &&
    wallet.onWritableNetwork &&
    (!onMainnet || mainnetConfirmed) &&
    !publishing &&
    !checkingWritable &&
    !writableBlocked &&
    (!needsAck || overwriteAck);

  // Once a wallet is connected on the target network, simulate the exact
  // setText from that account so a wallet that does not control the name
  // learns it here, not as a reverted transaction.
  useEffect(() => {
    if (!preparedValid || !prepared || !identity || !wallet.account || !wallet.onWritableNetwork) {
      setWritable(null);
      setCheckingWritable(false);
      return;
    }
    let cancelled = false;
    setCheckingWritable(true);
    setWritable(null);
    void checkStealthRecordWritable({
      publicClient: readClient as unknown as TextSimulator,
      account: wallet.account,
      resolver: prepared.resolver,
      node: prepared.node,
      stealthMetaAddress: identity.stealthMetaAddress,
    })
      .then((result) => {
        if (!cancelled) setWritable(result);
      })
      .finally(() => {
        if (!cancelled) setCheckingWritable(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparedValid, prepared, wallet.account, wallet.onWritableNetwork, identity?.stealthMetaAddress]);

  function importIdentity() {
    setImportError(null);
    try {
      saveIdentity(parseIdentityBackup(importJson));
      setImportJson('');
    } catch (err) {
      setImportError(describeError(err));
    }
  }

  /** Preferred import path: the file never appears on screen. */
  function importIdentityFile(file: File | undefined) {
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        saveIdentity(parseIdentityBackup(String(reader.result ?? '')));
      } catch (err) {
        setImportError(describeError(err));
      }
    };
    reader.onerror = () => setImportError('The file could not be read.');
    reader.readAsText(file);
  }

  // Pasted key material must not outlive the page.
  useEffect(() => () => setImportJson(''), []);

  /** Decrypt a capsule locally, validate the identity inside, then store it. */
  async function restoreCapsule() {
    setImportError(null);
    setRestoring(true);
    try {
      const payload = await decryptCapsule<Record<string, unknown>>(capsuleJson, capsuleRestorePass);
      assertTestnetOnly(payload as { network?: string });
      saveIdentity(parseIdentityBackup(payload));
      setCapsuleJson('');
      setCapsuleRestorePass('');
    } catch (err) {
      setImportError(describeError(err));
    } finally {
      setRestoring(false);
    }
  }

  /** Read-only preflight: resolver, node and the record currently on the name. */
  async function prepare() {
    if (!identity) return;
    setPreparing(true);
    setCheckError(null);
    setPublishError(null);
    setPrepared(null);
    setPublishTx(null);
    setVerified(null);
    setOverwriteAck(false);
    try {
      const name = normalizeEnsName(ensName);
      const lookup = await lookupResolver(readClient, name);
      if (lookup.status === 'failed') {
        throw new Error(
          `Could not read the resolver for ${name} from ${networkLabel}: ${lookup.error} ` +
            'Nothing is known yet. Retry, or set your own RPC endpoint in .env.',
        );
      }
      if (lookup.status === 'none') {
        throw new Error(
          `${name} has no resolver configured on ${networkLabel}. Set a resolver for the name ` +
            '(for example in the ENS app) before publishing. GhostName never replaces resolvers.',
        );
      }
      const current = await resolveStealthMetaAddress(readClient, name);
      setPrepared({ name, chainId: targetChainId, resolver: lookup.address, node: namehash(name), existing: current });
    } catch (err) {
      setCheckError(describeError(err));
    } finally {
      setPreparing(false);
    }
  }

  async function publish() {
    if (!identity || !wallet.client || !wallet.account || !wallet.chain || !prepared) return;
    setPublishing(true);
    setPublishError(null);
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
      setPublishTx({ hash, chainId: wallet.chain.id });
    } catch (err) {
      setPublishError(describeError(err));
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
    setPublishError(null);
    try {
      const result = await resolveStealthMetaAddress(readClient, prepared.name);
      setVerified(
        result.status === 'ok' && result.record === identity?.stealthMetaAddress
          ? `Record live on ${networkLabel}: ${result.record.slice(0, 28)}…`
          : `Record not readable yet (status: ${result.status}). New blocks take about 15 seconds; try again.`,
      );
    } catch (err) {
      setPublishError(describeError(err));
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

  function discard() {
    clear();
    setDiscardOpen(false);
    setDiscardAck(false);
    setBackupOpen(false);
    setPrepared(null);
    setPublishTx(null);
    setVerified(null);
    setTimeout(() => generateRef.current?.focus(), 0);
  }

  const capsuleTooShort = capsulePass.length > 0 && capsulePass.length < MIN_PASSPHRASE_LENGTH;
  const capsuleHint =
    capsulePass.length === 0
      ? `At least ${MIN_PASSPHRASE_LENGTH} characters. Longer and less guessable is better.`
      : capsuleTooShort
        ? `${capsulePass.length} of ${MIN_PASSPHRASE_LENGTH} characters.`
        : 'Long enough. A short dictionary phrase is still guessable offline.';

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
          <button
            ref={generateRef}
            onClick={() => {
              create();
              setTimeout(() => recordRef.current?.focus(), 0);
            }}
          >
            Generate keys locally
          </button>
          <h2>Or import an existing identity</h2>
          <p className="small dim">
            Choose the <code>ghostname-identity.json</code> backup file, or paste its contents.
            Either way it is validated locally (both keys must be valid and must match the
            meta-address) and stored only in this browser. Do this off camera and with screen
            sharing paused: the pasted text is not masked. Never import keys that hold real
            assets.
          </p>
          <label className="label" htmlFor="import-file">
            Identity backup file (preferred, never shown on screen)
          </label>
          <input
            id="import-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) => importIdentityFile(e.target.files?.[0])}
          />
          <label className="label" htmlFor="import-json" style={{ marginTop: '0.6rem' }}>
            Or paste the identity backup JSON
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

          <h2>Or restore from an encrypted capsule</h2>
          <p className="small dim">
            Paste the <code>ghostname-capsule.json</code> contents and its passphrase. Decryption
            and validation happen in this browser; nothing is sent anywhere.
          </p>
          <label className="label" htmlFor="capsule-json">
            Encrypted capsule JSON
          </label>
          <textarea
            id="capsule-json"
            value={capsuleJson}
            onChange={(e) => setCapsuleJson(e.target.value)}
            placeholder='{"format":"ghostname-capsule", …}'
            autoComplete="off"
            spellCheck={false}
          />
          <label className="label" htmlFor="capsule-restore-pass" style={{ marginTop: '0.5rem' }}>
            Capsule passphrase
          </label>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!restoring && capsuleJson.trim() && capsuleRestorePass) void restoreCapsule();
            }}
          >
            <input
              id="capsule-restore-pass"
              type="password"
              value={capsuleRestorePass}
              onChange={(e) => setCapsuleRestorePass(e.target.value)}
              placeholder="capsule passphrase"
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="secondary"
              disabled={restoring || !capsuleJson.trim() || !capsuleRestorePass}
              aria-busy={restoring}
            >
              {restoring ? 'Decrypting…' : 'Restore capsule'}
            </button>
          </form>
          {importError && (
            <p className="error" role="alert">
              {importError}
            </p>
          )}
        </>
      )}

      {identity && (
        <>
          <div ref={recordRef} tabIndex={-1}>
            <CopyField
              label={`ENS text record, key: ${ENS_STEALTH_RECORD_KEY}`}
              value={identity.stealthMetaAddress}
              size="xl"
            />
          </div>
          <p className="small dim">
            Publish this value under the text record key{' '}
            <code>{ENS_STEALTH_RECORD_KEY}</code> on any ENS name you own. Senders resolve
            it and derive fresh one-time addresses, with no interaction with you required.
            The private keys stay in this browser; back them up below before you rely on this
            identity.
          </p>

          <h2>Publish to an ENS name</h2>
          <p className="small dim">
            You need: a browser wallet connected on {networkLabel}, a name that wallet
            controls, and a resolver already set on that name.{' '}
            {wallet.mainnetEnabled
              ? 'This build has guarded mainnet mode enabled: a mainnet publish is possible but requires an explicit typed confirmation for every action.'
              : 'Mainnet writes are blocked in this build. The publish path hard-fails on any chain other than Sepolia.'}
          </p>
          {!wallet.account ? (
            <div className="row">
              <button
                className="secondary"
                onClick={() => {
                  void wallet.connect().then(() => setTimeout(() => walletStatusRef.current?.focus(), 0));
                }}
              >
                Connect wallet
              </button>
              {!wallet.available && !wallet.error && (
                <span className="small dim">
                  No browser wallet detected. Install MetaMask or a similar wallet, switch it to{' '}
                  {networkLabel}, then reload this page.
                </span>
              )}
            </div>
          ) : (
            <p className="small" ref={walletStatusRef} tabIndex={-1}>
              <span className="pill">{wallet.account}</span>{' '}
              {onSepolia ? (
                <span className="pill ok">Sepolia</span>
              ) : onMainnet ? (
                <span className="pill warn">Mainnet (guarded)</span>
              ) : (
                <>
                  <span className="pill bad">
                    {mainnetBlocked
                      ? 'Mainnet: read-only in this build, writes blocked'
                      : `chain ${wallet.chainId ?? '?'}, writes blocked`}
                  </span>{' '}
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
          {wallet.error && (
            <p className="error small" role="alert" style={{ margin: '0.4rem 0 0' }}>
              {wallet.error}
            </p>
          )}
          <label className="label" htmlFor="publish-name" style={{ marginTop: '0.8rem' }}>
            ENS name you control
          </label>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!preparing && ensName.trim()) void prepare();
            }}
          >
            <input
              id="publish-name"
              type="text"
              value={ensName}
              onChange={(e) => {
                setEnsName(e.target.value);
                setPrepared(null);
                setWritable(null);
                setPublishTx(null);
                setVerified(null);
                setCheckError(null);
              }}
              placeholder={onMainnet ? 'your-name.eth (owned by this wallet)' : 'your-test-name.eth (Sepolia)'}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              aria-invalid={checkError !== null}
            />
            <button type="submit" className="secondary" disabled={preparing || !ensName.trim()}>
              {preparing ? 'Checking…' : preparedValid ? 'Check again' : `Check name on ${networkLabel}`}
            </button>
          </form>
          {checkError && (
            <p className="error small" role="alert" style={{ margin: '0.4rem 0 0' }}>
              {checkError}
            </p>
          )}

          <div aria-live="polite" aria-busy={preparing || publishing}>
            {preparedValid && prepared && (
              <div className="card inset">
                <span className="label">You will sign one transaction on {networkLabel}</span>
                <table className="plain">
                  <tbody>
                    <tr>
                      <th scope="row" className="small dim">contract (the name's resolver)</th>
                      <td className="mono small" style={{ wordBreak: 'break-all' }}>{prepared.resolver}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="small dim">function</th>
                      <td className="mono small">setText(node, key, value)</td>
                    </tr>
                    <tr>
                      <th scope="row" className="small dim">node</th>
                      <td className="mono small" style={{ wordBreak: 'break-all' }}>{prepared.node}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="small dim">key</th>
                      <td className="mono small">{ENS_STEALTH_RECORD_KEY}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="small dim">value</th>
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
                {wallet.account && wallet.onWritableNetwork && (
                  <div style={{ marginTop: '0.6rem' }}>
                    {checkingWritable && (
                      <p className="small dim" style={{ margin: 0 }} role="status">
                        Checking that this wallet can write to the resolver (simulated, nothing sent)…
                      </p>
                    )}
                    {writable?.status === 'ok' && (
                      <p className="small" style={{ margin: 0 }} role="status">
                        <span className="pill ok">this wallet can write the record</span>{' '}
                        <span className="dim">The resolver accepted a simulated setText from your wallet.</span>
                      </p>
                    )}
                    {writable?.status === 'blocked' && (
                      <div className="card danger" style={{ margin: 0 }} role="alert">
                        <strong>This wallet cannot write to the resolver of {prepared.name}.</strong>
                        <p className="small" style={{ margin: '0.3rem 0 0' }}>
                          A simulated setText from {wallet.account} was rejected, which is what
                          happens when the wallet does not own or manage the name. Connect the
                          wallet that controls it. Nothing was sent.
                        </p>
                      </div>
                    )}
                    {writable?.status === 'unknown' && (
                      <p className="small" style={{ margin: 0, color: 'var(--warn)' }} role="status">
                        Could not confirm that this wallet can write the record ({writable.reason}).
                        The transaction may revert; nothing is assumed either way.
                      </p>
                    )}
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
                {publishError && (
                  <p className="error small" role="alert" style={{ margin: '0.5rem 0 0' }}>
                    {publishError}
                  </p>
                )}
              </div>
            )}
            {publishTx && (
              <div className="card ok">
                <span className="label">Record published. Transaction</span>
                <div className="bigmono">
                  <a
                    href={`${publishTx.chainId === MAINNET_CHAIN_ID ? 'https://etherscan.io' : 'https://sepolia.etherscan.io'}/tx/${publishTx.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {publishTx.hash}
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
                <p className="small dim" style={{ margin: '0.6rem 0 0' }}>
                  Next: <Link to="/pay">pay this name privately</Link> from any wallet, then{' '}
                  <Link to="/receive">discover the payment</Link> here with the start block set
                  to just before the payment.
                </p>
              </div>
            )}
          </div>

          <h2>Back up this identity</h2>
          <p className="small dim">
            Both private keys live only in this browser's local storage. Export them before you
            rely on this identity. The encrypted capsule is the safe form for anything that
            leaves this device.
          </p>
          <button
            className="ghost"
            onClick={() => {
              setBackupOpen((o) => !o);
              if (!backupOpen) setTimeout(() => backupRef.current?.focus(), 0);
            }}
            aria-expanded={backupOpen}
            aria-controls="backup-panel"
          >
            {backupOpen ? 'Hide keys and backup options' : 'Show keys and backup options'}
          </button>
          {backupOpen && (
            <div id="backup-panel" ref={backupRef} tabIndex={-1} style={{ marginTop: '0.6rem' }}>
              <CopyField label="Spending private key" value={identity.spendingPrivateKey} sensitive />
              <CopyField label="Viewing private key" value={identity.viewingPrivateKey} sensitive />
              <div className="row">
                <button className="ghost" onClick={downloadBackup}>
                  Download backup (plaintext JSON)
                </button>
              </div>
              <p className="small dim" style={{ marginTop: '0.3rem' }}>
                The plaintext backup contains both private keys. Store it offline. Prefer the
                encrypted capsule below for anything that leaves this device.
              </p>

              <div className="card inset">
                <span className="label">Encrypted recovery capsule (Swarm-ready, testnet only)</span>
                <p className="small dim" style={{ marginTop: 0 }}>
                  Encrypts this identity locally (AES-256-GCM, key derived with PBKDF2-SHA256 at
                  600,000 iterations) so it can be stored on Swarm without exposing keys. The
                  passphrase never leaves this device. Restore it later with "Restore from an
                  encrypted capsule".
                </p>
                <label className="label" htmlFor="capsule-pass">
                  Capsule passphrase
                </label>
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (capsulePass.length >= MIN_PASSPHRASE_LENGTH) void downloadEncryptedCapsule();
                  }}
                >
                  <input
                    id="capsule-pass"
                    type="password"
                    value={capsulePass}
                    onChange={(e) => setCapsulePass(e.target.value)}
                    placeholder={`passphrase (min ${MIN_PASSPHRASE_LENGTH} chars)`}
                    autoComplete="new-password"
                    aria-describedby="capsule-pass-hint"
                    aria-invalid={capsuleTooShort || undefined}
                  />
                  <button type="submit" className="ghost" disabled={capsulePass.length < MIN_PASSPHRASE_LENGTH}>
                    Download encrypted capsule
                  </button>
                </form>
                <p id="capsule-pass-hint" className="small dim" style={{ margin: '0.3rem 0 0' }} role="status">
                  {capsuleHint}
                </p>
                {capsuleMsg && (
                  <p className="small dim" style={{ marginBottom: 0 }} role="status">
                    {capsuleMsg}
                  </p>
                )}
              </div>
            </div>
          )}

          <h2>Discard this identity</h2>
          <p className="small dim">
            Removes the keys from this browser. Anything already sent to this identity's stealth
            addresses becomes unrecoverable unless you kept a backup.
          </p>
          {!discardOpen ? (
            <button className="danger" onClick={() => setDiscardOpen(true)}>
              Discard identity…
            </button>
          ) : (
            <div className="card danger" role="group" aria-label="Discard identity confirmation">
              <strong>Discard the keys stored in this browser?</strong>
              <label
                className="small"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.6rem' }}
              >
                <input
                  type="checkbox"
                  checked={discardAck}
                  onChange={(e) => setDiscardAck(e.target.checked)}
                />
                I understand that funds at this identity's stealth addresses become unrecoverable
                without a backup.
              </label>
              <div className="row" style={{ marginTop: '0.6rem' }}>
                <button className="danger" disabled={!discardAck} onClick={discard}>
                  Discard identity
                </button>
                <button
                  className="ghost"
                  onClick={() => {
                    setDiscardOpen(false);
                    setDiscardAck(false);
                  }}
                >
                  Keep it
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
