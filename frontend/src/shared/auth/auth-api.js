import { api, fetchRefreshedSession } from '../api/index.js';
import { sessionStore } from './session-store.js';

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
