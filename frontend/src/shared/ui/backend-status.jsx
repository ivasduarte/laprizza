import { useEffect, useState } from 'react';
import { checkBackendHealth } from '../../health.js';
import { useTranslation } from 'react-i18next';

export default function BackendStatus() {
  const { t } = useTranslation();
  const [statusText, setStatusText] = useState('Checking...');
  useEffect(() => {
    let isMounted = true;
    checkBackendHealth().then((isOk) => {
      if (isMounted) {
        setStatusText(isOk ? 'Backend: OK' : 'Backend: unreachable');
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);
  return (
    <p role="status">
      {t(`backend.${statusText.includes('OK') ? 'ok' : 'unreachable'}`)}
    </p>
  );
}
