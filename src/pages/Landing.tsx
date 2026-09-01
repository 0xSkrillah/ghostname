import { Link } from 'react-router-dom';
import Compare from '../components/Compare';

export default function Landing() {
  return (
    <>
      <h1>
        Keep the ENS name. <span style={{ color: 'var(--accent)' }}>Break the payment graph.</span>
      </h1>
      <p className="lead">
        An established ENS name is a great identity, and a privacy liability. If it always
        resolves to one static wallet, every payment anyone sends you becomes public,
        linkable history. That history cannot be deleted.
      </p>
      <p className="lead">
        GhostName gives an existing ENS identity <strong>forward privacy</strong>: publish one
        ERC-5564 stealth meta-address record, and every future sender derives a fresh
        one-time receiving address, locally, with no gateway.
      </p>
      <Compare />
      <div className="row">
        <Link to="/scan">
          <button>See the problem: scan a name</button>
        </Link>
        <Link to="/create">
          <button className="secondary">Fix the future: create a private identity</button>
        </Link>
      </div>
      <p className="small dim" style={{ marginTop: '2rem' }}>
        Honest scope: GhostName does not erase history, hide sender identity, or hide
        amounts. <Link to="/privacy">Read exactly what is and is not protected.</Link>
      </p>
    </>
  );
}
