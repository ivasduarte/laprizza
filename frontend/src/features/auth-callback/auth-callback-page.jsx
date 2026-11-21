import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { useSession } from '../../shared/auth/use-session.js';
import { parseCallbackParams } from '../../shared/auth/external-auth.js';

function Failure({ code }) {
  const { t } = useTranslation();
  const pending = code === 'ACCOUNT_PENDING_ACTIVATION';
  return (
    <section className="login-panel">
      <h1>{t('auth.external.title')}</h1>
      <p
        className={`message ${pending ? 'message-warning' : 'message-error'}`}
        role={pending ? 'status' : 'alert'}
      >
        {t(`auth.external.errors.${code}`)}
      </p>
      <p>
        <Link to="/login">{t('auth.backToLogin')}</Link>
      </p>
    </section>
  );
}

/** AA07: the account was activated at the provider. No session was opened. */
function Activated() {
  const { t } = useTranslation();
  return (
    <section className="login-panel">
      <h1>{t('activation.title')}</h1>
      <p className="message message-success" role="status">
        {t('auth.external.activated')}
      </p>
      <p>
        <Link to="/login">{t('activation.goToLogin')}</Link>
      </p>
    </section>
  );
}

/**
 * Landing page of the external login (AA02). The back end already set the refresh cookie
 * (success) or appended an error code to the URL. No token ever travels in the URL: the
 * session is restored through POST /auth/refresh, like after a page reload.
 */
export default function AuthCallbackPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { status } = useSession();
  // Read once, then clean the URL so the code does not stay in the history.
  const [result] = useState(() => parseCallbackParams(new URLSearchParams(location.search)));

  useEffect(() => {
    authApi.restoreSession(); // no-op if the header button already started it
    navigate('/auth/callback', { replace: true });
  }, [navigate]);

  if (result.status === 'error') return <Failure code={result.code} />;
  if (result.status === 'activated') return <Activated />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  if (status === 'anonymous') return <Failure code="AUTH_FAILED" />; // cookie was not accepted
  return <p role="status">{t('auth.external.completing')}</p>;
}
