/**
 * Decision of the route guard for a protected page (AA04/WEB03).
 *
 * The session status always comes from the store, which is fed by the back end
 * (login or refresh). Nothing readable from the browser storage can grant access.
 *
 * @param {'unknown'|'loading'|'authenticated'|'anonymous'} status
 * @returns {'allow'|'login'|'wait'}
 */
export function resolveGuard(status) {
  if (status === 'authenticated') return 'allow';
  if (status === 'anonymous') return 'login';
  return 'wait';
}
