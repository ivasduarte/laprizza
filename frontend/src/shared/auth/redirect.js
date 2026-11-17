const hasControlCharacter = (value) =>
  [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });

/**
 * Path to return to after login. Only same-app absolute paths are accepted, so a
 * crafted `from` can never send the user to another site or back to the login page.
 *
 * @param {unknown} candidate
 * @param {string} [fallback='/']
 * @returns {string}
 */
export function safeRedirectPath(candidate, fallback = '/') {
  if (typeof candidate !== 'string') return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return fallback;
  if (candidate.includes('\\') || hasControlCharacter(candidate)) return fallback;
  if (/^\/login(?:[/?#]|$)/.test(candidate)) return fallback;
  return candidate;
}