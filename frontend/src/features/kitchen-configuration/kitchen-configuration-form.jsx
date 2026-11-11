import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  kitchenConfigurationApi,
  getKitchenConfigErrorKey,
} from './kitchen-configuration-api.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps } from '../../shared/forms/field-props.js';
import { hasErrors, required, validateForm } from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';

const FIELD_IDS = { name: 'config-name', content: 'config-content' };
const idFor = (field) => FIELD_IDS[field] ?? field;
const SCHEMA = { name: [required()], content: [required()] };

export default function KitchenConfigurationForm({
  initialData,
  onSuccess,
  onCancel,
}) {
  const { t } = useTranslation();
  const formRef = useRef(null);
  const fileInputRef = useRef(null);

  const [name, setName] = useState(initialData?.name || '');
  const [content, setContent] = useState(
    initialData
      ? JSON.stringify(initialData.content, null, 2)
      : '{\n  "dimensions": {\n    "width": 10,\n    "length": 15,\n    "height": 3\n  },\n  "elements": []\n}'
  );

  // JSON syntax problems are found in the browser, before any request.
  const [localError, setLocalError] = useState(null);
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        setContent(JSON.stringify(parsed, null, 2));
        setLocalError(null);
        clearField('content');
      } catch {
        setLocalError(t('kitchenConfig.form.invalidJsonFile'));
      }
    };
    reader.readAsText(file);
    event.target.value = null; // Reset input
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError(null);

    const clientErrors = validateForm({ name, content }, SCHEMA);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      setLocalError(t('kitchenConfig.form.parseError'));
      return;
    }

    const payload = { name, content: parsedContent };
    const result = await submit(
      () =>
        initialData?.id
          ? kitchenConfigurationApi.update(initialData.id, payload)
          : kitchenConfigurationApi.create(payload),
      { successKey: 'kitchenConfig.savedSuccess' }
    );

    if (result.ok) onSuccess();
    else if (result.error) fromApi(result.error); // inputs keep their values
  };

  const labels = {
    name: t('kitchenConfig.form.name'),
    content: t('kitchenConfig.form.jsonContent'),
  };

  // Violations listed by the API go to the summary; other 4xx keep the kitchen-specific text.
  const hasDetails =
    error && (error.fieldErrors.length > 0 || error.formErrors.length > 0);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="kitchen-config-card"
      noValidate
      aria-busy={submitting}
    >
      <FormErrors
        errors={errors}
        error={hasDetails ? error : null}
        labels={labels}
        idFor={idFor}
      />
      {error && !error.global && !hasDetails && (
        <p className="message message-error" role="alert">
          {t(getKitchenConfigErrorKey(error))}
        </p>
      )}

      <div>
        <label htmlFor="config-name">{t('kitchenConfig.form.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearField('name');
          }}
          {...fieldProps('name', errors, idFor)}
        />
        <FieldError id="config-name-error" error={errors.name} />
      </div>

      <div>
        <label htmlFor="config-content">
          {t('kitchenConfig.form.jsonContent')}
          <button
            type="button"
            className="secondary"
            style={{
              marginLeft: '1rem',
              padding: '0.2rem 0.5rem',
              fontSize: '0.8rem',
            }}
            onClick={() => fileInputRef.current.click()}
          >
            {t('kitchenConfig.importFile')}
          </button>
        </label>
        <input
          type="file"
          accept=".json,application/json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <textarea
          className="json-editor"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            clearField('content');
          }}
          {...fieldProps('content', errors, idFor)}
        />
        <FieldError id="config-content-error" error={errors.content} />
      </div>

      {localError && (
        <p className="message message-error" role="alert">
          {localError}
        </p>
      )}

      <div className="kitchen-config-actions">
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          {t('ai.cancel')}
        </button>
        <button type="submit" disabled={submitting}>
          {submitting && <Spinner />}
          {submitting
            ? t('kitchenConfig.form.saving')
            : t('kitchenConfig.form.saveBtn')}
        </button>
      </div>
    </form>
  );
}
