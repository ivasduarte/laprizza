import { api } from '../../shared/api/index.js';

const userPath = (id) => `/users/${encodeURIComponent(id)}`;
const rolePath = (id, role) =>
  `${userPath(id)}/roles/${encodeURIComponent(role)}`;

// AA06 user administration. The page shows every failure inline, so no global toast on top.
export const usersApi = {
  list(signal) {
    return api.get('/users', { signal, feedback: 'silent' });
  },
  async assignableRoles(signal) {
    const body = await api.get('/users/assignable-roles', {
      signal,
      feedback: 'silent',
    });
    return Array.isArray(body?.roles) ? body.roles : [];
  },
  /** Creates an inactive account; the back end sends the activation invitation. */
  create({ email, username, roles }) {
    const body = { email, roles };
    if (username) body.username = username;
    return api.post('/users', body, { feedback: 'silent' });
  },
  setActive(id, isActive) {
    return api.patch(userPath(id), { isActive }, { feedback: 'silent' });
  },
  addRole(id, role) {
    return api.put(rolePath(id, role), undefined, { feedback: 'silent' });
  },
  removeRole(id, role) {
    return api.delete(rolePath(id, role), { feedback: 'silent' });
  },
  roleHistory(id, signal) {
    return api.get(`${userPath(id)}/role-history`, {
      signal,
      feedback: 'silent',
    });
  },
  reissueInvitation(id) {
    return api.post(`${userPath(id)}/invitation`, undefined, {
      feedback: 'silent',
    });
  },
};
