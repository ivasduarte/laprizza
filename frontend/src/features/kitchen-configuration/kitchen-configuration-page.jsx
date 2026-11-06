import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../shared/auth/use-session.js';
import {
  kitchenConfigurationApi,
  getKitchenConfigErrorKey,
} from './kitchen-configuration-api.js';
import { useKitchenConfiguration } from './use-kitchen-configuration.js';
import KitchenConfigurationForm from './kitchen-configuration-form.jsx';
import './kitchen-configuration.css';

export default function KitchenConfigurationPage() {
  const { t } = useTranslation();
  const { status, user } = useSession();
  const { loadActive } = useKitchenConfiguration();

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
    if (status === 'authenticated' && user?.roles?.includes('MANAGER')) {
      fetchConfigs();
    }
  }, [status, user, fetchConfigs]);

  if (status !== 'authenticated' || !user?.roles?.includes('MANAGER')) {
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
      // Test the API retrieval hook for the 3D viewer
      await loadActive();
      // ADR-0027: Force viewer remount
      setViewerKey(Date.now());
      setSuccessMsg(t('kitchenConfig.activatedSuccess'));
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(t(getKitchenConfigErrorKey(err)));
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingConfig(null);
    fetchConfigs();
  };

  return (
    <div className="kitchen-config-page">
      <header className="kitchen-config-header">
        <h1>{t('kitchenConfig.title')}</h1>
        {!isFormOpen && !viewingJson && (
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

      {isFormOpen && (
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
                    <button
                      className="secondary"
                      onClick={() => {
                        setEditingConfig(config);
                        setIsFormOpen(true);
                      }}
                    >
                      {t('kitchenConfig.editBtn')}
                    </button>
                    {!config.isActive && (
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

          {/* Integration point for VIS module - React key reset applies ADR-0027 */}
          <div className="viewer-mock-container" key={viewerKey}>
            <p>
              <strong>[3D Viewer Mount Point]</strong>
            </p>
            <p>{t('kitchenConfig.viewerReloaded')}</p>
          </div>
        </>
      )}
    </div>
  );
}