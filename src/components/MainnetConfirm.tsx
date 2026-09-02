import { useEffect, useState } from 'react';

/** The exact phrase a user must type to authorize a single mainnet write. */
export const MAINNET_CONFIRM_PHRASE = 'SEND ON MAINNET';

/** True only for the exact phrase (surrounding whitespace ignored). */
export function isMainnetConfirmationPhrase(text: string): boolean {
  return text.trim() === MAINNET_CONFIRM_PHRASE;
}

/**
 * Danger-styled per-action confirmation for a mainnet write. The parent owns
 * the `confirmed` boolean; this component only flips it to true while the
 * typed phrase matches exactly. The parent bumps `resetToken` after EVERY
 * attempted write (success or failure), which clears the typed phrase so the
 * next action has to be confirmed again from scratch.
 */
export default function MainnetConfirm(props: {
  action: string;
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;
  resetToken?: number;
}) {
  const [text, setText] = useState('');
  const matches = isMainnetConfirmationPhrase(text);

  useEffect(() => {
    if (matches !== props.confirmed) props.setConfirmed(matches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  useEffect(() => {
    setText('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.resetToken]);

  return (
    <div className="card danger" role="group" aria-label={`Mainnet ${props.action} confirmation`}>
      <strong>Mainnet {props.action}. This is real.</strong>
      <p className="small" style={{ margin: '0.4rem 0' }}>
        This spends real ETH and permanently, publicly links this action to your wallet on
        Ethereum mainnet. GhostName protects the <em>recipient</em> address, not your sender
        identity or the amount. There is no undo. You must retype the phrase for every action.
        This app scans and sweeps only on Sepolia: anything received on mainnet must be
        recovered with the exported identity keys and external tooling.
      </p>
      <label className="label" htmlFor="mainnet-confirm-input">
        Type <code>{MAINNET_CONFIRM_PHRASE}</code> to authorize this one action
      </label>
      <input
        id="mainnet-confirm-input"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={MAINNET_CONFIRM_PHRASE}
        autoComplete="off"
        spellCheck={false}
      />
      {text.length > 0 && !matches && (
        <p className="small dim" style={{ marginBottom: 0 }} role="status">
          Phrase does not match yet.
        </p>
      )}
    </div>
  );
}
