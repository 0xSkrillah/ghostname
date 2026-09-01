/** The central STATIC vs STEALTH visual. */
export default function Compare(props: {
  name?: string;
  staticAddress?: string;
  stealthAddresses?: string[];
}) {
  const name = props.name || 'name.eth';
  const staticAddr = props.staticAddress || '0xSTATIC…same every time';
  const stealth = props.stealthAddresses?.length
    ? props.stealthAddresses
    : ['0xA… fresh', '0xB… fresh', '0xC… fresh'];
  const shorten = (a: string) => (a.length > 24 ? `${a.slice(0, 12)}…${a.slice(-6)}` : a);
  return (
    <div className="compare">
      <div className="col static">
        <div className="title">Before — static</div>
        <div className="tree">
          <span className="name">{name}</span>
          {'\n'}
          {'   ↓ every payment\n'}
          <span className="addr-static">{shorten(staticAddr)}</span>
        </div>
        <p className="small dim">
          One public address accumulates the entire payment history of the name.
        </p>
      </div>
      <div className="col stealth">
        <div className="title">After — GhostName</div>
        <div className="tree">
          <span className="name">{name}</span>
          {'\n'}
          {stealth.map((addr, i) => (
            <span key={i}>
              {i < stealth.length - 1 ? '   ├─ payment → ' : '   └─ payment → '}
              <span className="addr-stealth">{shorten(addr)}</span>
              {'\n'}
            </span>
          ))}
        </div>
        <p className="small dim">
          Every sender derives a fresh one-time address. Only the recipient can link them.
        </p>
      </div>
    </div>
  );
}
