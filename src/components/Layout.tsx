import { NavLink, Outlet } from 'react-router-dom';

const links = [
  ['/scan', 'Scan'],
  ['/create', 'Create'],
  ['/pay', 'Pay'],
  ['/receive', 'Receive'],
  ['/privacy', 'Privacy'],
  ['/demo', 'Demo'],
] as const;

export default function Layout() {
  return (
    <>
      <nav className="topnav">
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
      <main className="page">
        <Outlet />
      </main>
      <footer className="foot">
        GhostName — forward privacy for ENS identities via ERC-5564. Not anonymity, not
        history deletion; see <a href="/privacy">what is and is not protected</a>.
      </footer>
    </>
  );
}
