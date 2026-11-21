import { Navigate, useLocation } from 'react-router-dom';
import { resolveGuard } from './guard.js';
import { useCan } from './use-can.js';
import { useSession } from './use-session.js';
import AccessDenied from '../ui/access-denied.jsx';
import Loading from '../ui/feedback/loading.jsx';

/**
 * Renders protected pages only for an authenticated session. Anonymous visitors (never
 * logged in, logged out or expired) go to the login page and return here afterwards.
 * Customer pages first ask for the contact phone when the account has none (AA02).
 * The back end still authorizes every request; this guard only avoids showing
 * protected screens and cached data (AA04 - back button after logout).
 */
export default function RequireAuth({
  children,
  requiresAuth = true,
  requiresContactPhone = false,
  permission,
}) {
  const { status, user } = useSession();
  const allowed = useCan(permission);
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  const decision = resolveGuard(status, {
    requiresAuth,
    allowed,
    requiresContactPhone,
    phoneRequired: Boolean(user?.phoneRequired),
  });

  switch (decision) {
    case 'allow':
      return children;
    case 'denied':
      return <AccessDenied />;
    case 'phone':
      return <Navigate to="/complete-profile" replace state={{ from }} />;
    case 'login':
      return <Navigate to="/login" replace state={{ from }} />;
    default:
      return <Loading variant="page" />;
  }
}
