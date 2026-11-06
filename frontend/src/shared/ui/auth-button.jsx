import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../auth/auth-api.js';
import { useSession } from '../auth/use-session.js';

export default function AuthButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, user } = useSession();

  useEffect(() => {
    authApi.restoreSession();
  }, []);

  // Same pattern as the change-password page: leave first, end the session in the background.
  function handleLogout() {
    navigate('/', { replace: true });
    authApi.logout().catch(() => {});
  }

  if (status === 'authenticated') {
    return (
      <div className="auth-menu">
        {user?.email && (
          <span className="auth-user" title={user.email}>
            {user.email}
          </span>
        )}
        <button
          type="button"
          className="ghost small"
          onClick={() => navigate('/change-password')}
        >
          {t('nav.changePassword')}
        </button>
        <button
          type="button"
          className="secondary small"
          onClick={handleLogout}
        >
          {t('auth.logout')}
        </button>
      </div>
    );
  }

  if (status === 'anonymous') {
    return (
      <button
        type="button"
        className="small"
        onClick={() => navigate('/login')}
      >
        {t('nav.login')}
      </button>
    );
  }

  return null;
}