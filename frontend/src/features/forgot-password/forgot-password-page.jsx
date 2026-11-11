import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps } from '../../shared/forms/field-props.js';
import {
  email as emailRule,
  hasErrors,
  required,
  validateForm,
} from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';

const idFor = (field) => (field === 'email' ? 'forgot-email' : field);
const SCHEMA = { email: [required(), emailRule()] };

/**
 * Password recovery request. The message after submitting is always the same,
 * so it does not reveal whether the account exists (AA01, criterion 5).
 */
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const formRef = useRef(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);

  async function handleSubmit(event) {
    event.preventDefault();
    const clientErrors = validateForm({ email }, SCHEMA);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const result = await submit(() => authApi.forgotPassword(email));
    if (result.ok) setSent(true);
    else if (result.error) fromApi(result.error);
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
          ref={formRef}
          className="auth-form"
          method="post"
          onSubmit={handleSubmit}
          noValidate
          aria-busy={submitting}
        >
          <p>{t('auth.forgotIntro')}</p>
          <FormErrors
            errors={errors}
            error={error}
            labels={{ email: t('auth.email') }}
            idFor={idFor}
          />
          <div>
            <label htmlFor="forgot-email">{t('auth.email')}</label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearField('email');
              }}
              {...fieldProps('email', errors, idFor)}
            />
            <FieldError id="forgot-email-error" error={errors.email} />
          </div>

          <div className="auth-actions">
            <button type="submit" disabled={submitting}>
              {submitting && <Spinner />}
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
