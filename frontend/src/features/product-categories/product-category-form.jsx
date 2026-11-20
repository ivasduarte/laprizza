import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePostProductCategories,
  usePutProductCategoriesId,
} from '../../api/generated/default/default.js';
import { invalidateResource } from '../../shared/api/invalidate.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps, makeIdFor } from '../../shared/forms/field-props.js';
import {
  hasErrors,
  required,
  validateForm,
} from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';
import { getProductCategoryErrorKey } from './product-categories-errors.js';

// Uniqueness and normalization of the name stay in the back end.
const SCHEMA = { name: [required()] };
const idFor = makeIdFor('product-category');

export default function ProductCategoryForm({ category, onSaved, onCancel }) {
  const { t } = useTranslation();

  const queryClient = useQueryClient();
  const formRef = useRef(null);
  const isEdit = Boolean(category?.id);

  const [name, setName] = useState(category?.name ?? '');
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);

  const createCategory = usePostProductCategories();
  const updateCategory = usePutProductCategoriesId();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = validateForm({ name }, SCHEMA);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const data = { name: name.trim() };
    const result = await submit(
      () =>
        isEdit
          ? updateCategory.mutateAsync({ id: category.id, data })
          : createCategory.mutateAsync({ data }),
      {
        successKey: isEdit
          ? 'productCategories.updated'
          : 'productCategories.created',
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
        '/product-categories',
        '/catalogue'
      );
    }
    if (result.ok) {
      onSaved(result.value);
    } else if (result.error) {
      fromApi(result.error);
    }
  };

  const errorKey = getProductCategoryErrorKey('save', error);
  const labels = { name: t('productCategories.form.name') };

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
          ? t('productCategories.form.editTitle', { name: category.name })
          : t('productCategories.form.createTitle')}
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
        <label htmlFor={idFor('name')}>
          {t('productCategories.form.name')} *
        </label>
        <input
          type="text"
          value={name}
          required
          onChange={(event) => {
            setName(event.target.value);
            clearField('name');
          }}
          {...fieldProps('name', errors, idFor)}
        />
        <FieldError id={`${idFor('name')}-error`} error={errors.name} />
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
