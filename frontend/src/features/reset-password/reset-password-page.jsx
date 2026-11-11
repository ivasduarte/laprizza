import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
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

const IDS = { newPassword: 'reset-new', confirmation: 'reset-confirm' };
const idFor = (field) => IDS[field] ?? field;
const SCHEMA = {
  newPassword: passwordRules(),
  confirmation: [required(), sameAs('newPassword')],
};

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
  const formRef = useRef(null);
  const [token] = useState(() => readToken(location.hash));
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [done, setDone] = useState(false);
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);

  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    const clientErrors = validateForm({ newPassword, confirmation }, SCHEMA);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const result = await submit(() =>
      authApi.resetPassword(token, newPassword)
    );
    if (result.ok) {
      setDone(true);
      setNewPassword('');
      setConfirmation('');
    } else if (result.error) {
      fromApi(result.error); // on failure the typed values are kept
    }
  }

  const labels = {
    newPassword: t('auth.newPassword'),
    confirmation: t('auth.confirmPassword'),
  };

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
        ref={formRef}
        className="auth-form"
        method="post"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={submitting}
      >
        <p>{t('auth.passwordRules')}</p>
        <FormErrors
          errors={errors}
          error={error}
          labels={labels}
          idFor={idFor}
        />
        <div>
          <label htmlFor="reset-new">{t('auth.newPassword')}</label>
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
          <FieldError id="reset-new-error" error={errors.newPassword} />
        </div>
        <div>
          <label htmlFor="reset-confirm">{t('auth.confirmPassword')}</label>
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
          <FieldError id="reset-confirm-error" error={errors.confirmation} />
        </div>

        <div className="auth-actions">
          <button type="submit" disabled={submitting}>
            {submitting && <Spinner />}
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
