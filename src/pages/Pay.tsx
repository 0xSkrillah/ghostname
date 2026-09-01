import { useState } from 'react';
import { parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { getSepoliaClient } from '../chain/clients';
import { planStealthPayment, executeStealthPayment, type StealthPaymentPlan } from '../chain/payment';
import { WRITABLE_CHAIN_ID } from '../chain/guards';
import { useWallet } from '../state/wallet';
import { DEMO_PAYMENT_ETH, DEMO_SEPOLIA_NAME } from '../config';
import Compare from '../components/Compare';

export default function Pay() {
  const wallet = useWallet();
  const [name, setName] = useState(DEMO_SEPOLIA_NAME);
  const [amount, setAmount] = useState(DEMO_PAYMENT_ETH);
  const [plans, setPlans] = useState<StealthPaymentPlan[]>([]);
  const [busy, setBusy] = useState<'idle' | 'planning' | 'paying'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ paymentTx: string; announcementTx: string } | null>(null);

  const onSepolia = wallet.chainId === WRITABLE_CHAIN_ID;
  const current = plans[plans.length - 1];

  async function derive() {
    setBusy('planning');
    setError(null);
    setResult(null);
    try {
      const plan = await planStealthPayment(
        getSepoliaClient(),
        name,
        parseEther(amount || '0'),
      );
      setPlans((prev) => [...prev.slice(-4), plan]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
    }
  }

  async function pay() {
    if (!current || !wallet.client || !wallet.account) return;
    setBusy('paying');
    setError(null);
    try {
      const executed = await executeStealthPayment({
        walletClient: wallet.client,
        chain: sepolia,
        account: wallet.account,
        plan: { ...current, amountWei: parseEther(amount || '0') },
      });
      setResult(executed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
    }
  }

  return (
    <>
      <h1>Pay an ENS name privately</h1>
      <p className="lead">
        Resolves <code>stealth-meta-address[1]</code> from Sepolia ENS and derives a fresh
        one-time destination <strong>locally</strong> — new ephemeral randomness on every
        derivation, no gateway involved.
      </p>
      <div className="row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ghostname-enabled-name.eth (Sepolia)"
        />
        <button onClick={() => void derive()} disabled={busy !== 'idle' || !name.trim()}>
          {busy === 'planning' ? 'Deriving…' : plans.length ? 'Derive again' : 'Resolve + derive'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {plans.length > 0 && (
        <>
          <div className="card inset">
            <span className="label">
              Derived one-time destinations for {plans[0]!.ensName} (this session)
            </span>
            {plans.map((p, i) => (
              <div
                key={p.derivation.stealthAddress}
                className="bigmono"
                style={{
                  color: i === plans.length - 1 ? 'var(--stealth-col)' : 'var(--text-dim)',
                  marginTop: i ? '0.3rem' : 0,
                }}
              >
                {p.derivation.stealthAddress}
                {i === plans.length - 1 && <span className="pill ok" style={{ marginLeft: '0.6rem' }}>latest</span>}
              </div>
            ))}
            {plans.length > 1 && (
              <p className="small" style={{ color: 'var(--accent)', marginBottom: 0 }}>
                Same name, different destination every time — that is the point. Only the
                recipient's viewing key can link these.
              </p>
            )}
          </div>

          {plans.length > 1 && (
            <Compare
              name={plans[0]!.ensName}
              stealthAddresses={plans.map((p) => p.derivation.stealthAddress)}
            />
          )}

          <h2>Send Sepolia ETH to the latest destination</h2>
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
                  style={{ maxWidth: '140px', minWidth: '100px' }}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.001"
                />
                <span className="dim">ETH</span>
                <button onClick={() => void pay()} disabled={busy !== 'idle' || !onSepolia}>
                  {busy === 'paying' ? 'Confirm in wallet…' : 'Send + announce'}
                </button>
              </div>
              <p className="small dim">
                Two transactions: the ETH transfer, then the ERC-5564 announcement that lets
                the recipient discover the payment.
              </p>
            </>
          )}
          {result && (
            <div className="card ok">
              <span className="label">Payment complete</span>
              <div className="bigmono small">
                payment:{' '}
                <a
                  href={`https://sepolia.etherscan.io/tx/${result.paymentTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.paymentTx}
                </a>
              </div>
              <div className="bigmono small">
                announcement:{' '}
                <a
                  href={`https://sepolia.etherscan.io/tx/${result.announcementTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.announcementTx}
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
