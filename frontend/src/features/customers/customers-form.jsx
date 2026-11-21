import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAllergens,
  usePatchCustomersId,
  usePostCustomers,
} from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useCan } from '../../shared/auth/use-can.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps, makeIdFor } from '../../shared/forms/field-props.js';
import {
  email,
  hasErrors,
  maxLength,
  minLength,
  pattern,
  personName,
  placeName,
  portuguesePhone,
  required,
  validateForm,
} from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';
import {
  customerFieldErrors,
  getCustomerErrorKey,
} from './customers-errors.js';

/** WEB04: same limits as the back end (customers.domain.js CUSTOMER_FIELD_LIMITS). */
const LIMITS = {
  name: 50,
  email: 254,
  phoneNumber: 20,
  'address.street': 100,
  'address.houseNumber': 10,
  'address.complement': 100,
  'address.city': 60,
  'address.district': 40,
};

// Formats checked in the browser; uniqueness and postal code/city match stay in the back end.
const SCHEMA = {
  name: [required(), minLength(3), maxLength(LIMITS.name), personName()],
  email: [required(), maxLength(LIMITS.email), email()],
  phoneNumber: [required(), portuguesePhone()],
  'address.street': [required(), maxLength(LIMITS['address.street'])],
  'address.houseNumber': [required(), maxLength(LIMITS['address.houseNumber'])],
  'address.complement': [maxLength(LIMITS['address.complement'])],
  'address.postalCode': [
    required(),
    pattern(/^\d{4}-\d{3}$/, 'customer.postalCode'),
  ],
  'address.city': [required(), maxLength(LIMITS['address.city']), placeName()],
  'address.district': [
    required(),
    maxLength(LIMITS['address.district']),
    placeName(),
  ],
};
const ADDRESS_FIELDS = [
  'street',
  'houseNumber',
  'complement',
  'postalCode',
  'city',
  'district',
];
const idFor = makeIdFor('customer');

function initialValues(customer) {
  const values = {
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    phoneNumber: customer?.phoneNumber ?? '',
    dietaryRestrictions: customer?.dietaryRestrictions ?? [],
  };
  ADDRESS_FIELDS.forEach((field) => {
    values[`address.${field}`] = customer?.address?.[field] ?? '';
  });
  return values;
}

function toPayload(values) {
  const address = {};
  ADDRESS_FIELDS.forEach((field) => {
    const value = values[`address.${field}`].trim();
    if (value) address[field] = value; 
  });
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    phoneNumber: values.phoneNumber.trim(),
    address,
    dietaryRestrictions: values.dietaryRestrictions,
  };
}

