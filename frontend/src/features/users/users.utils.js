const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9]{3,30}$/;

/** Message key of an error answered by the users API (status and error code of the back end). */
export function getUsersErrorKey(error) {
  switch (error?.status) {
    case 0:
      return 'users.err.network';
    case 400:
      return 'users.err.invalid';
    case 401:
      return 'users.err.session';
    case 403:
      if (error.code === 'SELF_ROLE_CHANGE') return 'users.err.self';
      if (error.code === 'ROLE_NOT_ASSIGNABLE')
        return 'users.err.notAssignable';
      return 'users.err.forbidden';
    case 404:
      return 'users.err.notFound';
    case 409:
      switch (error.code) {
        case 'ACTIVATION_REQUIRED':
          return 'users.err.activationRequired';
        case 'ACCOUNT_ALREADY_ACTIVATED':
          return 'users.err.alreadyActivated';
        case 'ACCOUNT_DISABLED':
          return 'users.err.disabled';
        case 'EMAIL_MISSING':
          return 'users.err.emailMissing';
        default:
          return 'users.err.duplicate';
      }
    case 503:
      return 'users.err.unavailable';
    default:
      return 'users.err.generic';
  }
}

/** Client-side check of the creation form (the back end validates again). */
export function validateNewUser({ email, username }) {
  const errors = {};
  if (!EMAIL_PATTERN.test(String(email ?? '').trim()))
    errors.email = 'users.err.email';
  const name = String(username ?? '').trim();
  if (name && !USERNAME_PATTERN.test(name))
    errors.username = 'users.err.username';
  return errors;
}

/** Message key of the account state shown in the list. */
export function statusKey(user) {
  if (user?.pendingActivation) return 'users.status.pending';
  if (user?.status === 'active') return 'users.status.active';
  if (user?.status === 'disabled') return 'users.status.disabled';
  return 'users.status.inactive';
}

/** Roles of the user that the actor may still add, in the order given by the back end. */
export function rolesToAdd(user, assignable) {
  const current = new Set(user?.roles ?? []);
  return (assignable ?? []).filter((role) => !current.has(role));
}

/** Translation of a role name; unknown roles are shown as sent by the back end. */
export function roleLabel(t, role) {
  return t(`users.roleNames.${role}`, { defaultValue: role });
}
