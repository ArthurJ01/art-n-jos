import { Link, NavLink, Outlet, ScrollRestoration, useMatches } from 'react-router';
import { useHealth, useLogout, useMe } from '../lib/api';
import { paths } from '../lib/paths';

export function Layout() {
  const { data: me } = useMe();
  const { data: health } = useHealth();
  const logout = useLogout();
  // Logged out, there is only the login page, so the menu would lead nowhere.
  const loggedIn = me?.authenticated ?? false;
  const showEnvBadge = health && health.env !== 'prod';
  // A route can ask for a wider page with `handle: { wide: true }` in router.tsx.
  const wide = useMatches().some((m) => (m.handle as { wide?: boolean } | undefined)?.wide);

  return (
    <div className={wide ? 'shell shell-wide' : 'shell'}>
      <header className="header">
        <div className="header-left">
          <Link to={paths.home} className="brand">
            Art &amp; Jos
            {showEnvBadge && (
              <span className="env-badge" title={`version ${health.version}`}>
                {health.env}
              </span>
            )}
          </Link>
          {/* NavLink adds the "active" class when its URL matches the current page. */}
          {loggedIn && (
            <nav className="nav" aria-label="Huvudmeny">
              <NavLink to={paths.recipes} className="nav-link">
                Recept
              </NavLink>
              <NavLink to={paths.mealPlanner} className="nav-link">
                Matplanering
              </NavLink>
            </nav>
          )}
        </div>
        {loggedIn && (
          <div className="nav">
            {/* Logging out needs no navigation: RequireAuth notices and shows the login page. */}
            <button type="button" className="button button-ghost" onClick={() => logout.mutate()}>
              Logga ut
            </button>
          </div>
        )}
      </header>
      <main className="main">
        <Outlet />
      </main>
      {/* A new page starts at the top, and "back" returns to where you were.
          Without this the scroll position stays put between pages. */}
      <ScrollRestoration />
    </div>
  );
}
