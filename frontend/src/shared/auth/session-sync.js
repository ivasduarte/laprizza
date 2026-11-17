export const SESSION_CHANNEL = 'laprizza-session';
const SESSION_ENDED = 'SESSION_ENDED';

const defaultCreateChannel = (name) =>
  typeof globalThis.BroadcastChannel === 'function'
    ? new globalThis.BroadcastChannel(name)
    : null;

/**
 * Propagates the end of the session (logout, expiry, revocation) to the other tabs
 * (AA04). All tabs share the same refresh cookie, so when one ends the session the
 * others must drop their in-memory access token and user immediately.
 *
 * Only the event is sent, never tokens or user data.
 *
 * @param {ReturnType<import('./session-store.js').createSessionStore>} store
 * @param {{createChannel?: (name: string) => any}} [options]
 * @returns {() => void} Disconnects the synchronization.
 */
export function connectSessionSync(
  store,
  { createChannel = defaultCreateChannel } = {}
) {
  const channel = createChannel(SESSION_CHANNEL);
  if (!channel) return () => {};

  let previous = store.getState().status;
  let applyingRemote = false;

  channel.onmessage = ({ data }) => {
    if (data?.type !== SESSION_ENDED) return;
    if (store.getState().status !== 'authenticated') return;
    applyingRemote = true;
    try {
      store.end();
    } finally {
      applyingRemote = false;
    }
  };

  const unsubscribe = store.subscribe(() => {
    const { status } = store.getState();
    const wasAuthenticated = previous === 'authenticated';
    previous = status;
    if (wasAuthenticated && status === 'anonymous' && !applyingRemote) {
      channel.postMessage({ type: SESSION_ENDED });
    }
  });

  return () => {
    unsubscribe();
    channel.close();
  };
}

/**
 * Reloads the app when the browser restores it from the back/forward cache.
 * That restores the whole JavaScript memory (including a stale user and token), so after
 * a logout the back button could show protected data. The reload re-validates the
 * session through the refresh cookie.
 *
 * @param {Window} [win=globalThis.window]
 * @returns {() => void} Removes the listener.
 */
export function reloadOnPageRestore(win = globalThis.window) {
  if (typeof win?.addEventListener !== 'function') return () => {};
  const onPageShow = (event) => {
    if (event.persisted) win.location.reload();
  };
  win.addEventListener('pageshow', onPageShow);
  return () => win.removeEventListener('pageshow', onPageShow);
}
