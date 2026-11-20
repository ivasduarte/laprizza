/**
 * Expected access per route (AA05), written by hand from Table 1 — never derived from
 * domain/auth/permissions.domain.js, so a wrong permission on a route makes the tests fail.
 *
 * Each row: [method, route pattern relative to the API version prefix, who may use it].
 * "Who" lists base roles (GUEST = no session) or AUTHENTICATED (any user with a session).
 * Multi-role and no-role personas are checked with the rules: union of the roles, and every
 * authenticated user also has the Guest permissions.
 *
 * Adding a role (e.g. ADMINISTRATOR) = adding it to the rows it may use.
 */
export const GUEST = 'GUEST';
export const CUSTOMER = 'CUSTOMER';
export const EMPLOYEE = 'EMPLOYEE';
export const MANAGER = 'MANAGER';
export const AUTHENTICATED = 'AUTHENTICATED';

const PUBLIC = [GUEST, CUSTOMER, EMPLOYEE, MANAGER];
const STAFF = [EMPLOYEE, MANAGER];
const MANAGER_ONLY = [MANAGER];

export const AUTHORIZATION_MATRIX = Object.freeze([
  // Session (any authenticated user, whatever the roles)
  ['GET', '/auth/me', AUTHENTICATED],
  ['POST', '/auth/logout', AUTHENTICATED],
  ['POST', '/auth/logout-all', AUTHENTICATED],
  ['POST', '/auth/password/change', AUTHENTICATED],

  // Public catalogue, with the allergens of each product (Table 1: Guest)
  ['GET', '/catalogue', PUBLIC],
  ['GET', '/catalogue/:id', PUBLIC],
  // Allergen management: MANAGER only (Table 1: "Manage ... allergens")
  ['GET', '/allergens', MANAGER_ONLY],
  ['GET', '/allergens/:id', MANAGER_ONLY],
  ['GET', '/allergens/name/:name', MANAGER_ONLY],
  ['POST', '/allergens', MANAGER_ONLY],
  ['PUT', '/allergens/:id', MANAGER_ONLY],

  // Products and pizza configuration: staff consult, manager manages
  ['GET', '/products', STAFF],
  ['GET', '/products/:id', STAFF],
  ['POST', '/products', MANAGER_ONLY],
  ['PATCH', '/products/:id', MANAGER_ONLY],
  ['GET', '/products/:productId/size-configurations', STAFF],
  ['GET', '/products/:productId/size-configurations/:sizeId', STAFF],
  ['POST', '/products/:productId/size-configurations', MANAGER_ONLY],
  ['PUT', '/products/:productId/size-configurations/:sizeId', MANAGER_ONLY],
  ['DELETE', '/products/:productId/size-configurations/:sizeId', MANAGER_ONLY],
  ['GET', '/product-categories', STAFF],
  ['GET', '/product-categories/:id', STAFF],
  ['POST', '/product-categories', MANAGER_ONLY],
  ['PUT', '/product-categories/:id', MANAGER_ONLY],
  ['DELETE', '/product-categories/:id', MANAGER_ONLY],
  ['GET', '/pizza-size', STAFF],
  ['GET', '/pizza-size/:id', STAFF],
  ['POST', '/pizza-size', MANAGER_ONLY],
  ['PATCH', '/pizza-size/:id', MANAGER_ONLY],
  ['GET', '/pizza-component-type', STAFF],
  ['GET', '/pizza-component-type/:id', STAFF],
  ['POST', '/pizza-component-type', MANAGER_ONLY],
  ['PUT', '/pizza-component-type/:id', MANAGER_ONLY],
  ['DELETE', '/pizza-component-type/:id', MANAGER_ONLY],
  ['GET', '/predefined-pizzas', STAFF],
  ['GET', '/predefined-pizzas/:id', STAFF],
  ['GET', '/predefined-pizzas/name/:name', STAFF],
  ['POST', '/predefined-pizzas', MANAGER_ONLY],
  ['PUT', '/predefined-pizzas/:id', MANAGER_ONLY],

  // Stock: staff read, changes require the manager role
  ['GET', '/stock', STAFF],
  ['GET', '/stock/:productId', STAFF],
  ['PATCH', '/stock/:productId', MANAGER_ONLY],

  // Customers: the manager manages them; a customer only reads their own record
  ['GET', '/customers', MANAGER_ONLY],
  ['GET', '/customers/:id', MANAGER_ONLY],
  ['POST', '/customers', MANAGER_ONLY],
  ['PATCH', '/customers/:id', MANAGER_ONLY],
  ['GET', '/customers/me', [CUSTOMER]],

  // Kitchen viewer and configurations: MANAGER only (team decision: the employee lost kitchen:read)
  ['GET', '/kitchen-configurations', MANAGER_ONLY],
  ['GET', '/kitchen-configurations/active', MANAGER_ONLY],
  ['GET', '/kitchen-configurations/:id', MANAGER_ONLY],
  ['POST', '/kitchen-configurations', MANAGER_ONLY],
  ['POST', '/kitchen-configurations/validate', MANAGER_ONLY],
  ['PATCH', '/kitchen-configurations/:id', MANAGER_ONLY],
  ['DELETE', '/kitchen-configurations/:id', MANAGER_ONLY],
  ['PATCH', '/kitchen-configurations/:id/activate', MANAGER_ONLY],
  ['GET', '/assembly-line-configurations', MANAGER_ONLY],
  ['GET', '/assembly-line-configurations/:id', MANAGER_ONLY],
  ['POST', '/assembly-line-configurations', MANAGER_ONLY],
  ['POST', '/assembly-line-configurations/validate', MANAGER_ONLY],
  ['PATCH', '/assembly-line-configurations/:id', MANAGER_ONLY],
  ['DELETE', '/assembly-line-configurations/:id', MANAGER_ONLY],

  // Planning: forecasts, supplier scenarios and BOM/Requirements Planning data
  ['GET', '/forecasts', MANAGER_ONLY],
  ['GET', '/forecasts/:id', MANAGER_ONLY],
  ['POST', '/forecasts', MANAGER_ONLY],
  ['PUT', '/forecasts/:id', MANAGER_ONLY],
  ['POST', '/planning/bom', MANAGER_ONLY],
  ['POST', '/planning/requirements', MANAGER_ONLY],
  ['GET', '/planning/runs', MANAGER_ONLY],
  ['GET', '/planning/runs/:id', MANAGER_ONLY],
  ['GET', '/supplier-scenarios', MANAGER_ONLY],
  ['GET', '/supplier-scenarios/:id', MANAGER_ONLY],
  ['POST', '/supplier-scenarios', MANAGER_ONLY],
  ['POST', '/supplier-scenarios/validate', MANAGER_ONLY],
  ['PUT', '/supplier-scenarios/:id', MANAGER_ONLY],
  ['GET', '/ai-data/snapshot', MANAGER_ONLY],
  ['GET', '/ai-data/products/export', MANAGER_ONLY],

  // Internal shared documents: staff read, manager manages
  // Shared documents: customers, staff and managers read (team decision); only the manager manages
  ['GET', '/shared-resources', [CUSTOMER, EMPLOYEE, MANAGER]],
  ['GET', '/shared-resources/:name', [CUSTOMER, EMPLOYEE, MANAGER]],
  ['PUT', '/shared-resources/:name', MANAGER_ONLY],
  ['DELETE', '/shared-resources/:name', MANAGER_ONLY],

  // User administration (provisionally the manager's; moves to ADMINISTRATOR later)
  ['GET', '/users', MANAGER_ONLY],
  ['GET', '/users/:id', MANAGER_ONLY],
  ['POST', '/users', MANAGER_ONLY],
  ['PATCH', '/users/:id', MANAGER_ONLY],
  ['PUT', '/users/:id/roles/:role', MANAGER_ONLY],
  ['DELETE', '/users/:id/roles/:role', MANAGER_ONLY],
]);

