import { useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../shared/auth/auth-api.js';
import { useSession } from '../../shared/auth/use-session.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps } from '../../shared/forms/field-props.js';
import {
  hasErrors,
  portuguesePhone,
  required,
  validateForm,
} from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';

const idFor = (field) => (field === 'phoneNumber' ? 'profile-phone' : field);
const SCHEMA = { phoneNumber: [required(), portuguesePhone()] };

/** Only in-app paths are followed after saving (never an absolute URL from the history state). */
const safeReturnPath = (from) =>
  typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? from
    : '/';

/**
 * AA02: contact phone of an account created by an external provider (the providers do not
 * supply it). Until it is saved the back end withholds the customer features.
 */
export default function CompleteProfilePage() {
  const { t } = useTranslation();
  const { user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const formRef = useRef(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);
  const returnTo = safeReturnPath(location.state?.from);

  if (user && !user.phoneRequired) return <Navigate to={returnTo} replace />;

  // The hint stays announced; the error is added when the field is invalid.
  const phoneProps = fieldProps('phoneNumber', errors, idFor);
  phoneProps['aria-describedby'] = [
    phoneProps['aria-describedby'],
    'profile-phone-hint',
  ]
    .filter(Boolean)
    .join(' ');

  async function handleSubmit(event) {
    event.preventDefault();
    const clientErrors = validateForm({ phoneNumber }, SCHEMA);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const result = await submit(() => authApi.setContactPhone(phoneNumber));
    if (result.ok) navigate(returnTo, { replace: true });
    else if (result.error?.code === 'PHONE_INVALID')
      setErrors({ phoneNumber: { type: 'customer.phone' } });
    else if (result.error) fromApi(result.error);
  }

  return (
    <section className="auth-page">
      <h1>{t('profile.phone.title')}</h1>
      <form
        ref={formRef}
        className="auth-form"
        method="post"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={submitting}
      >
        <p>{t('profile.phone.intro')}</p>
        <FormErrors
          errors={errors}
          error={error}
          labels={{ phoneNumber: t('profile.phone.label') }}
          idFor={idFor}
        />
        <div>
          <label htmlFor="profile-phone">{t('profile.phone.label')}</label>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phoneNumber}
            onChange={(event) => {
              setPhoneNumber(event.target.value);
              clearField('phoneNumber');
            }}
            {...phoneProps}
          />
          <p id="profile-phone-hint" className="entity-hint">
            {t('profile.phone.hint')}
          </p>
          <FieldError id="profile-phone-error" error={errors.phoneNumber} />
        </div>

        <div className="auth-actions">
          <button type="submit" disabled={submitting}>
            {submitting && <Spinner />}
            {t('profile.phone.submit')}
          </button>
        </div>
      </form>
    </section>
  );
}
