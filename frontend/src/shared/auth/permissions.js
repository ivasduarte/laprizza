export function effectivePermissions(sessionState, guestPermissions = []) {
  if (sessionState?.status === 'authenticated') {
    return sessionState.user?.permissions ?? [];
  }
  return guestPermissions;
}

export function can(permissions, required) {
  if (required == null) return true;
  return Array.isArray(permissions) && permissions.includes(required);
}
