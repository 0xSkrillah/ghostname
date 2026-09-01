import { useState } from 'react';
import { getMainnetClient } from '../chain/clients';
import {
  resolveConventionalAddress,
  resolveStealthMetaAddress,
  type StealthResolution,
} from '../ens/resolve';
import { DEMO_MAINNET_NAME } from '../config';
import Compare from '../components/Compare';

interface ScanResult {
  name: string;
  address: string | null;
  stealth: StealthResolution;
}

export default function Scan() {
  const [name, setName] = useState(DEMO_MAINNET_NAME);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function scan() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const client = getMainnetClient();
      const conventional = await resolveConventionalAddress(client, name);
      const stealth = await resolveStealthMetaAddress(client, name);
      setResult({ name: conventional.name, address: conventional.address, stealth });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Scan an ENS identity</h1>
      <p className="lead">
        Live, read-only Ethereum mainnet resolution. What does this name publicly commit to?
      </p>
      <div className="row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name.eth"
          onKeyDown={(e) => e.key === 'Enter' && !busy && void scan()}
        />
        <button onClick={() => void scan()} disabled={busy || !name.trim()}>
          {busy ? 'Resolving…' : 'Resolve'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <>
          <div className="card inset">
            <span className="label">Conventional resolution (static)</span>
            <div className="bigmono xl">{result.name}</div>
            <div className="bigmono" style={{ color: 'var(--static-col)', marginTop: '0.4rem' }}>
              {result.address ?? 'No ETH address record set.'}
            </div>
          </div>
          {result.address && (
            <div className="card danger">
              <strong>This mapping is public and permanent.</strong>
              <p className="small" style={{ marginBottom: 0 }}>
                Anyone can connect <span className="mono">{result.name}</span> to every past
                and future transaction of this address — balances, counterparties, timing.
                Past activity cannot be deleted. GhostName cannot fix the past; it prevents
                <em> future</em> receiving addresses from being linkable this way.
              </p>
            </div>
          )}
          <div className={`card ${result.stealth.status === 'ok' ? 'ok' : 'inset'}`}>
            <span className="label">stealth-meta-address[1] record</span>
            {result.stealth.status === 'ok' && (
              <>
                <span className="pill ok">GhostName-enabled</span>
                <div className="bigmono" style={{ marginTop: '0.5rem' }}>
                  {result.stealth.record}
                </div>
              </>
            )}
            {result.stealth.status === 'none' && (
              <p className="dim" style={{ margin: 0 }}>
                Not published. Future payments to the static address above remain publicly
                linkable.
              </p>
            )}
            {result.stealth.status === 'invalid' && (
              <p className="error" style={{ margin: 0 }}>
                Record present but malformed: {result.stealth.error}
              </p>
            )}
          </div>
          <Compare name={result.name} staticAddress={result.address ?? undefined} />
        </>
      )}
    </>
  );
}
