import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  kitchenConfigurationApi,
  getKitchenConfigErrorKey,
} from './kitchen-configuration-api.js';
import AssemblyLinePicker from '../assembly-line-configuration/assembly-line-picker.jsx';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { useFieldErrors } from '../../shared/forms/use-field-errors.js';
import { fieldProps } from '../../shared/forms/field-props.js';
import {
  hasErrors,
  required,
  validateForm,
} from '../../shared/forms/validators.js';
import FieldError from '../../shared/ui/feedback/field-error.jsx';
import FormErrors from '../../shared/ui/feedback/form-errors.jsx';
import Spinner from '../../shared/ui/feedback/spinner.jsx';

const SCHEMA = { name: [required()], content: [required()] };

const DEFAULT_KITCHEN_CONTENT =
  '{\n  "dimensions": {\n    "width": 10,\n    "length": 15,\n    "height": 3\n  },\n  "elements": []\n}';

/**
 * JSON configuration form shared by kitchen and assembly line configurations:
 * name + JSON content (typed or imported from a file), syntax checked in the browser
 * and validated by the back end on save.
 *
 * `idPrefix` keeps the field ids unique when more than one form exists on the page.
 * `renderContentTools` adds feature-specific helpers above the JSON editor.
 */
export function ConfigurationForm({
  initialData,
  onSuccess,
  onCancel,
  api,
  getErrorKey,
  defaultContent,
  idPrefix,
  renderContentTools,
}) {
  const { t } = useTranslation();
  const formRef = useRef(null);
  const fileInputRef = useRef(null);

  const ids = { name: `${idPrefix}-name`, content: `${idPrefix}-content` };
  const idFor = (field) => ids[field] ?? field;

  const [name, setName] = useState(initialData?.name || '');
  const [content, setContent] = useState(
    initialData ? JSON.stringify(initialData.content, null, 2) : defaultContent
  );

  // JSON syntax problems are found in the browser, before any request.
  const [localError, setLocalError] = useState(null);
  const { submit, submitting, error } = useSubmit();
  const { errors, setErrors, fromApi, clearField } = useFieldErrors(formRef);

  const changeContent = (value) => {
    setContent(value);
    setLocalError(null);
    clearField('content');
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        changeContent(JSON.stringify(parsed, null, 2));
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
          ? api.update(initialData.id, payload)
          : api.create(payload),
      { successKey: 'kitchenConfig.savedSuccess' }
    );

    if (result.ok) onSuccess();
    else if (result.error) fromApi(result.error); // inputs keep their values
  };

  const labels = {
    name: t('kitchenConfig.form.name'),
    content: t('kitchenConfig.form.jsonContent'),
  };

  // Violations listed by the API go to the summary; other 4xx keep the feature-specific text.
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
          {t(getErrorKey(error))}
        </p>
      )}

      <div>
        <label htmlFor={ids.name}>{t('kitchenConfig.form.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearField('name');
          }}
          {...fieldProps('name', errors, idFor)}
        />
        <FieldError id={`${ids.name}-error`} error={errors.name} />
      </div>

      {renderContentTools?.({
        content,
        onContentChange: changeContent,
        onError: setLocalError,
        disabled: submitting,
      })}

      <div>
        <label htmlFor={ids.content}>
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
          onChange={(e) => changeContent(e.target.value)}
          {...fieldProps('content', errors, idFor)}
        />
        <FieldError id={`${ids.content}-error`} error={errors.content} />
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

export default function KitchenConfigurationForm({
  initialData,
  onSuccess,
  onCancel,
}) {
  return (
    <ConfigurationForm
      initialData={initialData}
      onSuccess={onSuccess}
      onCancel={onCancel}
      api={kitchenConfigurationApi}
      getErrorKey={getKitchenConfigErrorKey}
      defaultContent={DEFAULT_KITCHEN_CONTENT}
      idPrefix="config"
      renderContentTools={(tools) => <AssemblyLinePicker {...tools} />}
    />
  );
}
