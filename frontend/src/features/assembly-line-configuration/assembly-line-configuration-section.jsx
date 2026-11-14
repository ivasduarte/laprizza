import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { errorMessage } from '../../shared/api/error-text.js';
import {
  isAbortError,
  normalizeError,
} from '../../shared/api/error-normalizer.js';
import { ConfigurationForm } from '../kitchen-configuration/kitchen-configuration-form.jsx';
import {
  assemblyLineConfigurationApi,
  getAssemblyLineErrorKey,
} from './assembly-line-configuration-api.js';
import { DEFAULT_ASSEMBLY_LINE_CONTENT } from './default-assembly-line.js';

const DEFAULT_LINE_CONTENT = JSON.stringify(
  DEFAULT_ASSEMBLY_LINE_CONTENT,
  null,
  2
);

/**
 * Library of assembly line definitions (VIS03), part of the Kitchen Configuration page
 * (WEB06). A line has no active state: it is shown when the active kitchen configuration
 * references it, so this section never activates anything.
 *
 * `onChanged` lets the page reload the viewer after an edit, because the active kitchen
 * may reference the edited line.
 */
export default function AssemblyLineConfigurationSection({
  isManager,
  onChanged,
}) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { submit, submitting, error } = useSubmit();

  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLine, setEditingLine] = useState(null);
  const [viewingLine, setViewingLine] = useState(null);

  // 'silent': a failed list load is shown inline below, not also as a toast.
  const fetchLines = useCallback(async () => {
    setLoading(true);
    try {
      setLines(await assemblyLineConfigurationApi.list({ feedback: 'silent' }));
      setListError(null);
    } catch (err) {
      if (!isAbortError(err)) setListError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingLine(null);
  };

  const handleFormSuccess = () => {
    closeForm();
    fetchLines();
    onChanged?.();
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      titleKey: 'assemblyLine.confirmDeleteTitle',
      messageKey: 'assemblyLine.confirmDelete',
      confirmKey: 'kitchenConfig.deleteBtn',
      tone: 'danger',
    });
    if (!confirmed) return;

    const result = await submit(() => assemblyLineConfigurationApi.remove(id), {
      successKey: 'assemblyLine.deletedSuccess',
    });
    // After a timeout the delete may have happened: show the real state.
    if (result.ok || result.error?.outcomeUnknown) await fetchLines();
  };

  return (
    <section
      className="assembly-line-section"
      aria-labelledby="assembly-line-title"
    >
      <header className="kitchen-config-header">
        <div>
          <h2 id="assembly-line-title">{t('assemblyLine.title')}</h2>
          <p className="assembly-line-intro">{t('assemblyLine.intro')}</p>
        </div>
        {isManager && !isFormOpen && !viewingLine && (
          <button type="button" onClick={() => setIsFormOpen(true)}>
            {t('assemblyLine.createNew')}
          </button>
        )}
      </header>

      {/* Network, timeout, 5xx and 403 failures are reported by a global toast. */}
      {error && !error.global && (
        <p className="message message-error" role="alert">
          {t(getAssemblyLineErrorKey(error))}
        </p>
      )}
      {listError && (
        <p className="message message-error" role="alert">
          {errorMessage(t, listError)}{' '}
          <button type="button" className="ghost small" onClick={fetchLines}>
            {t('feedback.retry')}
          </button>
        </p>
      )}

      {isManager && isFormOpen && (
        <ConfigurationForm
          initialData={editingLine}
          onSuccess={handleFormSuccess}
          onCancel={closeForm}
          api={assemblyLineConfigurationApi}
          getErrorKey={getAssemblyLineErrorKey}
          defaultContent={DEFAULT_LINE_CONTENT}
          idPrefix="assembly-line"
        />
      )}

      {viewingLine && (
        <div className="kitchen-config-card">
          <h3>{viewingLine.name}</h3>
          <pre className="json-viewer">
            {JSON.stringify(viewingLine.content, null, 2)}
          </pre>
          <div className="kitchen-config-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setViewingLine(null)}
            >
              {t('kitchenConfig.closeBtn')}
            </button>
          </div>
        </div>
      )}

      {!isFormOpen &&
        !viewingLine &&
        (loading ? (
          <p role="status">{t('layout.loading')}</p>
        ) : lines.length === 0 && !listError ? (
          <p>{t('assemblyLine.noLines')}</p>
        ) : (
          <div className="kitchen-config-grid">
            {lines.map((line) => (
              <article key={line.id} className="kitchen-config-card">
                <h3 style={{ margin: 0 }}>{line.name}</h3>
                <p className="assembly-line-meta">
                  {t('assemblyLine.elementCount', {
                    count: line.content?.elements?.length ?? 0,
                  })}
                </p>
                <div className="kitchen-config-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setViewingLine(line)}
                  >
                    {t('kitchenConfig.viewBtn')}
                  </button>
                  {isManager && (
                    <>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setEditingLine(line);
                          setIsFormOpen(true);
                        }}
                      >
                        {t('kitchenConfig.editBtn')}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={submitting}
                        onClick={() => handleDelete(line.id)}
                      >
                        {t('kitchenConfig.deleteBtn')}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ))}
    </section>
  );
}
