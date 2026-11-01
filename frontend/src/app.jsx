import { useEffect, useState } from 'react';
import { checkBackendHealth } from './health.js';

export default function App() {
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
    <main>
      <h1>Application Shell</h1>
      <p>{statusText}</p>
    </main>
  );
}