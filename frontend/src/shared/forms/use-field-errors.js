import { useCallback, useEffect, useState } from 'react';
import { toFieldMap } from './validators.js';

/**
 * Per-field error map (`{ [field]: { type, limit? } }`) fed by client validation and by the API.
 * When errors appear, focus moves to the first invalid input of the form.
 */
export function useFieldErrors(formRef) {
  const [errors, setErrors] = useState({});

  const fromApi = useCallback(
    (normalized) => setErrors(toFieldMap(normalized?.fieldErrors)),
    []
  );
  const clearField = useCallback(
    (field) =>
      setErrors((previous) => {
        if (!previous[field]) return previous;
        const { [field]: _removed, ...rest } = previous;
        return rest;
      }),
    []
  );
  const clear = useCallback(() => setErrors({}), []);

  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    formRef?.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [errors, formRef]);

  return { errors, setErrors, fromApi, clearField, clear };
}
