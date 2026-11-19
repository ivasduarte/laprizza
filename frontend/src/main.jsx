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
import { themeStore } from './shared/theme/theme-store.js';
import { authApi } from './shared/auth/auth-api.js';

// Before the first render (index.html already applies it to avoid a flash).
themeStore.init();

// AA04: a logout/expiry in one tab ends the session in all of them.
connectSessionSync(sessionStore);
reloadOnPageRestore();
// AA04: cached responses never outlive the session that fetched them.
clearCacheWhenSessionEnds(sessionStore, queryClient);

// WEB03: the session and the Guest permissions are loaded once, before the first page.
authApi.restoreSession();
authApi.loadGuestPermissions();

// WEB03: role or account changes made on the backend show up when the user returns to the tab.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') authApi.reloadUser();
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
