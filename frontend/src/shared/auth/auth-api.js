import {
  api,
  fetchCurrentUser,
  fetchGuestPermissions,
  fetchRefreshedSession,
} from '../api/index.js';
import { guestPermissionStore } from './guest-permissions.js';
import { sessionStore } from './session-store.js';
import { getApiBaseUrl } from '../../health.js';
import { externalLoginUrl } from './external-auth.js';
import { externalActivationForm, submitForm } from './account-activation.js';

export const authApi = {
  async restoreSession() {
    if (!sessionStore.beginCheck()) return;
    const restored = await sessionStore.refresh(fetchRefreshedSession);
    if (!restored) sessionStore.end();
  },

  async loadGuestPermissions() {
    try {
      guestPermissionStore.set(await fetchGuestPermissions());
    } catch {
      guestPermissionStore.set([]);
    }
  },

  reloadUser() {
    return sessionStore.reloadUser(fetchCurrentUser);
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

  /** AA07: checks the activation link; nothing is used. Errors are shown by the page. */
  inspectActivation(token, signal) {
    return api.post(
      '/auth/activation/inspect',
      { token },
      { auth: false, feedback: 'silent', signal }
    );
  },

  /** AA07: local activation. No session is opened: the user logs in afterwards. */
  activateLocal(token, newPassword) {
    return api.post(
      '/auth/activation/local',
      { token, newPassword },
      { auth: false }
    );
  },

  /** AA07: full-page form POST; the back end redirects to the account's identity provider. */
  startExternalActivation(token) {
    submitForm(externalActivationForm(getApiBaseUrl(), token));
  },

  /** AA02: contact phone asked after the first external login; refreshes the session user. */
  async setContactPhone(phoneNumber) {
    const user = await api.put('/auth/me/phone', { phoneNumber });
    sessionStore.updateUser(user);
    return user;
  },

  changePassword(currentPassword, newPassword) {
    return api.post('/auth/password/change', { currentPassword, newPassword });
  },
};
