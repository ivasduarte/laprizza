import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePatchPizzaSizeId,
  usePostPizzaSize,
} from '../../api/generated/default/default';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps, makeIdFor } from '../../shared/forms/field-props.js';
import {
  hasErrors,
  maxLength,
  minLength,
  required,
  validateForm,
} from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';
import { getPizzaSizeErrorKey } from './pizza-sizes-errors.js';

// Same limits as the API (3 to 50 characters); uniqueness stays in the back end.
const NAME_MAX = 50;
const SCHEMA = { name: [required(), minLength(3), maxLength(NAME_MAX)] };
const idFor = makeIdFor('pizza-size');

export default function PizzaSizeForm({ size, onSaved, onCancel }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const isEdit = Boolean(size?.id);

  const [name, setName] = useState(size?.name ?? '');
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);
  const createSize = usePostPizzaSize();
  const updateSize = usePatchPizzaSizeId();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = validateForm({ name }, SCHEMA);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const data = { name: name.trim() };
    const result = await submit(
      () =>
        isEdit
          ? updateSize.mutateAsync({ id: size.id, data })
          : createSize.mutateAsync({ data }),
      {
        successKey: isEdit ? 'pizzaSizes.updated' : 'pizzaSizes.created',
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
        '/pizza-size',
        '/catalogue',
        '/predefined-pizzas'
      );
    }
    if (result.ok) {
      onSaved(result.value);
    } else if (result.error) {
      fromApi(result.error);
    }
  };

  const errorKey = getPizzaSizeErrorKey('save', error);
  const labels = { name: t('pizzaSizes.form.name') };

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
          ? t('pizzaSizes.form.editTitle', { name: size.name })
          : t('pizzaSizes.form.createTitle')}
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
        <label htmlFor={idFor('name')}>{t('pizzaSizes.form.name')} *</label>
        <input
          type="text"
          value={name}
          required
          maxLength={NAME_MAX}
          onChange={(event) => {
            setName(event.target.value);
            clearField('name');
          }}
          {...fieldProps('name', errors, idFor)}
        />
        <FieldError id={`${idFor('name')}-error`} error={errors.name} />
        <p className="entity-hint">{t('pizzaSizes.form.nameHint')}</p>
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
