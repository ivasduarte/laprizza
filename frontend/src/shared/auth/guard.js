/**
 * Decision of the route guard for a protected page (AA04/WEB03).
 *
 * The session status always comes from the store, which is fed by the back end
 * (login or refresh). Nothing readable from the browser storage can grant access.
 *
 * @param {'unknown'|'loading'|'authenticated'|'anonymous'} status
 * @param {{requiresAuth?: boolean, allowed?: boolean}} - requiresAuth: the page needs a session; allowed: the visitor has the page's permission.
 * @returns {'allow'|'login'|'denied'|'wait'}
 */
export function resolveGuard(
  status,
  { requiresAuth = true, allowed = true } = {}
) {
  if (status !== 'authenticated' && status !== 'anonymous') return 'wait';
  if (status === 'anonymous')
    return requiresAuth || !allowed ? 'login' : 'allow';
  return allowed ? 'allow' : 'denied';
}
