import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetPizzaComponentType,
  usePostPizzaComponentType,
  usePutPizzaComponentTypeId,
} from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps, makeIdFor } from '../../shared/forms/field-props.js';
import {
  hasErrors,
  integer,
  minValue,
  required,
  validateForm,
} from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';
import {
  conflictFieldErrors,
  getPizzaComponentTypeErrorKey,
} from './pizza-component-types-errors.js';

const notBelowMinimum = () => (value, values) =>
  !values.unlimited &&
  value !== '' &&
  values.minQuantity !== '' &&
  Number(value) < Number(values.minQuantity)
    ? { type: 'pizzaComponentType.range' }
    : null;

const SCHEMA = {
  name: [required()],
  assemblyOrder: [required(), integer(), minValue(1)],
  minQuantity: [required(), integer(), minValue(0)],
};
const MAX_RULES = [required(), integer(), minValue(1), notBelowMinimum()];
const idFor = makeIdFor('pizza-component-type');

const toText = (value) =>
  value === null || value === undefined ? '' : String(value);

export default function PizzaComponentTypeForm({ type, onSaved, onCancel }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const isEdit = Boolean(type?.id);

  const [values, setValues] = useState({
    name: type?.name ?? '',
    assemblyOrder: toText(type?.assemblyOrder),
    minQuantity: toText(type?.minQuantity ?? 0),
    maxQuantity: toText(type?.maxQuantity),
    unlimited: isEdit && type.maxQuantity === null,
  });
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);
  const createType = usePostPizzaComponentType();
  const updateType = usePutPizzaComponentTypeId();
  const activeTypes = useGetPizzaComponentType();

  const change = (field, value) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    clearField(field);
    if (field === 'minQuantity' || field === 'unlimited') {
      clearField('maxQuantity');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const schema = values.unlimited
      ? SCHEMA
      : { ...SCHEMA, maxQuantity: MAX_RULES };
    const clientErrors = validateForm(values, schema);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    // The API only accepts numbers (Joi strict).
    const data = {
      name: values.name.trim(),
      assemblyOrder: Number(values.assemblyOrder),
      minQuantity: Number(values.minQuantity),
      maxQuantity: values.unlimited ? null : Number(values.maxQuantity),
    };
    const result = await submit(
      () =>
        isEdit
          ? updateType.mutateAsync({ id: type.id, data })
          : createType.mutateAsync({ data }),
      {
        successKey: isEdit
          ? 'pizzaComponentTypes.updated'
          : 'pizzaComponentTypes.created',
        successParams: { name: data.name },
      }
    );

    if (
      result.ok ||
      result.error?.outcomeUnknown ||
      result.error?.status === 404
    ) {
      await invalidateResource(
        queryClient,
        '/pizza-component-type',
        '/predefined-pizzas'
      );
    }
    if (result.ok) {
      onSaved(result.value);
    } else if (result.error?.status === 409) {
      const latest = await activeTypes.refetch();
      setErrors(conflictFieldErrors(data, latest.data ?? [], type?.id));
    } else if (result.error) {
      fromApi(result.error); 
    }
  };

  const errorKey = getPizzaComponentTypeErrorKey('save', error);
  const labels = {
    name: t('pizzaComponentTypes.form.name'),
    assemblyOrder: t('pizzaComponentTypes.form.assemblyOrder'),
    minQuantity: t('pizzaComponentTypes.form.minQuantity'),
    maxQuantity: t('pizzaComponentTypes.form.maxQuantity'),
  };

  const numberField = (field, min, hintKey) => (
    <div>
      <label htmlFor={idFor(field)}>{labels[field]} *</label>
      <input
        type="number"
        inputMode="numeric"
        step="1"
        min={min}
        value={values[field]}
        required
        onChange={(event) => change(field, event.target.value)}
        {...fieldProps(field, errors, idFor)}
      />
      <FieldError id={`${idFor(field)}-error`} error={errors[field]} />
      {hintKey && <p className="entity-hint">{t(hintKey)}</p>}
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
          ? t('pizzaComponentTypes.form.editTitle', { name: type.name })
          : t('pizzaComponentTypes.form.createTitle')}
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

      <div>
        <label htmlFor={idFor('name')}>{labels.name} *</label>
        <input
          type="text"
          value={values.name}
          required
          onChange={(event) => change('name', event.target.value)}
          {...fieldProps('name', errors, idFor)}
        />
        <FieldError id={`${idFor('name')}-error`} error={errors.name} />
      </div>

      {numberField(
        'assemblyOrder',
        1,
        'pizzaComponentTypes.form.assemblyOrderHint'
      )}
      {numberField('minQuantity', 0, 'pizzaComponentTypes.form.minHint')}

      <div>
        <label htmlFor={idFor('maxQuantity')}>
          {labels.maxQuantity}
          {!values.unlimited && ' *'}
        </label>
        <input
          type="number"
          inputMode="numeric"
          step="1"
          min={1}
          value={values.unlimited ? '' : values.maxQuantity}
          disabled={values.unlimited}
          required={!values.unlimited}
          onChange={(event) => change('maxQuantity', event.target.value)}
          {...fieldProps('maxQuantity', errors, idFor)}
        />
        <FieldError
          id={`${idFor('maxQuantity')}-error`}
          error={errors.maxQuantity}
        />
        <label>
          <input
            type="checkbox"
            checked={values.unlimited}
            onChange={(event) => change('unlimited', event.target.checked)}
          />{' '}
          {t('pizzaComponentTypes.form.unlimited')}
        </label>
      </div>

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
