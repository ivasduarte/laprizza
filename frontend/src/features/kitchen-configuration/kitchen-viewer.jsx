import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useKitchenConfiguration } from './use-kitchen-configuration.js';
import KitchenScene from '../visualization3d/kitchen-scene.jsx';

/**
 * Integration point of the 3D Visualization module (VIS01-VIS07).
 *
 * It fetches the active kitchen configuration from `GET /kitchen-configurations/active`
 * when it is mounted and renders a placeholder until the Three.js scene is plugged in.
 * The parent changes its React key to force a remount (ADR-0027), which triggers a new fetch.
 * When no configuration is active (404) it shows an explicit empty state and never falls
 * back to a hardcoded layout (ADR-0025).
 */
export default function KitchenViewer() {
  const { t } = useTranslation();
  const { activeConfig, loading, error, loadActive } =
    useKitchenConfiguration();

  useEffect(() => {
    // The error is already exposed through the hook state.
    loadActive().catch(() => {});
  }, [loadActive]);

  return (
    <section
      className="viewer-mock-container"
      aria-label={t('kitchenConfig.viewer.label', 'Kitchen viewer')}
    >

      <KitchenScene/>

      {loading && <p role="status">{t('layout.loading')}</p>}
      {!loading && error && (
        <p className="message message-error" role="alert">
          {t(
            'kitchenConfig.viewer.empty',
            'No active kitchen configuration to display.'
          )}
        </p>
      )}
      {!loading && activeConfig && (
        <p data-testid="viewer-active-config">
          {t('kitchenConfig.viewer.showing', 'Showing')}: {activeConfig.name}
        </p>
      )}
    </section>
  );
}