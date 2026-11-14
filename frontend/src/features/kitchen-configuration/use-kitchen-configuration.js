import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  kitchenConfigurationApi,
  getKitchenConfigErrorKey,
} from './kitchen-configuration-api.js';
import {
  assemblyLineConfigurationApi,
  getAssemblyLineErrorKey,
} from '../assembly-line-configuration/assembly-line-configuration-api.js';

export function useKitchenConfiguration() {
  const { t } = useTranslation();
  const [activeConfig, setActiveConfig] = useState(null);
  const [assemblyLine, setAssemblyLine] = useState(null);
  const [assemblyLineError, setAssemblyLineError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Resolves the assembly line referenced by the kitchen (VIS03 / WEB06 "resolvable
   * back-end reference"). A failure is reported, never replaced by another layout.
   */
  const loadAssemblyLine = useCallback(
    async (config) => {
      setAssemblyLine(null);
      setAssemblyLineError(null);
      const placement = config?.content?.assemblyLine;
      if (!placement?.configurationId) return;

      try {
        const line = await assemblyLineConfigurationApi.getById(
          placement.configurationId,
          {
            feedback: 'silent',
          }
        );
        setAssemblyLine({ ...line, placement });
      } catch (err) {
        setAssemblyLineError(t(getAssemblyLineErrorKey(err)));
      }
    },
    [t]
  );

  /**
   * Retrieves the active configuration, designed to be consumed by the 3D viewer.
   */
  const loadActive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await kitchenConfigurationApi.getActive();
      setActiveConfig(config);
      await loadAssemblyLine(config);
      return config;
    } catch (err) {
      setError(t(getKitchenConfigErrorKey(err)));
      setActiveConfig(null);
      setAssemblyLine(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [t, loadAssemblyLine]);

  return {
    activeConfig,
    assemblyLine,
    assemblyLineError,
    loading,
    error,
    loadActive,
  };
}
