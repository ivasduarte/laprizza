import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCan } from '../../shared/auth/use-can.js';
import { useConfirm } from '../../shared/feedback/use-feedback.js';
import { useSubmit } from '../../shared/forms/use-submit.js';
import { errorMessage } from '../../shared/api/error-text.js';
import {
  isAbortError,
  normalizeError,
} from '../../shared/api/error-normalizer.js';
import {
  kitchenConfigurationApi,
  getKitchenConfigErrorKey,
} from './kitchen-configuration-api.js';
import KitchenConfigurationForm from './kitchen-configuration-form.jsx';
import KitchenViewer from './kitchen-viewer.jsx';
import AssemblyLineConfigurationSection from '../assembly-line-configuration/assembly-line-configuration-section.jsx';
import './kitchen-configuration.css';
import Loading from '../../shared/ui/feedback/loading.jsx';

export default function KitchenConfigurationPage() {
  const { t } = useTranslation();
  const canView = useCan('kitchen:read');
  const canManage = useCan('kitchen:write');

  const confirm = useConfirm();
  const { submit, submitting, error } = useSubmit();

  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [viewingJson, setViewingJson] = useState(null);

  const [viewerKey, setViewerKey] = useState(Date.now());

  // 'silent': a failed list load is shown inline below, not also as a toast.
  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await kitchenConfigurationApi.list({ feedback: 'silent' }));
      setListError(null);
    } catch (err) {
      if (!isAbortError(err)) setListError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) {
      fetchConfigs();
    }
  }, [canView, fetchConfigs]);

  if (!canView) {
    return (
      <main className="kitchen-config-page">
        <p className="message message-error" role="alert">
          {t('kitchenConfig.unauthorized')}
        </p>
      </main>
    );
  }

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      titleKey: 'kitchenConfig.confirmDeleteTitle',
      messageKey: 'kitchenConfig.confirmDelete',
      confirmKey: 'kitchenConfig.deleteBtn',
      tone: 'danger',
    });
    if (!confirmed) return;

    const result = await submit(() => kitchenConfigurationApi.remove(id), {
      successKey: 'kitchenConfig.deletedSuccess',
    });
    // After a timeout the delete may have happened: show the real state.
    if (result.ok || result.error?.outcomeUnknown) await fetchConfigs();
  };

  const handleActivate = async (id) => {
    const confirmed = await confirm({
      titleKey: 'kitchenConfig.confirmActivateTitle',
      messageKey: 'kitchenConfig.confirmActivate',
      confirmKey: 'kitchenConfig.activateBtn',
    });
    if (!confirmed) return;

    const result = await submit(() => kitchenConfigurationApi.activate(id), {
      successKey: 'kitchenConfig.activatedSuccess',
    });
    if (result.ok || result.error?.outcomeUnknown) await fetchConfigs();
    if (result.ok) {
      // ADR-0032: remount the viewer, which fetches the new active configuration
      setViewerKey(Date.now());
    }
  };

  const handleFormSuccess = () => {
    // ADR-0029/0027: an edit of the active configuration must reload the viewer
    if (editingConfig?.isActive) setViewerKey(Date.now());
    setIsFormOpen(false);
    setEditingConfig(null);
    fetchConfigs();
  };

  return (
    <div className="kitchen-config-page">
      <header className="kitchen-config-header">
        <h1>{t('kitchenConfig.title')}</h1>
        {canManage && !isFormOpen && !viewingJson && (
          <button type="button" onClick={() => setIsFormOpen(true)}>
            {t('kitchenConfig.createNew')}
          </button>
        )}
      </header>

      {/* Network, timeout, 5xx and 403 failures are reported by a global toast. */}
      {error && !error.global && (
        <p className="message message-error" role="alert">
          {t(getKitchenConfigErrorKey(error))}
        </p>
      )}
      {listError && (
        <p className="message message-error" role="alert">
          {errorMessage(t, listError)}{' '}
          <button type="button" className="ghost small" onClick={fetchConfigs}>
            {t('feedback.retry')}
          </button>
        </p>
      )}

      {canManage && isFormOpen && (
        <KitchenConfigurationForm
          initialData={editingConfig}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingConfig(null);
          }}
        />
      )}

      {viewingJson && (
        <div className="kitchen-config-card">
          <h2>{viewingJson.name}</h2>
          <pre className="json-viewer">
            {JSON.stringify(viewingJson.content, null, 2)}
          </pre>
          <div className="kitchen-config-actions">
            <button className="secondary" onClick={() => setViewingJson(null)}>
              {t('kitchenConfig.closeBtn')}
            </button>
          </div>
        </div>
      )}

      {!isFormOpen && !viewingJson && (
        <>
          {loading ? (
            <Loading />
          ) : configs.length === 0 && !listError ? (
            <p>{t('kitchenConfig.noConfigs')}</p>
          ) : (
            <div className="kitchen-config-grid">
              {configs.map((config) => (
                <article
                  key={config.id}
                  className={`kitchen-config-card ${config.isActive ? 'active' : ''}`}
                >
                  <header
                    style={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <h3 style={{ margin: 0 }}>{config.name}</h3>
                    {config.isActive && (
                      <span className="active-badge">
                        {t('kitchenConfig.activeLabel')}
                      </span>
                    )}
                  </header>

                  <div className="kitchen-config-actions">
                    <button
                      className="secondary"
                      onClick={() => setViewingJson(config)}
                    >
                      {t('kitchenConfig.viewBtn')}
                    </button>
                    {canManage && (
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditingConfig(config);
                          setIsFormOpen(true);
                        }}
                      >
                        {t('kitchenConfig.editBtn')}
                      </button>
                    )}
                    {canManage && !config.isActive && (
                      <>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleActivate(config.id)}
                        >
                          {t('kitchenConfig.activateBtn')}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={submitting}
                          onClick={() => handleDelete(config.id)}
                        >
                          {t('kitchenConfig.deleteBtn')}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* VIS03: library of assembly lines placed by the kitchen configurations */}
          <AssemblyLineConfigurationSection
            isManager={canManage}
            onChanged={() => setViewerKey(Date.now())}
          />

          {/* Integration point for the VIS module - the React key reset applies ADR-0032 */}
          <KitchenViewer key={viewerKey} />
        </>
      )}
    </div>
  );
}
