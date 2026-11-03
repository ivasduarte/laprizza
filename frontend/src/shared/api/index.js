import { getApiBaseUrl } from '../../health.js';
import { createHttpClient } from './http-client.js';
import { sessionStore } from '../auth/session-store.js';

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
});
