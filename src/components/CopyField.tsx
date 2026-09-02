import { useState } from 'react';

export default function CopyField(props: {
  label: string;
  value: string;
  size?: 'md' | 'xl';
  sensitive?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!props.sensitive);
  const shown = revealed ? props.value : '•'.repeat(Math.min(props.value.length, 64));
  return (
    <div className="card inset">
      <span className="label">{props.label}</span>
      <div
        className={`bigmono${props.size === 'xl' ? ' xl' : ''}`}
        aria-label={props.sensitive && !revealed ? `${props.label}, hidden` : undefined}
      >
        {shown}
      </div>
      <div className="row" style={{ marginTop: '0.6rem' }}>
        <button
          className="ghost"
          aria-label={`Copy ${props.label}`}
          onClick={() => {
            void navigator.clipboard.writeText(props.value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
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
        {props.sensitive && (
          <span className="small dim">Private. Stays on this device.</span>
        )}
      </div>
    </div>
  );
}
