import { useState } from 'react';
import { formatEther, type Hex } from 'viem';
import { getSepoliaClient } from '../chain/clients';
import {
  fetchAnnouncements,
  recogniseOwnedAnnouncements,
  type Announcement,
} from '../chain/announcer';
import {
  computeStealthPrivateKey,
  generateStealthKeys,
  privateKeyToAddress,
} from '../crypto/stealth';
import { useIdentity } from '../state/identity';
import { SCAN_START_BLOCK } from '../config';

interface ScanOutcome {
  scannedFrom: bigint;
  scannedTo: bigint;
  total: number;
  owned: Announcement[];
  /** Result of running the SAME scan with a random unrelated viewing key. */
  strangerMatches: number;
  verified: Array<{ address: string; ok: boolean }>;
}

const DEFAULT_LOOKBACK = 50_000n;

export default function Receive() {
  const { identity } = useIdentity();
  const [fromBlock, setFromBlock] = useState(SCAN_START_BLOCK?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

  async function scan() {
    if (!identity) return;
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      const client = getSepoliaClient();
      const latest = await client.getBlockNumber();
      const from = fromBlock.trim()
        ? BigInt(fromBlock.trim())
        : latest > DEFAULT_LOOKBACK
          ? latest - DEFAULT_LOOKBACK
          : 0n;
      const announcements = await fetchAnnouncements(client, {
        fromBlock: from,
        toBlock: latest,
      });
      const owned = recogniseOwnedAnnouncements(announcements, {
        viewingPrivateKey: identity.viewingPrivateKey as Hex,
        spendingPublicKey: identity.spendingPublicKey as Hex,
      });
      // Negative control, run live every time: a freshly generated unrelated
      // viewing key must recognise nothing.
      const stranger = generateStealthKeys();
      const strangerMatches = recogniseOwnedAnnouncements(announcements, {
        viewingPrivateKey: stranger.viewingPrivateKey as Hex,
        spendingPublicKey: stranger.spendingPublicKey as Hex,
      }).length;
      // Prove spending control: derived stealth key must map to the address.
      const verified = owned.map((a) => {
        const key = computeStealthPrivateKey({
          spendingPrivateKey: identity.spendingPrivateKey as Hex,
          viewingPrivateKey: identity.viewingPrivateKey as Hex,
          ephemeralPublicKey: a.ephemeralPublicKey,
        });
        return {
          address: a.stealthAddress,
          ok: privateKeyToAddress(key).toLowerCase() === a.stealthAddress.toLowerCase(),
        };
      });
      setOutcome({
        scannedFrom: from,
        scannedTo: latest,
        total: announcements.length,
        owned,
        strangerMatches,
        verified,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function amountOf(a: Announcement): string {
    // Native-ETH metadata: amount is the last 32 bytes.
    if (a.metadata.length === 2 + 57 * 2) {
      try {
        return `${formatEther(BigInt(`0x${a.metadata.slice(52)}`))} ETH`;
      } catch {
        return '';
      }
    }
    return '';
  }

  if (!identity) {
    return (
      <>
        <h1>Receive</h1>
        <p className="lead">
          No local identity found. <a href="/create">Create one first</a> — the scanner needs
          your viewing key (which never leaves this device).
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Discover your payments</h1>
      <p className="lead">
        Scans ERC-5564 announcements on Sepolia and recognises yours with the private
        viewing key — locally. Observers (and other recipients) cannot do this.
      </p>
      <div className="row">
        <input
          type="text"
          value={fromBlock}
          onChange={(e) => setFromBlock(e.target.value)}
          placeholder={`from block (default: latest − ${DEFAULT_LOOKBACK})`}
        />
        <button onClick={() => void scan()} disabled={busy}>
          {busy ? 'Scanning…' : 'Scan announcements'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {outcome && (
        <>
          <div className="card inset">
            <span className="label">Scan result</span>
            <p style={{ margin: 0 }}>
              Blocks <code>{outcome.scannedFrom.toString()}</code> →{' '}
              <code>{outcome.scannedTo.toString()}</code>: {outcome.total} scheme-1
              announcement{outcome.total === 1 ? '' : 's'} on the network,{' '}
              <strong style={{ color: 'var(--stealth-col)' }}>
                {outcome.owned.length} recognised as yours
              </strong>
              .
            </p>
          </div>

          <div className="card">
            <span className="label">Live negative control</span>
            <p style={{ margin: 0 }} className="small">
              The same scan re-run with a freshly generated unrelated viewing key recognised{' '}
              <strong style={{ color: outcome.strangerMatches === 0 ? 'var(--accent)' : 'var(--danger)' }}>
                {outcome.strangerMatches}
              </strong>{' '}
              payment{outcome.strangerMatches === 1 ? '' : 's'} — recognition requires the
              recipient's private viewing key, not just public data.
            </p>
          </div>

          {outcome.owned.map((a) => {
            const verification = outcome.verified.find((v) => v.address === a.stealthAddress);
            return (
              <div className="card ok" key={a.transactionHash + a.stealthAddress}>
                <span className="label">Payment recognised</span>
                <div className="bigmono" style={{ color: 'var(--stealth-col)' }}>
                  {a.stealthAddress}
                </div>
                <p className="small dim" style={{ margin: '0.4rem 0 0' }}>
                  {amountOf(a) && <>amount {amountOf(a)} · </>}block{' '}
                  {a.blockNumber.toString()} · view tag {a.viewTag} ·{' '}
                  <a
                    href={`https://sepolia.etherscan.io/tx/${a.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    announcement tx
                  </a>
                </p>
                <p className="small" style={{ margin: '0.4rem 0 0' }}>
                  Spending-key check:{' '}
                  {verification?.ok ? (
                    <span className="pill ok">
                      derived stealth private key controls this address ✓
                    </span>
                  ) : (
                    <span className="pill bad">verification failed</span>
                  )}{' '}
                  <span className="dim">(key derived locally, never displayed or sent)</span>
                </p>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
