import { useState } from 'react';
import { formatEther, isAddress, type Address, type Hex } from 'viem';
import {
  randomSweepNonce,
  signNativeSweepPackage,
  verifyNativeSweepPackage,
  type NativeSweepPackage,
  type SweepPackageVerification,
} from '../relay/sweep';
import { SWEEP_EXECUTOR } from '../config';
import { getSepoliaClient } from '../chain/clients';
import { SEPOLIA_CHAIN_ID } from '../chain/guards';
import { parseAmountEth } from '../lib/amount';
import { describeError } from '../lib/describeError';

const DEFAULT_TTL_MINUTES = 60;

/**
 * Produce the COMPLETE relayer package for a recognised payment, locally.
 *
 * Both signatures are required. The EIP-7702 delegation binds only chain,
 * executor and account nonce; the EIP-712 intent is what binds destination,
 * amount, sweep nonce and deadline. Emitting only the delegation would be
 * non-executable and would imply a destination guarantee that does not exist.
 *
 * The stealth key signs locally and is never displayed or serialized.
 */
export default function SweepPanel(props: {
  stealthPrivateKey: Hex;
  stealthAddress: Address;
  chainId: number;
  /** Current balance of the stealth address, used to pre-fill the amount. */
  balanceWei?: bigint | null;
}) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [amountEth, setAmountEth] = useState(() =>
    props.balanceWei && props.balanceWei > 0n ? formatEther(props.balanceWei) : '',
  );
  const [executor, setExecutor] = useState(SWEEP_EXECUTOR);
  const [ttlMinutes, setTtlMinutes] = useState(String(DEFAULT_TTL_MINUTES));
  const [pkg, setPkg] = useState<NativeSweepPackage | null>(null);
  const [verification, setVerification] = useState<SweepPackageVerification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idBase = `sweep-${props.stealthAddress.slice(2, 10).toLowerCase()}`;

  async function sign() {
    setError(null);
    setPkg(null);
    setVerification(null);

    if (!isAddress(executor)) {
      setError('Enter a valid EIP-7702 executor contract address.');
      return;
    }
    if (!isAddress(destination)) {
      setError('Enter a valid destination address. It is bound into the signature.');
      return;
    }
    if (destination.toLowerCase() === props.stealthAddress.toLowerCase()) {
      setError('Destination must differ from the stealth address.');
      return;
    }
    const parsed = parseAmountEth(amountEth);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    if (props.balanceWei !== undefined && props.balanceWei !== null && parsed.wei > props.balanceWei) {
      setError(
        `Amount exceeds the current balance of ${formatEther(props.balanceWei)} ETH; the executor would revert.`,
      );
      return;
    }
    const ttl = Number(ttlMinutes);
    if (!Number.isFinite(ttl) || ttl <= 0) {
      setError('Validity window must be a positive number of minutes.');
      return;
    }

    setBusy(true);
    try {
      // EIP-7702 requires the authorization nonce to equal the account nonce at
      // processing time, so read it rather than assuming a fresh EOA is at 0.
      let authorizationNonce = 0;
      if (props.chainId === SEPOLIA_CHAIN_ID) {
        authorizationNonce = await getSepoliaClient().getTransactionCount({
          address: props.stealthAddress,
        });
      }
      const deadline = BigInt(Math.floor(Date.now() / 1000) + Math.round(ttl * 60));
      const built = await signNativeSweepPackage({
        stealthPrivateKey: props.stealthPrivateKey,
        stealthAddress: props.stealthAddress,
        chainId: props.chainId,
        executor: executor as Address,
        destination: destination as Address,
        amount: parsed.wei,
        authorizationNonce,
        // Fresh random replay-guard nonce: a second package for this same
        // address (after a partial sweep) must not collide on "nonce used".
        sweepNonce: randomSweepNonce(),
        deadline,
      });
      setPkg(built);
      setVerification(await verifyNativeSweepPackage(built));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!pkg) return;
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghostname-sweep-${pkg.stealthAddress.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) {
    return (
      <button
        className="ghost"
        style={{ marginTop: '0.5rem' }}
        onClick={() => setOpen(true)}
        aria-expanded={false}
      >
        Sweep privately via a sponsor (EIP-7702)
      </button>
    );
  }

  return (
    <div className="card inset" style={{ marginTop: '0.6rem' }}>
      <span className="label">Sweep without re-linking (EIP-7702 sponsored)</span>
      <p className="small dim" style={{ marginTop: 0 }}>
        Sending gas to this stealth address from your own wallet would re-link it. Instead,
        sign a complete sweep package here and hand it to a sponsor who pays the gas. Signing
        is local. Your stealth key never leaves this device and is never shown.
      </p>
      <p className="small" style={{ color: 'var(--warn)', marginTop: 0 }}>
        Choose a destination that is not your main or publicly known wallet. Sweeping into a
        known address re-links the payment and undoes the privacy gain. The demo executor
        contract is unaudited and intended for testnet use only.
      </p>

      <div className="row" style={{ marginBottom: '0.4rem' }}>
        <label className="sr-only" htmlFor={`${idBase}-executor`}>
          EIP-7702 executor contract address
        </label>
        <input
          id={`${idBase}-executor`}
          type="text"
          value={executor}
          onChange={(e) => setExecutor(e.target.value)}
          placeholder="EIP-7702 executor contract (0x…), see RELAYERS.md"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="row" style={{ marginBottom: '0.4rem' }}>
        <label className="sr-only" htmlFor={`${idBase}-destination`}>
          Destination address, bound into the signature
        </label>
        <input
          id={`${idBase}-destination`}
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="destination address (0x…), bound into the signature"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="row">
        <label className="sr-only" htmlFor={`${idBase}-amount`}>
          Amount to sweep in ETH
        </label>
        <input
          id={`${idBase}-amount`}
          type="text"
          inputMode="decimal"
          style={{ maxWidth: '150px', minWidth: '110px' }}
          value={amountEth}
          onChange={(e) => setAmountEth(e.target.value)}
          placeholder="amount"
          autoComplete="off"
        />
        <span className="dim small">ETH</span>
        <label className="sr-only" htmlFor={`${idBase}-ttl`}>
          Validity window in minutes
        </label>
        <input
          id={`${idBase}-ttl`}
          type="text"
          inputMode="numeric"
          style={{ maxWidth: '110px', minWidth: '90px' }}
          value={ttlMinutes}
          onChange={(e) => setTtlMinutes(e.target.value)}
          placeholder="60"
          autoComplete="off"
        />
        <span className="dim small">min valid</span>
        <button className="ghost" onClick={() => void sign()} disabled={busy} aria-busy={busy}>
          {busy ? 'Signing…' : 'Build sweep package'}
        </button>
      </div>
      {props.balanceWei !== undefined && props.balanceWei !== null && (
        <p className="small dim" style={{ margin: '0.3rem 0 0' }}>
          Current balance {formatEther(props.balanceWei)} ETH (pre-filled).
        </p>
      )}

      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}

      <div aria-live="polite">
        {pkg && verification && (
          <>
            <p className="small" style={{ margin: '0.7rem 0 0.3rem' }}>
              {verification.valid ? (
                <span className="pill ok">pass: complete and destination-bound</span>
              ) : (
                <span className="pill bad">fail: verification failed</span>
              )}{' '}
              <button
                className="ghost"
                style={{ padding: '0.15rem 0.6rem', fontSize: '0.78rem' }}
                onClick={download}
              >
                Download JSON
              </button>{' '}
              <button
                className="ghost"
                style={{ padding: '0.15rem 0.6rem', fontSize: '0.78rem' }}
                onClick={() => void navigator.clipboard.writeText(JSON.stringify(pkg, null, 2))}
              >
                Copy package
              </button>
            </p>
            <table className="plain" style={{ marginBottom: '0.5rem' }}>
              <tbody>
                <tr>
                  <td className="small dim">delegation signed by stealth EOA</td>
                  <td className="small">{verification.checks.delegationSigner ? 'yes' : 'no'}</td>
                </tr>
                <tr>
                  <td className="small dim">destination, amount, nonce, deadline bound</td>
                  <td className="small">{verification.checks.sweepSigner ? 'yes' : 'no'}</td>
                </tr>
                <tr>
                  <td className="small dim">calldata matches declared fields</td>
                  <td className="small">{verification.checks.calldataMatches ? 'yes' : 'no'}</td>
                </tr>
                <tr>
                  <td className="small dim">account nonce (EIP-7702)</td>
                  <td className="small mono">{pkg.authorizationNonce}</td>
                </tr>
                <tr>
                  <td className="small dim">executor sweep nonce (replay guard, random)</td>
                  <td className="small mono" style={{ wordBreak: 'break-all' }}>{pkg.sweepNonce}</td>
                </tr>
              </tbody>
            </table>
            {!verification.valid && (
              <ul className="small error" style={{ marginTop: 0 }}>
                {verification.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            <p className="small dim" style={{ marginBottom: '0.3rem' }}>
              Give the whole package to your sponsor. It contains both required signatures and
              the exact calldata, and no key material. The sponsor learns the destination.
            </p>
            <div className="bigmono small" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(pkg, null, 2)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
