export const REFRESH_LOCK_NAME = 'laprizza-token-refresh';

/**
 * Serializes token refreshes across every tab of the browser (AA04).
 *
 * The back end rotates the refresh token on each use and treats a second use of a
 * rotated token as theft (it revokes the session). Two tabs refreshing at the same time
 * would trigger that. A Web Lock makes the second tab wait; it then reads the cookie
 * already rotated by the first one.
 *
 * Web Locks are only available in secure contexts (HTTPS / localhost). Without them the
 * tasks run unserialized (previous behaviour, still single-flight per tab).
 *
 * @param {{request?: Function}} [locks=globalThis.navigator?.locks]
 * @returns {(task: () => Promise<any>) => Promise<any>}
 */
export function createRefreshLock(locks = globalThis.navigator?.locks) {
  if (typeof locks?.request !== 'function') return (task) => task();
  return (task) => locks.request(REFRESH_LOCK_NAME, task);
}
