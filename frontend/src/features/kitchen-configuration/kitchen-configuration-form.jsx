import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  kitchenConfigurationApi,
  getKitchenConfigErrorKey,
} from './kitchen-configuration-api.js';

export default function KitchenConfigurationForm({
  initialData,
  onSuccess,
  onCancel,
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  const [name, setName] = useState(initialData?.name || '');
  const [content, setContent] = useState(
    initialData
      ? JSON.stringify(initialData.content, null, 2)
      : '{\n  "dimensions": {\n    "width": 10,\n    "length": 15,\n    "height": 3\n  },\n  "elements": []\n}'
  );

  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try { 
        const parsed = JSON.parse(e.target.result);
        setContent(JSON.stringify(parsed, null, 2));
        setError(null);
      } catch {
        setError(t('kitchenConfig.form.invalidJsonFile'));
      }
    };
    reader.readAsText(file);
    event.target.value = null; // Reset input
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      setError(t('kitchenConfig.form.parseError'));
      setIsSubmitting(false);
      return;
    }

    try {
      if (initialData?.id) {
        await kitchenConfigurationApi.update(initialData.id, {
          name,
          content: parsedContent,
        });
      } else {
        await kitchenConfigurationApi.create({ name, content: parsedContent });
      }
      onSuccess();
    } catch (err) {
      setError(
        err.details ? err.details.join(', ') : t(getKitchenConfigErrorKey(err))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="kitchen-config-card">
      <div>
        <label htmlFor="config-name">{t('kitchenConfig.form.name')}</label>
        <input
          id="config-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
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
          id="config-content"
          className="json-editor"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      <div className="kitchen-config-actions">
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t('ai.cancel')}
        </button>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? t('kitchenConfig.form.saving')
            : t('kitchenConfig.form.saveBtn')}
        </button>
      </div>
    </form>
  );
}