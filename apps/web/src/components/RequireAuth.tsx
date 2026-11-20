import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../lib/api';

/** Wrap routes that need login. Redirects to /login and comes back afterwards. */
export function RequireAuth() {
  const { data, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <p className="muted">Loading…</p>;
  if (!data?.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
