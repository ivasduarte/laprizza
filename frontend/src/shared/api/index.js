import { getApiBaseUrl } from '../../health.js';
import { createHttpClient } from './http-client.js';
import { sessionStore } from '../auth/session-store.js';
import { feedbackStore } from '../feedback/feedback-store.js';
import { createErrorReporter } from '../feedback/error-reporter.js';
import { getHttpTimeouts } from './timeouts.js';

const reportError = createErrorReporter({ store: feedbackStore });

/** Asks the back end for a new access token using the httpOnly refresh cookie. */
export function fetchRefreshedSession() {
  return api.post('/auth/refresh', undefined, {
    auth: false,
    credentials: 'include',
  });
}

export const api = createHttpClient({
  baseUrl: getApiBaseUrl(),
  getToken: () => sessionStore.getAccessToken(),
  refreshAccessToken: () => sessionStore.refresh(fetchRefreshedSession),
  onSessionExpired: () => sessionStore.end({ expired: true }),
  ...getHttpTimeouts(),
  // Single gateway (WEB04): every request feeds the loading indicator and the global error toasts.
  onRequestStart: () => feedbackStore.beginRequest(),
  onRequestEnd: () => feedbackStore.endRequest(),
  onError: reportError,
});
