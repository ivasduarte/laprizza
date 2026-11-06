import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  kitchenConfigurationApi,
  getKitchenConfigErrorKey,
} from './kitchen-configuration-api.js';

export function useKitchenConfiguration() {
  const { t } = useTranslation();
  const [activeConfig, setActiveConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Retrieves the active configuration, designed to be consumed by the 3D viewer.
   */
  const loadActive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await kitchenConfigurationApi.getActive();
      setActiveConfig(config);
      return config;
    } catch (err) {
      setError(t(getKitchenConfigErrorKey(err)));
      setActiveConfig(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [t]);

  return {
    activeConfig,
    loading,
    error,
    loadActive,
  };
}