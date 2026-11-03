import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../auth/auth-api.js';
import { useSession } from '../auth/use-session.js';

export default function AuthButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status } = useSession();

  useEffect(() => {
    authApi.restoreSession();
  }, []);

  if (status === 'authenticated') {
    return (
      <button
        type="button"
        className="secondary"
        onClick={() => navigate('/change-password')}
      >
        {t('nav.changePassword')}
      </button>
    );
  }

  if (status === 'anonymous') {
    return (
      <button
        type="button"
        className="secondary"
        onClick={() => navigate('/login')}
      >
        {t('nav.login')}
      </button>
    );
  }

  return null;
}