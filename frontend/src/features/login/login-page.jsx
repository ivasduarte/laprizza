import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { authErrorText } from '../../shared/auth/auth-error.js';
import { useSession } from '../../shared/auth/use-session.js';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, expired } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
      setPassword('');
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <h1>{t('auth.loginTitle')}</h1>

      {expired && !error && (
        <p className="message message-warning" role="status">
          {t('auth.sessionExpired')}
        </p>
      )}

      {/* method="post": even without JavaScript the password never goes in the URL. */}
      <form
        className="auth-form"
        method="post"
        onSubmit={handleSubmit}
        noValidate
      >
        <div>
          <label htmlFor="login-email">{t('auth.email')}</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="login-password">{t('auth.password')}</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
            {t('auth.loginSubmit')}
          </button>
        </div>
      </form>

      <p>
        <Link to="/forgot-password">{t('auth.forgotLink')}</Link>
      </p>
    </section>
  );
}
