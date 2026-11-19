import { api, fetchRefreshedSession } from '../api/index.js';
import { sessionStore } from './session-store.js';
import { getApiBaseUrl } from '../../health.js';
import { externalLoginUrl } from './external-auth.js';

export const authApi = {
  async restoreSession() {
    if (!sessionStore.beginCheck()) return;
    const restored = await sessionStore.refresh(fetchRefreshedSession);
    if (!restored) sessionStore.end();
  },

  async login(email, password) {
    const session = await api.post(
      '/auth/login',
      { email, password },
      { auth: false, credentials: 'include' }
    );
    sessionStore.start(session);
  },

  /** AA02: providers enabled in the back end (empty list = no external login). */
  externalProviders(signal) {
    return api.get('/auth/external/providers', {
      auth: false,
      feedback: 'silent',
      signal,
    });
  },

  /** AA02: full-page navigation; the back end redirects to the identity provider. */
  startExternalLogin(provider) {
    window.location.assign(externalLoginUrl(getApiBaseUrl(), provider));
  },

  async logout() {
    try {
      await api.post('/auth/logout', undefined, { credentials: 'include' });
    } finally {
      sessionStore.end();
    }
  },

  async logoutAll() {
    try {
      await api.post('/auth/logout-all', undefined, { credentials: 'include' });
    } finally {
      sessionStore.end();
    }
  },

  forgotPassword(email) {
    return api.post('/auth/password/forgot', { email }, { auth: false });
  },

  resetPassword(token, newPassword) {
    return api.post(
      '/auth/password/reset',
      { token, newPassword },
      { auth: false, credentials: 'include' }
    );
  },

  changePassword(currentPassword, newPassword) {
    return api.post('/auth/password/change', { currentPassword, newPassword });
  },
};
