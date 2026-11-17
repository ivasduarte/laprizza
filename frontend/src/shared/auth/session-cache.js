/**
 * Drops every cached server response when the authenticated session ends or changes
 * user (AA04). Without this, data fetched by a manager would stay in memory after
 * logout and could be shown again by a page that is revisited (back button).
 *
 * @param {ReturnType<import('./session-store.js').createSessionStore>} store
 * @param {{cancelQueries: () => any, clear: () => void}} queryClient
 * @returns {() => void} Unsubscribe.
 */
export function clearCacheWhenSessionEnds(store, queryClient) {
  let previous = {
    status: store.getState().status,
    userId: store.getState().user?.id,
  };

  return store.subscribe(() => {
    const { status, user } = store.getState();
    const current = { status, userId: user?.id };
    const hadSession = previous.status === 'authenticated';
    const ended = hadSession && current.status !== 'authenticated';
    const changedUser =
      hadSession &&
      current.status === 'authenticated' &&
      current.userId !== previous.userId;
    previous = current;

    if (ended || changedUser) {
      queryClient.cancelQueries();
      queryClient.clear();
    }
  });
}
