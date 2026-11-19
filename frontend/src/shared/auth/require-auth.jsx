import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resolveGuard } from './guard.js';
import { useCan } from './use-can.js';
import { useSession } from './use-session.js';
import AccessDenied from '../ui/access-denied.jsx';

/**
 * Renders protected pages only for an authenticated session. Anonymous visitors (never
 * logged in, logged out or expired) go to the login page and return here afterwards.
 * The back end still authorizes every request; this guard only avoids showing
 * protected screens and cached data (AA04 - back button after logout).
 */
export default function RequireAuth({
  children,
  requiresAuth = true,
  permission,
}) {
  const { t } = useTranslation();
  const { status } = useSession();
  const allowed = useCan(permission);
  const location = useLocation();

  switch (resolveGuard(status, { requiresAuth, allowed })) {
    case 'allow':
      return children;
    case 'denied':
      return <AccessDenied />;
    case 'login':
      return (
        <Navigate
          to="/login"
          replace
          state={{ from: `${location.pathname}${location.search}` }}
        />
      );
    default:
      return <p role="status">{t('layout.loading')}</p>;
  }
}
