import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { useSession } from '../../shared/auth/use-session.js';
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
import logoUrl from '../../shared/assets/logo.png';

const IDS = { email: 'login-email', password: 'login-password' };
const idFor = (field) => IDS[field] ?? field;
const SCHEMA = { email: [required(), emailRule()], password: [required()] };

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, expired } = useSession();
  const formRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    const clientErrors = validateForm({ email, password }, SCHEMA);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const result = await submit(() => authApi.login(email, password));
    if (result.ok) {
      navigate('/', { replace: true });
    } else if (result.error) {
      fromApi(result.error);
      setPassword(''); // the e-mail is kept; a rejected password is never kept
    }
  }

  const labels = { email: t('auth.email'), password: t('auth.password') };

  return (
    <section className="login">
      <div className="login-aside">
        <img className="login-logo" src={logoUrl} alt="" />
        <p className="login-brand">LaPrizza</p>
        <p className="login-tagline">{t('home.description')}</p>
      </div>

      <div className="login-panel">
        <h1>{t('auth.loginTitle')}</h1>
        <p className="login-subtitle">{t('auth.loginSubtitle')}</p>

        {expired && !error && (
          <p className="message message-warning" role="status">
            {t('auth.sessionExpired')}
          </p>
        )}

        {/* method="post": even without JavaScript the password never goes in the URL. */}
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
            <label htmlFor="login-email">{t('auth.email')}</label>
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
            <FieldError id="login-email-error" error={errors.email} />
          </div>
          <div>
            <label htmlFor="login-password">{t('auth.password')}</label>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearField('password');
                }}
                {...fieldProps('password', errors, idFor)}
              />
              <button
                type="button"
                className="ghost small password-toggle"
                aria-controls="login-password"
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              </button>
            </div>
            <FieldError id="login-password-error" error={errors.password} />
          </div>

          <button type="submit" className="block" disabled={submitting}>
            {submitting && <Spinner />}
            {t('auth.loginSubmit')}
          </button>
        </form>

        <p>
          <Link to="/forgot-password">{t('auth.forgotLink')}</Link>
        </p>
      </div>
    </section>
  );
}
