import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useHealth, useLogout, useMe } from '../lib/api';
import { paths } from '../lib/paths';

export function Layout() {
  const { data: me } = useMe();
  const { data: health } = useHealth();
  const logout = useLogout();
  const navigate = useNavigate();
  const showEnvBadge = health && health.env !== 'prod';

  return (
    <div className="shell">
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
            <NavLink to={paths.login} className="button button-ghost">
              Logga in
            </NavLink>
          )}
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
