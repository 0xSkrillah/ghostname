import { useEffect, useState } from 'react';
import { formatEther, type Hash } from 'viem';
import { getMainnetClient, getSepoliaClient } from '../chain/clients';
import {
  AnnouncementFailedError,
  announceStealthPayment,
  executeStealthPayment,
  planStealthPayment,
  type StealthPaymentPlan,
} from '../chain/payment';
import { ANNOUNCER_ADDRESS, buildEthAnnouncementMetadata } from '../chain/announcer';
import { SCHEME_ID } from '../crypto/metaAddress';
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from '../chain/guards';
import { useWallet } from '../state/wallet';
import { DEMO_PAYMENT_ETH, DEMO_SEPOLIA_NAME } from '../config';
import { parseAmountEth } from '../lib/amount';
import { describeError } from '../lib/describeError';
import Compare from '../components/Compare';
import MainnetConfirm from '../components/MainnetConfirm';

function explorerFor(chainId: number): string {
  return chainId === MAINNET_CHAIN_ID ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
}

function networkName(chainId: number): string {
  return chainId === MAINNET_CHAIN_ID ? 'Ethereum mainnet' : 'Sepolia';
}

interface PaymentResult {
  paymentTx: Hash;
  announcementTx: Hash;
  chainId: number;
}

/** A transfer that landed without its announcement; everything needed to retry. */
interface PendingAnnouncement {
  paymentTx: Hash;
  plan: StealthPaymentPlan;
}

