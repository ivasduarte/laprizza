import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

const MODES = ['new', 'edit'];

export function useEntityParams() {
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const id = params.get('id') || null;
  const rawMode = params.get('mode');

  const mode =
    MODES.includes(rawMode) && (rawMode === 'new' || id) ? rawMode : null;

  const update = useCallback(
    (patch, { replace = false } = {}) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === '') {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          return next;
        },
        { replace }
      ),
    [setParams]
  );

  const actions = useMemo(
    () => ({
      /** New search: closes the detail and the form. */
      search: (term) =>
        update({ q: String(term ?? '').trim(), id: null, mode: null }),
      /** Opens the detail of a record. */
      view: (recordId) => update({ id: recordId, mode: null }),
      /** Opens the empty form. */
      create: () => update({ id: null, mode: 'new' }),
      /** Opens the form filled with a record. */
      edit: (recordId) => update({ id: recordId, mode: 'edit' }),
      /** Closes the form: back to the detail when editing, to the list when creating. */
      closeForm: () => update({ mode: null }),
      /** Closes the detail and the form (back to the list, keeping the search). */
      close: () => update({ id: null, mode: null }),
      /** Same as `close`, without a history entry (e.g. the record became unavailable). */
      reset: () => update({ id: null, mode: null }, { replace: true }),
    }),
    [update]
  );

  return { q, id, mode, ...actions };
}
