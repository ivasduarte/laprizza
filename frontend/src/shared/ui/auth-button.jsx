import { useCallback, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../auth/auth-api.js';
import { useSession } from '../auth/use-session.js';
import { KeyIcon, LogoutIcon, UserIcon } from './icons.jsx';
import { useDismiss } from './use-dismiss.js';

/**
 * Account control of the header. It always occupies the same round slot
 * (loading, anonymous or authenticated), so the header never changes width
 * when the session is restored, on login/logout or when the language changes.
 */
export default function AuthButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, user } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);

  useDismiss({ open, onClose: close, containerRef: rootRef, returnFocusRef: buttonRef });

  // Same pattern as the change-password page: leave first, end the session in the background.
  function handleLogout() {
    close();
    navigate('/', { replace: true });
    authApi.logout().catch(() => {});
  }

  if (status === 'anonymous') {
    return (
      <Link
        to="/login"
        className="icon-button account-button"
        aria-label={t('nav.login')}
        title={t('nav.login')}
      >
        <UserIcon />
      </Link>
    );
  }

  if (status !== 'authenticated') {
    // Reserves the slot while the session is being restored.
    return <span className="icon-button account-button is-placeholder" aria-hidden="true" />;
  }

  const initial = user?.email?.trim().charAt(0).toUpperCase();

  return (
    <div className="account" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button account-button is-authenticated"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('account.menu')}
        title={user?.email}
        onClick={() => setOpen((value) => !value)}
      >
        {initial ? <span aria-hidden="true">{initial}</span> : <UserIcon />}
      </button>

      <div id={menuId} className="account-popover" hidden={!open}>
        {user?.email && (
          <p className="account-identity">
            <span className="account-identity-label">{t('account.signedInAs')}</span>
            <span className="account-identity-email">{user.email}</span>
          </p>
        )}
        <ul className="account-actions">
          <li>
            <Link to="/change-password" className="account-action" onClick={close}>
              <KeyIcon />
              {t('nav.changePassword')}
            </Link>
          </li>
          <li>
            <button type="button" className="account-action" onClick={handleLogout}>
              <LogoutIcon />
              {t('auth.logout')}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