export default function Pay() {
  const wallet = useWallet();
  const [name, setName] = useState(DEMO_SEPOLIA_NAME);
  const [amount, setAmount] = useState(DEMO_PAYMENT_ETH);
  const [plans, setPlans] = useState<StealthPaymentPlan[]>([]);
  const [busy, setBusy] = useState<'idle' | 'planning' | 'paying' | 'announcing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mainnetConfirmed, setMainnetConfirmed] = useState(false);
  const [confirmToken, setConfirmToken] = useState(0);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [pending, setPending] = useState<PendingAnnouncement | null>(null);

  // Mainnet is only a write target when the build opted in; otherwise a wallet
  // on mainnet is simply blocked and the page keeps working against Sepolia.
  const guardedMainnet = wallet.chainId === MAINNET_CHAIN_ID && wallet.mainnetEnabled;
  const mainnetBlocked = wallet.chainId === MAINNET_CHAIN_ID && !wallet.mainnetEnabled;
  const readChainId = guardedMainnet ? MAINNET_CHAIN_ID : SEPOLIA_CHAIN_ID;
  const readClient = guardedMainnet ? getMainnetClient() : getSepoliaClient();
  const networkLabel = networkName(readChainId);
  const parsedAmount = parseAmountEth(amount);
  const current = plans[plans.length - 1];
  const canPay =
    !!current &&
    wallet.onWritableNetwork &&
    (!guardedMainnet || mainnetConfirmed) &&
    busy === 'idle' &&
    parsedAmount.error === null &&
    pending === null;

  // A plan is bound to the chain it was resolved on. If the wallet moves to a
  // different network, the derived destinations no longer apply.
  useEffect(() => {
    if (plans.length > 0 && plans[0]!.chainId !== readChainId) {
      setPlans([]);
      setResult(null);
      setNotice(`Network changed to ${networkLabel}. Derive again before paying.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readChainId]);

  async function derive() {
    setBusy('planning');
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      const plan = await planStealthPayment(
        readClient,
        name,
        parsedAmount.error ? 0n : parsedAmount.wei,
        readChainId,
      );
      // Destinations are listed per name; a new name starts a new list.
      setPlans((prev) =>
        prev.length > 0 && prev[0]!.ensName !== plan.ensName ? [plan] : [...prev.slice(-4), plan],
      );
    } catch (err) {
      setError(`Could not resolve ${name.trim()} on ${networkLabel}: ${describeError(err)}`);
    } finally {
      setBusy('idle');
    }
  }

  async function pay() {
    if (!current || !wallet.client || !wallet.account || !wallet.chain) return;
    if (parsedAmount.error) {
      setError(parsedAmount.error);
      return;
    }
    setBusy('paying');
    setError(null);
    setNotice(null);
    const plan = { ...current, amountWei: parsedAmount.wei };
    try {
      const executed = await executeStealthPayment({
        walletClient: wallet.client,
        chain: wallet.chain,
        account: wallet.account,
        plan,
        mainnetConfirmed,
      });
      setResult({ ...executed, chainId: wallet.chain.id });
    } catch (err) {
      if (err instanceof AnnouncementFailedError) {
        setPending({ paymentTx: err.paymentTx, plan: err.plan });
      }
      setError(describeError(err));
    } finally {
      setBusy('idle');
      // Every attempt consumes the confirmation: retype for the next action.
      setMainnetConfirmed(false);
      setConfirmToken((t) => t + 1);
    }
  }

  async function retryAnnouncement() {
    if (!pending || !wallet.client || !wallet.account || !wallet.chain) return;
    setBusy('announcing');
    setError(null);
    try {
      const announcementTx = await announceStealthPayment({
        walletClient: wallet.client,
        chain: wallet.chain,
        account: wallet.account,
        plan: pending.plan,
        mainnetConfirmed,
      });
      setResult({ paymentTx: pending.paymentTx, announcementTx, chainId: wallet.chain.id });
      setPending(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy('idle');
      setMainnetConfirmed(false);
      setConfirmToken((t) => t + 1);
    }
  }

  const canRetry =
    pending !== null &&
    wallet.onWritableNetwork &&
    wallet.chainId === pending.plan.chainId &&
    (!guardedMainnet || mainnetConfirmed) &&
    busy === 'idle';

  return (
    <>
      <h1>Pay an ENS name privately</h1>
      <p className="lead">
        Resolves <code>stealth-meta-address[1]</code> from ENS and derives a fresh one-time
        destination <strong>locally</strong>, with new ephemeral randomness on every derivation,
        no gateway involved. The record is read on {networkLabel}, the network the payment will
        be sent on.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy === 'idle' && name.trim()) void derive();
        }}
      >
        <label className="sr-only" htmlFor="pay-name">
          ENS name to pay
        </label>
        <input
          id="pay-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ghostname-enabled-name.eth"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
        />
        <button type="submit" disabled={busy !== 'idle' || !name.trim()} aria-busy={busy === 'planning'}>
          {busy === 'planning' ? 'Deriving…' : plans.length ? 'Derive again' : 'Resolve + derive'}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="small" style={{ color: 'var(--warn)' }} role="status">
          {notice}
        </p>
      )}

      <div aria-live="polite" aria-busy={busy !== 'idle'}>
        {plans.length > 0 && current && (
          <>
            <div className="card inset">
              <span className="label">
                Derived one-time destinations for {current.ensName} on {networkName(current.chainId)}{' '}
                (this session)
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
                  {i === plans.length - 1 && (
                    <span className="pill ok" style={{ marginLeft: '0.6rem' }}>
                      latest
                    </span>
                  )}
                </div>
              ))}
              {plans.length > 1 && (
                <p className="small" style={{ color: 'var(--accent)', marginBottom: 0 }}>
                  Same name, different destination every time. That is the point. Only the
                  recipient's viewing key can link these.
                </p>
              )}
            </div>

            {plans.length > 1 && (
              <Compare
                name={current.ensName}
                stealthAddresses={plans.map((p) => p.derivation.stealthAddress)}
              />
            )}

            <h2>Send {guardedMainnet ? 'ETH' : 'Sepolia ETH'} to the latest destination</h2>
            {!wallet.account ? (
              <button className="secondary" onClick={() => void wallet.connect()}>
                Connect wallet
              </button>
            ) : (
              <>
                <p className="small">
                  <span className="pill">{wallet.account}</span>{' '}
                  {wallet.chainId === SEPOLIA_CHAIN_ID ? (
                    <span className="pill ok">Sepolia</span>
                  ) : guardedMainnet ? (
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
                <div className="row">
                  <label className="sr-only" htmlFor="pay-amount">
                    Amount in ETH
                  </label>
                  <input
                    id="pay-amount"
                    type="text"
                    inputMode="decimal"
                    style={{ maxWidth: '140px', minWidth: '100px' }}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.001"
                    autoComplete="off"
                    aria-invalid={parsedAmount.error !== null}
                    aria-describedby="pay-amount-hint"
                  />
                  <span className="dim">ETH</span>
                </div>
                <p id="pay-amount-hint" className="small dim" style={{ margin: '0.2rem 0 0.6rem' }}>
                  {parsedAmount.error ?? 'Amount is bound into both transactions below.'}
                </p>

                <div className="card inset">
                  <span className="label">You will sign two transactions on {networkLabel}</span>
                  <table className="plain">
                    <tbody>
                      <tr>
                        <td className="small dim">1. transfer to</td>
                        <td className="mono small" style={{ wordBreak: 'break-all', color: 'var(--stealth-col)' }}>
                          {current.derivation.stealthAddress}
                        </td>
                      </tr>
                      <tr>
                        <td className="small dim">value</td>
                        <td className="mono small">
                          {parsedAmount.error ? 'enter a valid amount' : `${formatEther(parsedAmount.wei)} ETH`}
                        </td>
                      </tr>
                      <tr>
                        <td className="small dim">2. announcement to</td>
                        <td className="mono small" style={{ wordBreak: 'break-all' }}>
                          {ANNOUNCER_ADDRESS} <span className="dim">(ERC-5564 announcer singleton)</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="small dim">function</td>
                        <td className="mono small">announce(schemeId, stealthAddress, ephemeralPubKey, metadata)</td>
                      </tr>
                      <tr>
                        <td className="small dim">schemeId</td>
                        <td className="mono small">{SCHEME_ID.toString()}</td>
                      </tr>
                      <tr>
                        <td className="small dim">ephemeralPubKey</td>
                        <td className="mono small" style={{ wordBreak: 'break-all' }}>
                          {current.derivation.ephemeralPublicKey}
                        </td>
                      </tr>
                      <tr>
                        <td className="small dim">view tag</td>
                        <td className="mono small">{current.derivation.viewTag}</td>
                      </tr>
                      <tr>
                        <td className="small dim">metadata</td>
                        <td className="mono small" style={{ wordBreak: 'break-all' }}>
                          {parsedAmount.error
                            ? 'enter a valid amount'
                            : buildEthAnnouncementMetadata(current.derivation.viewTag, parsedAmount.wei)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="small dim" style={{ marginBottom: 0 }}>
                    The announcement carries the view tag and the declared amount so the
                    recipient can discover the payment. Your wallet address is the public
                    sender of both transactions; GhostName hides the recipient, not you. If the
                    first transaction succeeds and the second is rejected, this page keeps the
                    announcement data so you can retry it.
                  </p>
                </div>

                {guardedMainnet && (
                  <MainnetConfirm
                    action="payment"
                    confirmed={mainnetConfirmed}
                    setConfirmed={setMainnetConfirmed}
                    resetToken={confirmToken}
                  />
                )}
                <div className="row">
                  <button onClick={() => void pay()} disabled={!canPay} aria-busy={busy === 'paying'}>
                    {busy === 'paying' ? 'Confirm in wallet…' : 'Send + announce'}
                  </button>
                  {!wallet.onWritableNetwork && (
                    <span className="small error">Switch the wallet to a permitted network first.</span>
                  )}
                </div>
                <p className="small dim">
                  Two wallet prompts: the ETH transfer, then the ERC-5564 announcement that lets
                  the recipient discover the payment. Your wallet needs the amount plus a little{' '}
                  {guardedMainnet ? 'ETH' : 'Sepolia ETH'} for gas
                  {guardedMainnet ? '.' : ' (any public Sepolia faucet works).'}
                </p>
              </>
            )}

            {pending && (
              <div className="card danger" role="alert">
                <span className="label">Transfer sent, announcement missing. Do not close this page.</span>
                <p className="small">
                  The ETH left your wallet but the ERC-5564 announcement was not emitted, so the
                  recipient cannot yet discover the payment. Retry the announcement below. If
                  you must leave, copy these values and announce later with any ERC-5564 tool.
                </p>
                <table className="plain">
                  <tbody>
                    <tr>
                      <td className="small dim">payment tx</td>
                      <td className="mono small" style={{ wordBreak: 'break-all' }}>
                        <a href={`${explorerFor(pending.plan.chainId)}/tx/${pending.paymentTx}`} target="_blank" rel="noreferrer">
                          {pending.paymentTx}
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td className="small dim">stealth address</td>
                      <td className="mono small" style={{ wordBreak: 'break-all' }}>{pending.plan.derivation.stealthAddress}</td>
                    </tr>
                    <tr>
                      <td className="small dim">ephemeral public key</td>
                      <td className="mono small" style={{ wordBreak: 'break-all' }}>{pending.plan.derivation.ephemeralPublicKey}</td>
                    </tr>
                    <tr>
                      <td className="small dim">metadata</td>
                      <td className="mono small" style={{ wordBreak: 'break-all' }}>
                        {buildEthAnnouncementMetadata(pending.plan.derivation.viewTag, pending.plan.amountWei)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="row" style={{ marginTop: '0.5rem' }}>
                  <button onClick={() => void retryAnnouncement()} disabled={!canRetry} aria-busy={busy === 'announcing'}>
                    {busy === 'announcing' ? 'Confirm in wallet…' : 'Retry announcement'}
                  </button>
                  <button
                    className="ghost"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        JSON.stringify(
                          {
                            paymentTx: pending.paymentTx,
                            chainId: pending.plan.chainId,
                            stealthAddress: pending.plan.derivation.stealthAddress,
                            ephemeralPublicKey: pending.plan.derivation.ephemeralPublicKey,
                            viewTag: pending.plan.derivation.viewTag,
                            amountWei: pending.plan.amountWei.toString(),
                          },
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    Copy recovery data
                  </button>
                </div>
              </div>
            )}

            {result && (
              <div className="card ok" role="status">
                <span className="label">Payment complete on {networkName(result.chainId)}</span>
                <div className="bigmono small">
                  payment:{' '}
                  <a href={`${explorerFor(result.chainId)}/tx/${result.paymentTx}`} target="_blank" rel="noreferrer">
                    {result.paymentTx}
                  </a>
                </div>
                <div className="bigmono small">
                  announcement:{' '}
                  <a href={`${explorerFor(result.chainId)}/tx/${result.announcementTx}`} target="_blank" rel="noreferrer">
                    {result.announcementTx}
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
