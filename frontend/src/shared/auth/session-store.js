import { createRefreshLock } from './refresh-lock.js';

/**
 * @param {{runExclusive?: (task: () => Promise<any>) => Promise<any>}} [options]
 *   runExclusive: runs a refresh while no other tab is refreshing (see refresh-lock.js).
 */
export function createSessionStore({ runExclusive = (task) => task() } = {}) {
  let state = { status: 'unknown', user: null, expired: false };
  let accessToken = null;
  let refreshInFlight = null;
  let reloadInFlight = null;
  const listeners = new Set();

  function setState(patch) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  function start({ accessToken: token, user }) {
    accessToken = token;
    setState({ status: 'authenticated', user, expired: false });
  }

  function end({ expired = false } = {}) {
    accessToken = null;
    setState({ status: 'anonymous', user: null, expired });
  }

  function updateUser(user) {
    if (state.status !== 'authenticated' || !user) return;
    setState({ user });
  }

  /**
   * Reloads the user of the current session, so role/status changes are shown without the need of a new login.
   * 
   * @param {*} fetchUser 
   * @returns 
   */
  function reloadUser(fetchUser) {
    if (state.status !== 'authenticated') return Promise.resolve(false);
    if (!reloadInFlight) {
      reloadInFlight = (async () => {
        try {
          updateUser(await fetchUser());
          return true;
        } catch {
          return false;
        } finally {
          reloadInFlight = null;
        }
      })();
    }
    return reloadInFlight;
  }

  function refresh(fetchSession) {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        try {
          await runExclusive(async () => start(await fetchSession()));
          return true;
        } catch {
          return false;
        } finally {
          refreshInFlight = null;
        }
      })();
    }
    return refreshInFlight;
  }

  return {
    getState: () => state,
    getAccessToken: () => accessToken,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    end,
    refresh,
    updateUser,
    reloadUser,
    beginCheck() {
      if (state.status !== 'unknown') return false;
      setState({ status: 'loading' });
      return true;
    },
  };
}

export const sessionStore = createSessionStore({
  runExclusive: createRefreshLock(),
});
