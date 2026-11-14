import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isAbortError } from '../../shared/api/error-normalizer.js';
import { assemblyLineConfigurationApi } from './assembly-line-configuration-api.js';
import {
  NO_LINE,
  applyAssemblyLineSelection,
  readSelectedLineId,
} from './assembly-line-placement.js';

/**
 * Selects the assembly line placed in the kitchen. It edits `content.assemblyLine`
 * in the JSON text, which stays the single source of truth of the form (WEB06):
 * the manager can still fine-tune position and rotation by hand.
 */
export default function AssemblyLinePicker({
  content,
  onContentChange,
  onError,
  disabled,
}) {
  const { t } = useTranslation();
  const [lines, setLines] = useState([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    assemblyLineConfigurationApi
      .list({ feedback: 'silent' })
      .then((result) => {
        if (!cancelled) setLines(result);
      })
      .catch((err) => {
        if (!cancelled && !isAbortError(err)) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedId = readSelectedLineId(content);
  const jsonInvalid = selectedId === null;
  // A reference to a line that no longer exists is shown instead of silently hidden.
  const isUnknown = selectedId && !lines.some((line) => line.id === selectedId);

  const handleChange = (event) => {
    try {
      onContentChange(applyAssemblyLineSelection(content, event.target.value));
    } catch {
      onError(t('assemblyLine.picker.fixJsonFirst'));
    }
  };

  return (
    <div>
      <label htmlFor="kitchen-assembly-line">
        {t('assemblyLine.picker.label')}
      </label>
      <select
        id="kitchen-assembly-line"
        value={jsonInvalid ? NO_LINE : selectedId}
        onChange={handleChange}
        disabled={disabled || jsonInvalid}
        aria-describedby="kitchen-assembly-line-hint"
      >
        <option value={NO_LINE}>{t('assemblyLine.picker.none')}</option>
        {isUnknown && (
          <option value={selectedId}>
            {t('assemblyLine.picker.unknown', { id: selectedId })}
          </option>
        )}
        {lines.map((line) => (
          <option key={line.id} value={line.id}>
            {line.name}
          </option>
        ))}
      </select>
      <small id="kitchen-assembly-line-hint" style={{ display: 'block' }}>
        {jsonInvalid
          ? t('assemblyLine.picker.fixJsonFirst')
          : loadFailed
            ? t('assemblyLine.picker.loadFailed')
            : t('assemblyLine.picker.hint')}
      </small>
    </div>
  );
}
