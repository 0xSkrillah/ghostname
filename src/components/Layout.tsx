import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const links = [
  ['/scan', 'Scan'],
  ['/create', 'Create'],
  ['/pay', 'Pay'],
  ['/receive', 'Receive'],
  ['/privacy', 'Privacy'],
  ['/demo', 'Demo'],
] as const;

const TITLES: Record<string, string> = {
  '/': 'Keep the ENS name',
  '/scan': 'Audit an ENS identity',
  '/create': 'Create a private receive identity',
  '/pay': 'Pay an ENS name privately',
  '/receive': 'Discover your payments',
  '/privacy': 'What is and is not protected',
  '/demo': 'GhostName in two minutes',
};

export default function Layout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Each route gets its own document title and, after a navigation, focus
  // moves to the main region so keyboard and screen-reader users land on the
  // new content rather than at the top of the nav.
  useEffect(() => {
    const label = TITLES[location.pathname] ?? 'GhostName';
    document.title = location.pathname === '/' ? 'GhostName' : `${label} · GhostName`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="topnav" aria-label="Primary">
        <NavLink to="/" className="brand">
          ghost<span>name</span>
        </NavLink>
        {links.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="page" id="main" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>
      <footer className="foot">
        GhostName: forward privacy for ENS identities via ERC-5564. Not anonymity, not
        history deletion; see <Link to="/privacy">what is and is not protected</Link>. Writes
        go to Sepolia testnet. Build <span className="mono">{__GHOSTNAME_COMMIT__}</span>.
      </footer>
    </>
  );
}
