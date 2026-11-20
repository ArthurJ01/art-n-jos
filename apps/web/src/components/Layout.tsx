import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useHealth, useLogout, useMe } from '../lib/api';

export function Layout() {
  const { data: me } = useMe();
  const { data: health } = useHealth();
  const logout = useLogout();
  const navigate = useNavigate();
  const showEnvBadge = health && health.env !== 'prod';

  return (
    <div className="shell">
      <header className="header">
        <Link to="/" className="brand">
          Recipes
          {showEnvBadge && (
            <span className="env-badge" title={`version ${health.version}`}>
              {health.env}
            </span>
          )}
        </Link>
        <nav className="nav">
          {me?.authenticated ? (
            <>
              <NavLink to="/recipes/new" className="button button-primary">
                + New recipe
              </NavLink>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
              >
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="button button-ghost">
              Log in
            </NavLink>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
