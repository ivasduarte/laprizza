import { useEffect, useState } from 'react';
import { checkBackendHealth } from '../../health.js';
import { useTranslation } from 'react-i18next';

export default function BackendStatus() {
  const { t } = useTranslation();
  const [state, setState] = useState('checking');

  useEffect(() => {
    let isMounted = true;
    checkBackendHealth().then((isOk) => {
      if (isMounted) {
        setState(isOk ? 'ok' : 'unreachable');
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <p role="status" className={`backend-status backend-status-${state}`}>
      <span className="backend-dot" aria-hidden="true" />
      {t(`backend.${state}`)}
    </p>
  );
}