/**
 * Unguarded routes on purpose: system probes and the authentication entry points (Table 1:
 * "access the local and external authentication entry points").
 */
export const PUBLIC_ENTRY_POINTS = Object.freeze([
  ['GET', '/health'],
  ['GET', '/version'],
  ['GET', '/openapi.json'],
  ['GET', '/auth/guest-permissions'],
  ['POST', '/auth/login'],
  ['POST', '/auth/refresh'],
  ['POST', '/auth/password/forgot'],
  ['POST', '/auth/password/reset'],
]);

/** Sample values for route parameters (well-formed ids that do not exist). */
const SAMPLE_PARAMS = { role: 'EMPLOYEE', name: 'manual.txt' };
const SAMPLE_ID = 'abcdef0000000000000000aa';

/** Concrete path for a route pattern, e.g. "/customers/:id" -> "/customers/abcdef...". */
export function samplePath(pattern) {
  return pattern.replace(/:([A-Za-z]+)/g, (_match, param) => SAMPLE_PARAMS[param] ?? SAMPLE_ID);
}

/**
 * Whether a persona (its roles; null for Guest) may use a route with the given access rule.
 * Union of the roles; every authenticated user also has the Guest permissions.
 */
export function isAllowed(access, roles) {
  if (roles === null) return access !== AUTHENTICATED && access.includes(GUEST);
  if (access === AUTHENTICATED) return true;
  return access.includes(GUEST) || roles.some((role) => access.includes(role));
}
