import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { authErrorText } from '../../shared/auth/auth-error.js';

/** Reads the token from the e-mail link fragment (/reset-password#token=...). */
function readToken(hash) {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token');
}

/**
 * Sets a new password with the single-use token received by e-mail (30 min).
 * The token is removed from the address bar as soon as the page opens.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => readToken(location.hash));
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(null);
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setMismatch(newPassword !== confirmation);
    if (newPassword !== confirmation) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
      setNewPassword('');
      setConfirmation('');
    }
  }

  let content;
  if (!token) {
    content = (
      <p className="message message-error" role="alert">
        {t('auth.resetMissingToken')}
      </p>
    );
  } else if (done) {
    content = (
      <p className="message message-success" role="status">
        {t('auth.resetDone')}
      </p>
    );
  } else {
    content = (
      <form
        className="auth-form"
        method="post"
        onSubmit={handleSubmit}
        noValidate
      >
        <p>{t('auth.passwordRules')}</p>
        <div>
          <label htmlFor="reset-new">{t('auth.newPassword')}</label>
          <input
            id="reset-new"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="reset-confirm">{t('auth.confirmPassword')}</label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </div>

        {mismatch && (
          <p className="message message-error" role="alert">
            {t('auth.passwordsDiffer')}
          </p>
        )}
        {error && (
          <p className="message message-error" role="alert">
            {authErrorText(t, error)}
          </p>
        )}

        <div className="auth-actions">
          <button type="submit" disabled={submitting}>
            {t('auth.resetSubmit')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <section className="auth-page">
      <h1>{t('auth.resetTitle')}</h1>
      {content}
      <p>
        <Link to="/login">{t('auth.backToLogin')}</Link>
      </p>
    </section>
  );
}
