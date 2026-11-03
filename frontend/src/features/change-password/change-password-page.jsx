import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { authErrorText } from '../../shared/auth/auth-error.js';
import { useSession } from '../../shared/auth/use-session.js';

/**
 * Authenticated password change. The back end keeps this session and ends the
 * sessions on the other devices. The page also offers the logout actions.
 */
export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, user } = useSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(null);
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (status !== 'authenticated') {
    return <p role="status">{t('layout.loading')}</p>;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setDone(false);
    setMismatch(newPassword !== confirmation);
    if (newPassword !== confirmation) return;

    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    }
  }

  function handleLogout(endSession) {
    navigate('/', { replace: true });
    endSession().catch(() => {});
  }

  return (
    <section className="auth-page">
      <h1>{t('auth.changeTitle')}</h1>
      <p>{t('auth.signedInAs', { email: user.email })}</p>
      <p>{t('auth.passwordRules')}</p>

      <form
        className="auth-form"
        method="post"
        onSubmit={handleSubmit}
        noValidate
      >
        <div>
          <label htmlFor="change-current">{t('auth.currentPassword')}</label>
          <input
            id="change-current"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="change-new">{t('auth.newPassword')}</label>
          <input
            id="change-new"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="change-confirm">{t('auth.confirmPassword')}</label>
          <input
            id="change-confirm"
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
        {done && (
          <p className="message message-success" role="status">
            {t('auth.changeDone')}
          </p>
        )}

        <div className="auth-actions">
          <button type="submit" disabled={submitting}>
            {t('auth.changeSubmit')}
          </button>
        </div>
      </form>

      <h2>{t('auth.sessionTitle')}</h2>
      <div className="auth-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => handleLogout(authApi.logout)}
        >
          {t('auth.logout')}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => handleLogout(authApi.logoutAll)}
        >
          {t('auth.logoutAll')}
        </button>
      </div>
    </section>
  );
}
