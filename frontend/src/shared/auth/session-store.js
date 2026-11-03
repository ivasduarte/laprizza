export function createSessionStore() {
  let state = { status: 'unknown', user: null, expired: false };
  let accessToken = null;
  let refreshInFlight = null;
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

  function refresh(fetchSession) {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        try {
          start(await fetchSession());
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
    beginCheck() {
      if (state.status !== 'unknown') return false;
      setState({ status: 'loading' });
      return true;
    },
  };
}

export const sessionStore = createSessionStore();