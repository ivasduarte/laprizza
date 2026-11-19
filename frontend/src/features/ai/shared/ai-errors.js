/**
 * WEB07 validation errors. The back end sends two kinds of `details[].type`:
 * - Joi types with dots (`any.required`, `number.min`), already translated in `feedback.validation`;
 * - business rule codes without dots (`productUnknown`, `dateOutside`, ...), translated in
 *   `feedback.validation.ai_<code>`.
 * Joi paths use dots (`entries.0.date`) and the business rules use brackets (`entries[0].date`):
 * both become the dot form, which is also the key used by the inputs.
 */

/** `entries[0].date` -> `entries.0.date` */
export function toFieldPath(field) {
  return String(field ?? '').replace(/\[(\d+)\]/g, '.$1');
}

/** Business codes get the `ai.` prefix so `fieldMessage` finds `feedback.validation.ai_<code>`. */
export function toAiType(type) {
  return typeof type === 'string' && !type.includes('.') ? `ai.${type}` : type;
}

const fix = (violation) => ({
  ...violation,
  field: toFieldPath(violation.field),
  type: toAiType(violation.type),
});

/**
 * @param {import('../../../shared/api/error-normalizer.js').NormalizedError|null} normalized
 * @returns {{fieldErrors: Array<object>, formErrors: Array<object>}}
 */
export function aiViolations(normalized) {
  return {
    fieldErrors: (normalized?.fieldErrors ?? []).map(fix),
    formErrors: (normalized?.formErrors ?? []).map(fix),
  };
}

/** First violation per field, in the `{ [field]: { type, limit? } }` shape of FieldError. */
export function toErrorMap(violations = []) {
  const map = {};
  for (const { field, type, limit } of violations) {
    if (!(field in map))
      map[field] = limit === undefined ? { type } : { type, limit };
  }
  return map;
}

/**
 * Inline state of a failed request. Validation errors are shown per field; everything else is a
 * single message (unavailable, forbidden, not found, conflict...).
 */
export function describeFailure(normalized) {
  if (!normalized) return null;
  if (normalized.kind === 'validation') {
    const { fieldErrors, formErrors } = aiViolations(normalized);
    return { kind: 'validation', fieldErrors, formErrors };
  }
  return {
    kind: normalized.kind,
    retryAfterSeconds: normalized.retryAfterSeconds,
    outcomeUnknown: normalized.outcomeUnknown,
  };
}
