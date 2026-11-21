/**
 * Decision of the route guard for a protected page (AA04/WEB03).
 *
 * The session status always comes from the store, which is fed by the back end
 * (login or refresh). Nothing readable from the browser storage can grant access.
 *
 * @param {'unknown'|'loading'|'authenticated'|'anonymous'} status
 * @param {{requiresAuth?: boolean, allowed?: boolean, requiresContactPhone?: boolean, phoneRequired?: boolean}}
 *   - requiresAuth: the page needs a session; allowed: the visitor has the page's permission;
 *   requiresContactPhone: customer page (AA02); phoneRequired: the session user has no phone yet.
 * @returns {'allow'|'login'|'denied'|'phone'|'wait'}
 */
export function resolveGuard(
  status,
  {
    requiresAuth = true,
    allowed = true,
    requiresContactPhone = false,
    phoneRequired = false,
  } = {}
) {
  if (status !== 'authenticated' && status !== 'anonymous') return 'wait';
  if (status === 'anonymous')
    return requiresAuth || !allowed ? 'login' : 'allow';
  // Checked before `allowed`: the back end withholds the customer permissions until then.
  if (requiresContactPhone && phoneRequired) return 'phone';
  return allowed ? 'allow' : 'denied';
}
