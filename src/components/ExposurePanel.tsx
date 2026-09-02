import { useRef, useState } from 'react';
import type { Address } from 'viem';
import { fetchWalletExposure, type WalletExposure } from '../mobula/portfolio';
import { describeError } from '../lib/describeError';

/**
 * Public-exposure panel: shows how much financial information a static
 * ENS→wallet mapping assembles. Counts/categories are shown immediately;
 * the total balance stays hidden behind a deliberate reveal (projector-safe).
 */
export default function ExposurePanel({ address }: { address: Address }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [exposure, setExposure] = useState<WalletExposure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  async function load() {
    setState('loading');
    setError(null);
    try {
      setExposure(await fetchWalletExposure(address));
      setState('done');
    } catch (err) {
      setError(describeError(err));
      setState('error');
    } finally {
      setTimeout(() => resultsRef.current?.focus(), 0);
    }
  }

  return (
    <div className="card">
      <span className="label">Public exposure (via Mobula)</span>
      {state === 'idle' && (
        <>
          <p className="small dim" style={{ marginTop: 0 }}>
            This static address is public. Anyone can assemble its full financial profile
            from it. Here is a live sample of what a single lookup reveals.
          </p>
          <button className="secondary" onClick={() => void load()}>
            Assemble public profile (queries Mobula)
          </button>
        </>
      )}
      {state === 'loading' && <p className="dim">Querying public holdings…</p>}
      {state === 'error' && (
        <>
          <p className="error" role="alert">
            {error}
          </p>
          <button className="ghost" onClick={() => void load()}>
            Retry
          </button>
        </>
      )}
      {state === 'done' && exposure && (
        <div ref={resultsRef} tabIndex={-1} aria-live="polite">
          <div className="row" style={{ gap: '1.5rem', marginBottom: '0.6rem' }}>
            <div>
              <div className="bigmono" style={{ fontSize: '1.6rem', color: 'var(--static-col)' }}>
                {exposure.assetCount}
              </div>
              <span className="small dim">token holdings visible</span>
            </div>
            <div>
              <div className="bigmono" style={{ fontSize: '1.6rem' }}>
                {exposure.chains.length}
              </div>
              <span className="small dim">chain{exposure.chains.length === 1 ? '' : 's'}</span>
            </div>
            <div>
              <div className="bigmono" style={{ fontSize: '1.6rem' }}>
                {revealed ? `$${exposure.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '•••••'}
              </div>
              <span className="small dim">
                total value{' '}
                <button
                  className="ghost btn-sm"
                  onClick={() => setRevealed((r) => !r)}
                  aria-pressed={revealed}
                >
                  {revealed ? 'hide' : 'reveal'}
                </button>
              </span>
            </div>
          </div>
          {revealed && exposure.assets.length > 0 && (
            <table className="plain">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Chains</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {exposure.assets.slice(0, 8).map((a) => (
                  <tr key={a.symbol + a.name}>
                    <td>
                      {a.name} <span className="dim">{a.symbol}</span>
                    </td>
                    <td className="small dim">{a.chains.join(', ') || 'Ethereum'}</td>
                    <td className="mono">
                      ${a.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="small dim" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
            This is the exposure GhostName removes from <em>future</em> payments. Each one
            lands on a fresh address that cannot be assembled into a profile like this.
            {exposure.source === 'demo' && ' (Mobula keyless demo endpoint.)'}
          </p>
        </div>
      )}
    </div>
  );
}
