import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { usePostAllergens } from '../../api/generated/default/default';
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
import { getAllergenErrorKey } from './allergens-errors.js';

// Uniqueness of the name stays in the back end.
const SCHEMA = { name: [required()] };
const idFor = makeIdFor('allergen');

export default function AllergenForm({ onSaved, onCancel }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const formRef = useRef(null);

  const [name, setName] = useState('');
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);
  const createAllergen = usePostAllergens();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = validateForm({ name }, SCHEMA);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    const data = { name: name.trim() };
    const result = await submit(() => createAllergen.mutateAsync({ data }), {
      successKey: 'allergens.created',
      successParams: { name: data.name },
    });

    if (result.ok || result.error?.outcomeUnknown) {
      await invalidateResource(queryClient, '/allergens', '/catalogue');
    }
    if (result.ok) {
      onSaved(result.value);
    } else if (result.error) {
      fromApi(result.error); 
    }
  };

  const errorKey = getAllergenErrorKey('create', error);
  const labels = { name: t('allergens.form.name') };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="entity-card entity-form"
      noValidate
      aria-busy={submitting}
    >
      <h2>{t('allergens.form.createTitle')}</h2>
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
        <label htmlFor={idFor('name')}>{t('allergens.form.name')} *</label>
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
        <p className="entity-hint">{t('allergens.form.nameHint')}</p>
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
