import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { authErrorText } from '../../shared/auth/auth-error.js';

/**
 * Password recovery request. The message after submitting is always the same,
 * so it does not reveal whether the account exists (AA01, criterion 5).
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <h1>{t('auth.forgotTitle')}</h1>

      {sent ? (
        <p className="message message-success" role="status">
          {t('auth.forgotSent')}
        </p>
      ) : (
        <form
          className="auth-form"
          method="post"
          onSubmit={handleSubmit}
          noValidate
        >
          <p>{t('auth.forgotIntro')}</p>
          <div>
            <label htmlFor="forgot-email">{t('auth.email')}</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error && (
            <p className="message message-error" role="alert">
              {authErrorText(t, error)}
            </p>
          )}

          <div className="auth-actions">
            <button type="submit" disabled={submitting}>
              {t('auth.forgotSubmit')}
            </button>
          </div>
        </form>
      )}

      <p>
        <Link to="/login">{t('auth.backToLogin')}</Link>
      </p>
    </section>
  );
}
