/**
 * Escapes RegExp special characters so user input is matched literally.
 *
 * @param {string} text - Raw user input.
 * @returns {string} The input safe to be used inside a RegExp.
 */
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}