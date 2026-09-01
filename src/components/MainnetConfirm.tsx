import { useEffect, useState } from 'react';

/** The exact phrase a user must type to authorize a single mainnet write. */
export const MAINNET_CONFIRM_PHRASE = 'SEND ON MAINNET';

/**
 * Danger-styled per-action confirmation for a mainnet write. The parent owns
 * the `confirmed` boolean; this component only flips it to true while the
 * typed phrase matches exactly. Re-typing is required for each new action.
 */
export default function MainnetConfirm(props: {
  action: string;
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;
}) {
  const [text, setText] = useState('');
  const matches = text.trim() === MAINNET_CONFIRM_PHRASE;

  useEffect(() => {
    if (matches !== props.confirmed) props.setConfirmed(matches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  return (
    <div className="card danger">
      <strong>Mainnet {props.action}. This is real.</strong>
      <p className="small" style={{ margin: '0.4rem 0' }}>
        This spends real ETH and permanently, publicly links this action to your wallet on
        Ethereum mainnet. GhostName protects the <em>recipient</em> address, not your sender
        identity or the amount. There is no undo.
      </p>
      <span className="label">
        Type <code>{MAINNET_CONFIRM_PHRASE}</code> to authorize this one action
      </span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={MAINNET_CONFIRM_PHRASE}
      />
      {text.length > 0 && !matches && (
        <p className="small dim" style={{ marginBottom: 0 }}>Phrase does not match yet.</p>
      )}
    </div>
  );
}
