import { normalizeDetails, kindOf } from '../../../shared/api/error-normalizer.js';

export const SCENARIO_ID_PATTERN = /^[A-Z0-9-]{1,64}$/;
export const STOCK_MODES = ['scenario', 'live'];

/**
 * Client-side validation, same rules as the back end (Joi) so most input errors never leave
 * the browser. Returns a map field -> {type} in the format used by FieldError.
 */
export function validatePlanningInput({ scenarioId, stockMode }) {
  const errors = {};
  if (!scenarioId) errors.scenarioId = { type: 'any.required' };
  else if (!SCENARIO_ID_PATTERN.test(scenarioId))
    errors.scenarioId = { type: 'planning.scenarioIdPattern' };
  if (!STOCK_MODES.includes(stockMode)) errors.stockMode = { type: 'any.only' };
  return errors;
}

/**
 * @typedef {Object} PlanningFailure
 * @property {'invalidInput'|'missingInformation'|'unavailable'|'forbidden'|'unauthenticated'|'unknown'} state
 * @property {string|null} code
 * @property {Record<string, {type: string}>} fieldErrors
 * @property {Array<object>} problems - details.problems of a 422 (codes + ids, no free text)
 * @property {number|null} retryAfterSeconds
 */

/**
 * Maps an ApiError of the planning endpoints to one of the four outcomes required by AI05:
 * invalid input, missing information, service unavailability (success is the result itself).
 *
 * @returns {PlanningFailure}
 */
export function classifyPlanningError(error) {
  const status = error?.status ?? 0;
  const code = typeof error?.code === 'string' ? error.code : null;
  const base = {
    code,
    fieldErrors: {},
    problems: [],
    retryAfterSeconds: error?.retryAfterSeconds ?? null,
  };

  if (status === 422) {
    const problems = Array.isArray(error?.details?.problems) ? error.details.problems : [];
    return { ...base, state: 'missingInformation', problems };
  }
  if (status === 404 && code === 'AI_SCENARIO_NOT_FOUND') {
    return {
      ...base,
      state: 'invalidInput',
      fieldErrors: { scenarioId: { type: 'planning.scenarioNotFound' } },
    };
  }
  if (status === 400) {
    if (code === 'SCENARIO_WITHOUT_STOCK') {
      return {
        ...base,
        state: 'invalidInput',
        fieldErrors: { stockMode: { type: 'planning.scenarioWithoutStock' } },
      };
    }
    const { fieldErrors } = normalizeDetails(error?.details);
    const map = Object.fromEntries(fieldErrors.map(({ field, ...rest }) => [field, rest]));
    return { ...base, state: 'invalidInput', fieldErrors: map };
  }

  const kind = kindOf(error);
  if (status === 503 || status === 504 || kind === 'network' || kind === 'timeout') {
    return { ...base, state: 'unavailable' };
  }
  if (kind === 'forbidden') return { ...base, state: 'forbidden' };
  if (kind === 'unauthenticated') return { ...base, state: 'unauthenticated' };
  if (kind === 'server') return { ...base, state: 'unavailable' };
  return { ...base, state: 'unknown' };
}

/** Ids of a problem/warning shown next to its translated text (never the server message). */
export function problemSubjects(problem) {
  return ['productId', 'pizzaId', 'sizeId', 'componentId']
    .map((key) => problem?.[key])
    .filter((value) => typeof value === 'string' && value);
}
