import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../lib/api';
import { paths } from '../lib/paths';

/**
 * Wraps every page except the login page: the whole site needs a login.
 * Sends you to the login page, which sends you back here afterwards.
 *
 * This only decides what the browser shows. What actually keeps the recipes
 * private is the API, which refuses every request without a session.
 */
export function RequireAuth() {
  const { data, isPending, error } = useMe();
  const location = useLocation();
  if (isPending) return <p className="muted">Laddar…</p>;
  // Not knowing is different from being logged out: don't show a login form
  // just because the server could not be reached.
  if (!data) return <p className="error">Kunde inte nå servern: {error?.message}</p>;
  if (!data.authenticated) {
    return (
      <Navigate to={paths.login} replace state={{ from: location.pathname + location.search }} />
    );
  }
  return <Outlet />;
}
