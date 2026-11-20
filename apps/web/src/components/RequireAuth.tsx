import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../lib/api';
import { paths } from '../lib/paths';

/** Wrap routes that need login. Redirects to the login page and comes back afterwards. */
export function RequireAuth() {
  const { data, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <p className="muted">Laddar…</p>;
  if (!data?.authenticated) {
    return <Navigate to={paths.login} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