export default function CustomerForm({ customer, onSaved, onCancel }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const isEdit = Boolean(customer?.id);
  const canReadAllergens = useCan('allergens:read');
  const allergens = useGetAllergens(undefined, {
    query: { enabled: canReadAllergens },
  });

  const [values, setValues] = useState(() => initialValues(customer));
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);
  const createCustomer = usePostCustomers();
  const updateCustomer = usePatchCustomersId();

  const change = (field, value) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    clearField(field);
    // The postal code / city mismatch is shown on both fields.
    if (field === 'address.postalCode' || field === 'address.city') {
      clearField('address.postalCode');
      clearField('address.city');
    }
  };

  const toggleRestriction = (allergenId, checked) =>
    change(
      'dietaryRestrictions',
      checked
        ? [...values.dietaryRestrictions, allergenId]
        : values.dietaryRestrictions.filter((id) => id !== allergenId)
    );

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = validateForm(values, SCHEMA);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const data = toPayload(values);
    const result = await submit(
      () =>
        isEdit
          ? updateCustomer.mutateAsync({ id: customer.id, data })
          : createCustomer.mutateAsync({ data }),
      {
        successKey: isEdit ? 'customers.updated' : 'customers.created',
        successParams: { name: data.name },
      }
    );

    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      await invalidateResource(queryClient, '/customers');
    }
    if (result.ok) {
      onSaved(result.value);
    } else if (result.error) {
      const fieldErrors = await customerFieldErrors(
        queryClient,
        result.error,
        data,
        customer?.id
      );
      if (fieldErrors) setErrors(fieldErrors);
      else fromApi(result.error); // the inputs keep their values
    }
  };

  const errorKey = getCustomerErrorKey('save', error);
  const labels = {
    name: t('customers.form.name'),
    email: t('customers.form.email'),
    phoneNumber: t('customers.form.phoneNumber'),
    'address.street': t('customers.form.street'),
    'address.houseNumber': t('customers.form.houseNumber'),
    'address.complement': t('customers.form.complement'),
    'address.postalCode': t('customers.form.postalCode'),
    'address.city': t('customers.form.city'),
    'address.district': t('customers.form.district'),
    dietaryRestrictions: t('customers.form.dietaryRestrictions'),
  };

  const textField = (
    field,
    { requiredField = true, type = 'text', hint, ...input } = {}
  ) => (
    <div>
      <label htmlFor={idFor(field)}>
        {labels[field]}
        {requiredField && ' *'}
      </label>
      <input
        type={type}
        value={values[field]}
        required={requiredField}
        maxLength={LIMITS[field]}
        onChange={(event) => change(field, event.target.value)}
        {...input}
        {...fieldProps(field, errors, idFor)}
      />
      <FieldError id={`${idFor(field)}-error`} error={errors[field]} />
      {hint && <p className="entity-hint">{hint}</p>}
    </div>
  );

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="entity-card entity-form"
      noValidate
      aria-busy={submitting}
    >
      <h2>
        {isEdit
          ? t('customers.form.editTitle', { name: customer.name })
          : t('customers.form.createTitle')}
      </h2>
      <p className="entity-hint">{t('entity.required')}</p>

      <FormErrors
        errors={errors}
        error={errorKey ? null : error}
        labels={labels}
        idFor={idFor}
      />
      {errorKey && (
        <p className="message message-error" role="alert">
          {t(errorKey)}
        </p>
      )}

      {textField('name', {
        autoComplete: 'off',
        hint: t('customers.form.nameHint'),
      })}

      <fieldset className="entity-form">
        <legend>{t('customers.form.contacts')}</legend>
        {textField('email', { type: 'email', autoComplete: 'off' })}
        {textField('phoneNumber', {
          type: 'tel',
          autoComplete: 'off',
          hint: t('customers.form.phoneHint'),
        })}
      </fieldset>

      <fieldset className="entity-form">
        <legend>{t('customers.form.address')}</legend>
        {textField('address.street')}
        {textField('address.houseNumber')}
        {textField('address.complement', { requiredField: false })}
        {textField('address.postalCode', {
          inputMode: 'numeric',
          maxLength: 8,
          hint: t('customers.form.postalCodeHint'),
        })}
        {textField('address.city')}
        {textField('address.district')}
      </fieldset>

      {/* Dietary restrictions only for users who can read allergens (MANAGER). */}
      {canReadAllergens && (
        <fieldset className="entity-form">
          <legend>{labels.dietaryRestrictions}</legend>
          {(allergens.data ?? []).length === 0 && (
            <p className="entity-hint">{t('customers.form.noAllergens')}</p>
          )}
          {(allergens.data ?? []).map((allergen) => (
            <label key={allergen.id}>
              <input
                type="checkbox"
                checked={values.dietaryRestrictions.includes(allergen.id)}
                onChange={(event) =>
                  toggleRestriction(allergen.id, event.target.checked)
                }
              />{' '}
              {allergen.name}
            </label>
          ))}
          <FieldError
            id={`${idFor('dietaryRestrictions')}-error`}
            error={errors.dietaryRestrictions}
          />
        </fieldset>
      )}

      <div className="entity-actions entity-form-actions">
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          {t('entity.cancel')}
        </button>
        <button type="submit" disabled={submitting}>
          {submitting && <Spinner />}
          {submitting ? t('entity.saving') : t('entity.save')}
        </button>
      </div>
    </form>
  );
}
