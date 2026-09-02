import { useState } from 'react';

export default function CopyField(props: {
  label: string;
  value: string;
  size?: 'md' | 'xl';
  sensitive?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(!props.sensitive);
  const hidden = props.sensitive && !revealed;
  const shown = revealed ? props.value : '•'.repeat(Math.min(props.value.length, 64));

  function copy() {
    setCopyError(null);
    if (!navigator.clipboard) {
      setCopyError('Clipboard is unavailable here (insecure origin). Reveal and select the value instead.');
      return;
    }
    navigator.clipboard.writeText(props.value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => setCopyError('Copy was blocked by the browser. Reveal and select the value instead.'),
    );
  }

  return (
    <div className="card inset">
      <span className="label">{props.label}</span>
      <div className={`bigmono${props.size === 'xl' ? ' xl' : ''}`} aria-hidden={hidden || undefined}>
        {shown}
      </div>
      {hidden && <span className="sr-only">{props.label} hidden</span>}
      <div className="row" style={{ marginTop: '0.6rem' }}>
        <button className="ghost" aria-label={`Copy ${props.label}`} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        {props.sensitive && (
          <button
            className="ghost"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
            aria-label={`${revealed ? 'Hide' : 'Reveal'} ${props.label}`}
          >
            {revealed ? 'Hide' : 'Reveal'}
          </button>
        )}
        {props.sensitive && <span className="small dim">Private. Stays on this device.</span>}
        <span role="status" className="sr-only">
          {copied ? `${props.label} copied to clipboard` : ''}
        </span>
      </div>
      {copyError && (
        <p className="error small" role="alert" style={{ marginBottom: 0 }}>
          {copyError}
        </p>
      )}
    </div>
  );
}
