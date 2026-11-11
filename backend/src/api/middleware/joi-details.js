/**
 * @typedef {Object} ValidationDetail
 * @property {string} field - Dot-separated path of the invalid input (e.g. `name`, `address.postalCode`,
 *   `dietaryRestrictions.0`). Empty string when the error concerns the payload as a whole.
 * @property {string} type - Stable Joi error type (e.g. `any.required`, `string.empty`, `string.min`).
 *   Clients translate by `type`, never by `message`.
 * @property {string} message - Technical English message (diagnostics only, not meant for end users).
 * @property {number} [limit] - Numeric limit that was violated (min/max/length rules), when applicable.
 */

/**
 * Removes the submitted value from a Joi message.
 * @param {import('joi').ValidationErrorItem} detail
 * @returns {string}
 */
function safeMessage(detail) {
  const value = detail.context?.value;
  let message = detail.message.replace(/ with value ".*?" fails to match/s, ' fails to match');
  if (typeof value === 'string' && value.length >= 4 && message.includes(value)) {
    message = message.split(value).join('[redacted]');
  }
  return message;
}

/**
 * Converts a Joi `ValidationError` into the structured `details` of the API error contract.
 * Never copies the submitted value: `context.value` is dropped and Joi messages that embed it
 * (e.g. `string.pattern.base`: `"x" with value "..." fails to match`) are redacted.
 *
 * @param {import('joi').ValidationError} error
 * @returns {ValidationDetail[]}
 */
export function joiDetails(error) {
  return error.details.map((detail) => {
    const entry = {
      field: detail.path.join('.'),
      type: detail.type,
      message: safeMessage(detail),
    };
    const limit = detail.context?.limit;
    if (typeof limit === 'number' && Number.isFinite(limit)) entry.limit = limit;
    return entry;
  });
}
