import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../shared/auth/use-session.js';
import {
  kitchenConfigurationApi,
  getKitchenConfigErrorKey,
} from './kitchen-configuration-api.js';
import KitchenConfigurationForm from './kitchen-configuration-form.jsx';
import KitchenViewer from './kitchen-viewer.jsx';
import './kitchen-configuration.css';

export default function KitchenConfigurationPage() {
  const { t } = useTranslation();
  const { status, user } = useSession();
  const roles = user?.roles ?? [];
  const isManager = roles.includes('MANAGER');
  const canView = isManager || roles.includes('EMPLOYEE');

  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [viewingJson, setViewingJson] = useState(null);

  const [viewerKey, setViewerKey] = useState(Date.now());

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await kitchenConfigurationApi.list();
      setConfigs(data);
      setError(null);
    } catch (err) {
      setError(t(getKitchenConfigErrorKey(err)));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (status === 'authenticated' && canView) {
      fetchConfigs();
    }
  }, [status, canView, fetchConfigs]);

  if (status !== 'authenticated' || !canView) {
    return (
      <main className="kitchen-config-page">
        <p className="message message-error" role="alert">
          {t('kitchenConfig.unauthorized')}
        </p>
      </main>
    );
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('kitchenConfig.confirmDelete'))) return;
    setError(null);
    try {
      await kitchenConfigurationApi.remove(id);
      await fetchConfigs();
    } catch (err) {
      setError(t(getKitchenConfigErrorKey(err)));
    }
  };

  const handleActivate = async (id) => {
    if (!window.confirm(t('kitchenConfig.confirmActivate'))) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await kitchenConfigurationApi.activate(id);
      await fetchConfigs();
      // ADR-0027: remount the viewer, which fetches the new active configuration
      setViewerKey(Date.now());
      setSuccessMsg(t('kitchenConfig.activatedSuccess'));
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(t(getKitchenConfigErrorKey(err)));
    }
  };

  const handleFormSuccess = () => {
    // ADR-0024/0027: an edit of the active configuration must reload the viewer
    if (editingConfig?.isActive) setViewerKey(Date.now());
    setIsFormOpen(false);
    setEditingConfig(null);
    fetchConfigs();
  };

  return (
    <div className="kitchen-config-page">
      <header className="kitchen-config-header">
        <h1>{t('kitchenConfig.title')}</h1>
        {isManager && !isFormOpen && !viewingJson && (
          <button onClick={() => setIsFormOpen(true)}>
            {t('kitchenConfig.createNew')}
          </button>
        )}
      </header>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}
      {successMsg && (
        <p className="message message-success" role="status">
          {successMsg}
        </p>
      )}

      {isManager && isFormOpen && (
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
            <p role="status">{t('layout.loading')}</p>
          ) : configs.length === 0 ? (
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
                    {isManager && (
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
                    {isManager && !config.isActive && (
                      <>
                        <button onClick={() => handleActivate(config.id)}>
                          {t('kitchenConfig.activateBtn')}
                        </button>
                        <button
                          className="danger"
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

          {/* Integration point for the VIS module - the React key reset applies ADR-0027 */}
          <KitchenViewer key={viewerKey} />
        </>
      )}
    </div>
  );
}