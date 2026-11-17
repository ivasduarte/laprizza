import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './app.jsx';
import './shared/i18n/i18n.js';
import { sessionStore } from './shared/auth/session-store.js';
import { clearCacheWhenSessionEnds } from './shared/auth/session-cache.js';
import { queryClient } from './shared/api/query-client.js';
import {
  connectSessionSync,
  reloadOnPageRestore,
} from './shared/auth/session-sync.js';

// AA04: a logout/expiry in one tab ends the session in all of them.
connectSessionSync(sessionStore);
reloadOnPageRestore();
// AA04: cached responses never outlive the session that fetched them.
clearCacheWhenSessionEnds(sessionStore, queryClient);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
