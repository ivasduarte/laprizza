import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { authErrorText } from '../../shared/auth/auth-error.js';
import {
  activationStep,
  providerLabel,
  readActivationToken,
} from '../../shared/auth/account-activation.js';
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

const IDS = { newPassword: 'activate-new', confirmation: 'activate-confirm' };
const idFor = (field) => IDS[field] ?? field;
const SCHEMA = {
  newPassword: passwordRules(),
  confirmation: [required(), sameAs('newPassword')],
};

/** Errors that mean "this link cannot be used" (as opposed to "try again later"). */
const LINK_ERRORS = new Set(['INVITATION_INVALID', 'VALIDATION_FAILED']);

/** Local account: the user chooses the password, then logs in normally. */
function LocalActivation({ token, email, onDone }) {
  const { t } = useTranslation();
  const formRef = useRef(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);

  async function handleSubmit(event) {
    event.preventDefault();
    const clientErrors = validateForm({ newPassword, confirmation }, SCHEMA);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const result = await submit(() =>
      authApi.activateLocal(token, newPassword)
    );
    if (result.ok) onDone();
    else if (result.error) fromApi(result.error); // the typed values are kept
  }

  const labels = {
    newPassword: t('auth.newPassword'),
    confirmation: t('auth.confirmPassword'),
  };

  return (
    <form
      ref={formRef}
      className="auth-form"
      method="post"
      onSubmit={handleSubmit}
      noValidate
      aria-busy={submitting}
    >
      <p>{t('activation.localIntro', { email })}</p>
      <p>{t('auth.passwordRules')}</p>
      <FormErrors errors={errors} error={error} labels={labels} idFor={idFor} />
      <div>
        <label htmlFor="activate-new">{t('auth.newPassword')}</label>
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
        <FieldError id="activate-new-error" error={errors.newPassword} />
      </div>
      <div>
        <label htmlFor="activate-confirm">{t('auth.confirmPassword')}</label>
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
        <FieldError id="activate-confirm-error" error={errors.confirmation} />
      </div>
      <p>{t('activation.noConsent')}</p>
      <div className="auth-actions">
        <button type="submit" disabled={submitting}>
          {submitting && <Spinner />}
          {t('activation.submit')}
        </button>
      </div>
    </form>
  );
}

/** External account: the user confirms the identity at the provider linked to the account. */
function ExternalActivation({ token, provider, email }) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);
  const label = providerLabel(provider);

  return (
    <div className="auth-form">
      <p>{t('activation.externalIntro', { email, provider: label })}</p>
      <p>{t('activation.noConsent')}</p>
      <div className="auth-actions">
        <button
          type="button"
          disabled={leaving}
          onClick={() => {
            setLeaving(true); // one navigation per click
            authApi.startExternalActivation(token);
          }}
        >
          {leaving && <Spinner />}
          {t('activation.continueWith', { provider: label })}
        </button>
      </div>
    </div>
  );
}

/**
 * Account activation page (AA07), opened from the invitation e-mail (`/activate#token=...`).
 * The token is read once and removed from the address bar; the link is checked with the back
 * end before anything is shown. Activation never signs the user in.
 */
export default function ActivateAccountPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => readActivationToken(location.hash));
  const [attempt, setAttempt] = useState(0);
  const [check, setCheck] = useState(() =>
    token ? { state: 'checking' } : { state: 'invalid' }
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    setCheck({ state: 'checking' });
    authApi
      .inspectActivation(token, controller.signal)
      .then((inspection) => {
        const next = activationStep(inspection);
        setCheck(
          next.step === 'invalid'
            ? { state: 'invalid' }
            : { state: 'ready', ...next }
        );
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setCheck(
          LINK_ERRORS.has(error?.code)
            ? { state: 'invalid' }
            : { state: 'failed', error }
        );
      });
    return () => controller.abort();
  }, [token, attempt]);

  let content;
  if (done) {
    content = (
      <p className="message message-success" role="status">
        {t('activation.done')}
      </p>
    );
  } else if (check.state === 'checking') {
    content = (
      <p role="status">
        <Spinner /> {t('activation.checking')}
      </p>
    );
  } else if (check.state === 'invalid') {
    content = (
      <p className="message message-error" role="alert">
        {t('activation.invalidLink')}
      </p>
    );
  } else if (check.state === 'failed') {
    content = (
      <>
        <p className="message message-error" role="alert">
          {authErrorText(t, check.error)}
        </p>
        <button
          type="button"
          className="ghost"
          onClick={() => setAttempt((n) => n + 1)}
        >
          {t('activation.retry')}
        </button>
      </>
    );
  } else if (check.step === 'local') {
    content = (
      <LocalActivation
        token={token}
        email={check.email}
        onDone={() => setDone(true)}
      />
    );
  } else {
    content = (
      <ExternalActivation
        token={token}
        provider={check.provider}
        email={check.email}
      />
    );
  }

  return (
    <section className="auth-page">
      <h1>{t('activation.title')}</h1>
      {content}
      <p>
        <Link to="/login">
          {done ? t('activation.goToLogin') : t('auth.backToLogin')}
        </Link>
      </p>
    </section>
  );
}
