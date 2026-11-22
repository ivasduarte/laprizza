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

/** Permissions of a customer account (catalogue, own data, shared folder): nothing else to do. */
const CUSTOMER_ONLY_PERMISSIONS = new Set([
  'catalogue:read',
  'customers:read:own',
  'customers:write:own',
  'resources:read',
]);

/**
 * Where to go after a login. A customer account that has no customer record yet goes to My data,
 * where it completes its data (and first its contact phone, AA02); accounts with other
 * responsibilities (staff, administration) are never redirected. Otherwise the requested page.
 *
 * @param {{customerId?: string|null, phoneRequired?: boolean, permissions?: string[]}|null} user
 * @param {string} [requested='/'] - Already checked with safeRedirectPath.
 * @returns {string}
 */
export function afterLoginPath(user, requested = '/') {
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const customerOnly = permissions.every((permission) => CUSTOMER_ONLY_PERMISSIONS.has(permission));
  const ownData = user?.phoneRequired || permissions.includes('customers:write:own');
  if (user && !user.customerId && ownData && customerOnly && requested === '/') return '/my-data';
  return requested;
}
