import { Link, useLocation } from 'react-router-dom';

/** Catch-all for unknown hash routes: keep the navigation, say what happened. */
export default function NotFound() {
  const location = useLocation();
  return (
    <>
      <h1>Page not found</h1>
      <p className="lead">
        There is no page at <span className="mono">#{location.pathname}</span>. Nothing was
        queried and nothing was written.
      </p>
      <nav className="row" aria-label="Where to go instead">
        <Link to="/" className="btn">
          Start page
        </Link>
        <Link to="/scan" className="btn secondary">
          Audit an ENS name
        </Link>
        <Link to="/demo" className="btn secondary">
          Two-minute demo
        </Link>
      </nav>
    </>
  );
}
