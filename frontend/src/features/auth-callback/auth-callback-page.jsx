import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { useSession } from '../../shared/auth/use-session.js';
import {
  callbackTarget,
  parseCallbackParams,
} from '../../shared/auth/external-auth.js';

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
  const { status, user } = useSession();
  // Read once, then clean the URL so the code does not stay in the history.
  const [result] = useState(() =>
    parseCallbackParams(new URLSearchParams(location.search))
  );

  const target = callbackTarget(result, status, user);

  useEffect(() => {
    authApi.restoreSession(); // no-op if main.jsx already started it
  }, []);

  // One effect issues every navigation, so they cannot race. Before, cleaning the URL and the
  // redirect were two effects: when the session was already restored at mount (lazy chunk
  // loaded after the refresh), the child <Navigate> ran first and the URL cleanup sent the
  // router back to /auth/callback, leaving the page blank.
  useEffect(() => {
    if (target) navigate(target, { replace: true });
    else if (location.search) navigate('/auth/callback', { replace: true }); // drop the code
  }, [target, location.search, navigate]);

  if (result.status === 'error') return <Failure code={result.code} />;
  if (result.status === 'activated') return <Activated />;
  if (status === 'anonymous') return <Failure code="AUTH_FAILED" />; // cookie was not accepted
  return <p role="status">{t('auth.external.completing')}</p>;
}
