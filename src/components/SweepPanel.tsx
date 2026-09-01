import { useState } from 'react';
import { isAddress, type Address, type Hex } from 'viem';
import { signSweepAuthorization, verifySweepAuthorization } from '../relay/sweep';

/**
 * Produce a signed EIP-7702 sweep authorization for a recognised payment,
 * entirely locally. The recipient hands this to a sponsor/relayer who pays gas
 * to move the funds out — so the stealth address never needs gas and is never
 * funded from the recipient's main wallet (which would re-link it).
 *
 * The stealth private key is used for signing only; it is never displayed.
 */
export default function SweepPanel(props: {
  stealthPrivateKey: Hex;
  stealthAddress: Address;
  chainId: number;
}) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [executor, setExecutor] = useState('');
  const [authJson, setAuthJson] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sign() {
    setError(null);
    setAuthJson(null);
    setVerified(null);
    if (!isAddress(executor)) {
      setError('Enter the EIP-7702 executor (delegate) contract address.');
      return;
    }
    try {
      const { authorization } = await signSweepAuthorization({
        stealthPrivateKey: props.stealthPrivateKey,
        chainId: props.chainId,
        executor: executor as Address,
      });
      setVerified(await verifySweepAuthorization(props.stealthAddress, authorization));
      setAuthJson(
        JSON.stringify(
          {
            note: 'Hand this to a sponsor/relayer. They submit a type-4 tx that sweeps to your destination and pays gas.',
            stealthAddress: props.stealthAddress,
            destination: destination || '(set a destination in the relayer call)',
            authorization: {
              chainId: authorization.chainId,
              address: authorization.address,
              nonce: authorization.nonce,
              r: authorization.r,
              s: authorization.s,
              yParity: authorization.yParity,
            },
          },
          null,
          2,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!open) {
    return (
      <button
        className="ghost"
        style={{ marginTop: '0.5rem' }}
        onClick={() => setOpen(true)}
      >
        Sweep privately (relayer) →
      </button>
    );
  }

  return (
    <div className="card inset" style={{ marginTop: '0.6rem' }}>
      <span className="label">Sweep without re-linking (EIP-7702 sponsored)</span>
      <p className="small dim" style={{ marginTop: 0 }}>
        Sending gas to this stealth address from your main wallet would re-link it. Instead,
        sign an authorization here and hand it to a sponsor/relayer who pays the gas. Signing
        is local; your stealth key never leaves this device or appears on screen.
      </p>
      <div className="row" style={{ marginBottom: '0.4rem' }}>
        <input
          type="text"
          value={executor}
          onChange={(e) => setExecutor(e.target.value)}
          placeholder="EIP-7702 executor contract (0x…) — see RELAYERS.md"
        />
      </div>
      <div className="row">
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="clean destination address (0x…)"
        />
        <button className="ghost" onClick={() => void sign()}>
          Sign sweep authorization
        </button>
      </div>
      {error && <p className="error small">{error}</p>}
      {authJson && (
        <>
          <p className="small" style={{ marginBottom: '0.3rem' }}>
            {verified ? (
              <span className="pill ok">signed by the stealth key ✓</span>
            ) : (
              <span className="pill bad">verification failed</span>
            )}{' '}
            <span className="dim">Give this to your relayer:</span>
          </p>
          <div className="bigmono small" style={{ whiteSpace: 'pre-wrap' }}>
            {authJson}
          </div>
        </>
      )}
    </div>
  );
}
