import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './app.jsx';
import './shared/i18n/i18n.js';
import { sessionStore } from './shared/auth/session-store.js';
import {
  connectSessionSync,
  reloadOnPageRestore,
} from './shared/auth/session-sync.js';

// AA04: a logout/expiry in one tab ends the session in all of them.
connectSessionSync(sessionStore);
reloadOnPageRestore();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error?.status >= 400 && error.status < 500) && failureCount < 2,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
