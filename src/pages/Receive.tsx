import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatEther, type Hex } from 'viem';
import { getSepoliaClient } from '../chain/clients';
import { SEPOLIA_CHAIN_ID } from '../chain/guards';
import SweepPanel from '../components/SweepPanel';
import SweepProofPanel from '../components/SweepProofPanel';
import PaymentProofPanel from '../components/PaymentProofPanel';
import {
  fetchAnnouncements,
  recogniseOwnedAnnouncements,
  resolveScanStart,
  type Announcement,
} from '../chain/announcer';
import {
  computeStealthPrivateKey,
  generateStealthKeys,
  privateKeyToAddress,
} from '../crypto/stealth';
import { useIdentity } from '../state/identity';
import { SCAN_START_BLOCK } from '../config';
import { describeError } from '../lib/describeError';

interface ScanOutcome {
  scannedFrom: bigint;
  scannedTo: bigint;
  total: number;
  owned: Announcement[];
  /** Result of running the SAME scan with a random unrelated viewing key. */
  strangerMatches: number;
  verified: Array<{ address: string; ok: boolean; stealthPrivateKey: Hex }>;
  /** Current on-chain balance per recognised address; null when the RPC read failed. */
  balances: Record<string, bigint | null>;
}

const DEFAULT_LOOKBACK = 50_000n;
const MAX_BALANCE_LOOKUPS = 25;

/**
 * The amount a SENDER declared in announcement metadata. It is not verified by
 * anyone on-chain: anybody who knows a public meta-address can announce any
 * figure for an address they never funded. Only the balance is authoritative.
 */
function declaredAmountWei(a: Announcement): bigint | null {
  // Native-ETH metadata: view tag (1) + selector (4) + marker (20) + amount (32) = 57 bytes.
  if (a.metadata.length !== 2 + 57 * 2) return null;
  try {
    return BigInt(`0x${a.metadata.slice(52)}`);
  } catch {
    return null;
  }
}

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
      const from = resolveScanStart(fromBlock, latest, DEFAULT_LOOKBACK);
      const announcements = await fetchAnnouncements(client, { fromBlock: from, toBlock: latest });
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
          stealthPrivateKey: key,
        };
      });
      // Authoritative amounts: read balances instead of trusting announced metadata.
      const balances: Record<string, bigint | null> = {};
      const uniqueOwned = [...new Set(owned.map((a) => a.stealthAddress.toLowerCase()))].slice(
        0,
        MAX_BALANCE_LOOKUPS,
      );
      await Promise.all(
        uniqueOwned.map(async (address) => {
          try {
            balances[address] = await client.getBalance({ address: address as `0x${string}` });
          } catch {
            balances[address] = null;
          }
        }),
      );
      setOutcome({
        scannedFrom: from,
        scannedTo: latest,
        total: announcements.length,
        owned,
        strangerMatches,
        verified,
        balances,
      });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!identity) {
    return (
      <>
        <h1>Receive</h1>
        <p className="lead">
          No local identity found. <Link to="/create">Create or import one first</Link>. The
          scanner needs your viewing key, which never leaves this device.
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Discover your payments</h1>
      <p className="lead">
        Scans ERC-5564 announcements on Sepolia and recognises yours with the private
        viewing key, locally. Observers (and other recipients) cannot do this. Scans are
        bounded: set the start block to just before your payments.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void scan();
        }}
      >
        <label className="sr-only" htmlFor="scan-from-block">
          Start block for the announcement scan
        </label>
        <input
          id="scan-from-block"
          type="text"
          inputMode="numeric"
          value={fromBlock}
          onChange={(e) => setFromBlock(e.target.value)}
          placeholder={`start block (empty = latest minus ${DEFAULT_LOOKBACK.toString()})`}
          autoComplete="off"
        />
        <button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Scanning…' : 'Scan announcements'}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div aria-live="polite" aria-busy={busy}>
        {busy && (
          <p className="dim small" role="status">
            Reading announcements from Sepolia and checking them with your viewing key…
          </p>
        )}
        {outcome && (
          <>
            <div className="card inset">
              <span className="label">Scan result</span>
              <p style={{ margin: 0 }}>
                Blocks <code>{outcome.scannedFrom.toString()}</code> to{' '}
                <code>{outcome.scannedTo.toString()}</code>: {outcome.total} scheme-1
                announcement{outcome.total === 1 ? '' : 's'} on the network,{' '}
                <strong style={{ color: 'var(--stealth-col)' }}>
                  {outcome.owned.length} recognised as yours
                </strong>
                .
              </p>
              {outcome.owned.length === 0 && (
                <p className="small dim" style={{ marginBottom: 0 }}>
                  Nothing recognised in this range. If you expect a payment, widen the range
                  by lowering the start block, or check that the sender resolved the name that
                  publishes this identity's record.
                </p>
              )}
            </div>

            <div className="card">
              <span className="label">Live negative control</span>
              <p style={{ margin: 0 }} className="small">
                The same scan re-run with a freshly generated unrelated viewing key recognised{' '}
                <strong style={{ color: outcome.strangerMatches === 0 ? 'var(--accent)' : 'var(--danger)' }}>
                  {outcome.strangerMatches}
                </strong>{' '}
                payment{outcome.strangerMatches === 1 ? '' : 's'}
                {outcome.strangerMatches === 0 ? ' (expected: zero)' : ' (unexpected)'}. Recognition
                requires the recipient's private viewing key, not just public data.
              </p>
            </div>

            {outcome.owned.map((a) => {
              const verification = outcome.verified.find((v) => v.address === a.stealthAddress);
              const balance = outcome.balances[a.stealthAddress.toLowerCase()];
              const declared = declaredAmountWei(a);
              return (
                <div className="card ok" key={a.transactionHash + a.stealthAddress}>
                  <span className="label">Payment recognised</span>
                  <div className="bigmono" style={{ color: 'var(--stealth-col)' }}>
                    {a.stealthAddress}
                  </div>
                  <p className="small" style={{ margin: '0.4rem 0 0' }}>
                    Balance now:{' '}
                    <strong>
                      {balance === undefined
                        ? 'not checked'
                        : balance === null
                          ? 'unknown (balance read failed)'
                          : `${formatEther(balance)} ETH`}
                    </strong>{' '}
                    <span className="dim">(read from chain; this is the figure to trust)</span>
                  </p>
                  <p className="small dim" style={{ margin: '0.2rem 0 0' }}>
                    Announced by the sender:{' '}
                    {declared === null ? 'no amount in metadata' : `${formatEther(declared)} ETH`}{' '}
                    (sender-supplied, not verified)
                    {declared !== null && balance !== undefined && balance !== null && declared !== balance && (
                      <>
                        {' '}
                        <span className="pill warn">differs from balance</span>
                      </>
                    )}{' '}
                    · block {a.blockNumber.toString()} · view tag {a.viewTag ?? 'none'} ·{' '}
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
                      <span className="pill ok">pass: derived stealth key controls this address</span>
                    ) : (
                      <span className="pill bad">fail: verification failed</span>
                    )}{' '}
                    <span className="dim">(key derived locally, never displayed or sent)</span>
                  </p>
                  {verification?.ok && (
                    <SweepPanel
                      stealthPrivateKey={verification.stealthPrivateKey}
                      stealthAddress={a.stealthAddress}
                      chainId={SEPOLIA_CHAIN_ID}
                      balanceWei={balance ?? null}
                    />
                  )}
                </div>
              );
            })}

            <h2>Published evidence, verified live</h2>
            <PaymentProofPanel />
            <SweepProofPanel />
          </>
        )}
      </div>
    </>
  );
}
