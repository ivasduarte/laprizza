import { useEffect, useState } from 'react';
import { checkBackendHealth } from '../../health.js';

export default function BackendStatus() {
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
  return <p role="status">{statusText}</p>;
}
