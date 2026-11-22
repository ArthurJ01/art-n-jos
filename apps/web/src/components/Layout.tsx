import {
  Link,
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useMatches,
  useNavigate,
} from 'react-router';
import { useHealth, useLogout, useMe } from '../lib/api';
import { paths } from '../lib/paths';

export function Layout() {
  const { data: me } = useMe();
  const { data: health } = useHealth();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  // After logging in, come back to the page you were on.
  const loginState =
    location.pathname === paths.login ? undefined : { from: location.pathname + location.search };
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
          <nav className="nav" aria-label="Huvudmeny">
            <NavLink to={paths.recipes} className="nav-link">
              Recept
            </NavLink>
            <NavLink to={paths.mealPlanner} className="nav-link">
              Matplanering
            </NavLink>
          </nav>
        </div>
        <div className="nav">
          {me?.authenticated ? (
            <button
              type="button"
              className="button button-ghost"
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate(paths.home) })}
            >
              Logga ut
            </button>
          ) : (
            <NavLink to={paths.login} state={loginState} className="button button-ghost">
              Logga in
            </NavLink>
          )}
        </div>
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
