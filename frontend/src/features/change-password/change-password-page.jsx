import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { useSession } from '../../shared/auth/use-session.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps } from '../../shared/forms/field-props.js';
import {
  hasErrors,
  passwordRules,
  required,
  sameAs,
  validateForm,
} from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';

const IDS = {
  currentPassword: 'change-current',
  newPassword: 'change-new',
  confirmation: 'change-confirm',
};
const idFor = (field) => IDS[field] ?? field;
const SCHEMA = {
  currentPassword: [required()],
  newPassword: passwordRules(),
  confirmation: [required(), sameAs('newPassword')],
};

/**
 * Authenticated password change. The back end keeps this session and ends the
 * sessions on the other devices. The page also offers the logout actions.
 */
export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { status, user } = useSession();
  const formRef = useRef(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState(false);
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);

  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (status !== 'authenticated') {
    return <p role="status">{t('layout.loading')}</p>;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setDone(false);
    const clientErrors = validateForm(
      { currentPassword, newPassword, confirmation },
      SCHEMA
    );
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const result = await submit(() =>
      authApi.changePassword(currentPassword, newPassword)
    );
    if (result.ok) {
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } else if (result.error) {
      fromApi(result.error); // on failure the typed values are kept
    }
  }

  async function handleLogout(endSession, { needsConfirmation = false } = {}) {
    if (
      needsConfirmation &&
      !(await confirm({
        titleKey: 'auth.logoutAllTitle',
        messageKey: 'auth.logoutAllConfirm',
        confirmKey: 'auth.logoutAll',
        tone: 'danger',
      }))
    ) {
      return;
    }
    navigate('/', { replace: true });
    endSession().catch(() => {});
  }

  const labels = {
    currentPassword: t('auth.currentPassword'),
    newPassword: t('auth.newPassword'),
    confirmation: t('auth.confirmPassword'),
  };

  return (
    <section className="auth-page">
      <h1>{t('auth.changeTitle')}</h1>
      <p>{t('auth.signedInAs', { email: user.email })}</p>
      <p>{t('auth.passwordRules')}</p>

      <form
        ref={formRef}
        className="auth-form"
        method="post"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={submitting}
      >
        <FormErrors
          errors={errors}
          error={error}
          labels={labels}
          idFor={idFor}
        />
        <div>
          <label htmlFor="change-current">{t('auth.currentPassword')}</label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              clearField('currentPassword');
            }}
            {...fieldProps('currentPassword', errors, idFor)}
          />
          <FieldError
            id="change-current-error"
            error={errors.currentPassword}
          />
        </div>
        <div>
          <label htmlFor="change-new">{t('auth.newPassword')}</label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              clearField('newPassword');
            }}
            {...fieldProps('newPassword', errors, idFor)}
          />
          <FieldError id="change-new-error" error={errors.newPassword} />
        </div>
        <div>
          <label htmlFor="change-confirm">{t('auth.confirmPassword')}</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              clearField('confirmation');
            }}
            {...fieldProps('confirmation', errors, idFor)}
          />
          <FieldError id="change-confirm-error" error={errors.confirmation} />
        </div>

        {done && (
          <p className="message message-success" role="status">
            {t('auth.changeDone')}
          </p>
        )}

        <div className="auth-actions">
          <button type="submit" disabled={submitting}>
            {submitting && <Spinner />}
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
          onClick={() =>
            handleLogout(authApi.logoutAll, { needsConfirmation: true })
          }
        >
          {t('auth.logoutAll')}
        </button>
      </div>
    </section>
  );
}
