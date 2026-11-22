import { Roles } from '../users/users.domain.js';

export const Permission = Object.freeze({
  CATALOGUE_READ: 'catalogue:read',
  CUSTOMERS_READ_OWN: 'customers:read:own',
  CUSTOMERS_WRITE_OWN: 'customers:write:own',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  CATEGORIES_WRITE: 'categories:write',
  ALLERGENS_READ: 'allergens:read',
  ALLERGENS_WRITE: 'allergens:write',
  PIZZAS_WRITE: 'pizzas:write',
  STOCK_READ: 'stock:read',
  STOCK_READ_INACTIVE: 'stock:read:inactive',
  STOCK_WRITE: 'stock:write',
  KITCHEN_READ: 'kitchen:read',
  KITCHEN_WRITE: 'kitchen:write',
  FORECASTS_READ: 'forecasts:read',
  FORECASTS_WRITE: 'forecasts:write',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_IMPORT: 'suppliers:import',
  PLANNING_EXECUTE: 'planning:execute',
  RESOURCES_READ: 'resources:read',
  RESOURCES_WRITE: 'resources:write',
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_MANAGE: 'users:manage',
  USERS_INVITE: 'users:invite',
  ROLES_ASSIGN_CUSTOMER: 'roles:assign:customer',
  ROLES_ASSIGN_EMPLOYEE: 'roles:assign:employee',
  ROLES_ASSIGN_MANAGER: 'roles:assign:manager',
  ROLES_ASSIGN_ADMINISTRATOR: 'roles:assign:administrator',
});

export const ALL_PERMISSIONS = Object.freeze(Object.values(Permission));
const P = Permission;

export const GUEST_PERMISSIONS = Object.freeze([P.CATALOGUE_READ]);

/**
 * Website user administration (Table 1, Administrator): accounts, activation invitations and
 * roles. Only the ADMINISTRATOR role holds them (AA06); restaurant management needs MANAGER.
 */
export const ADMIN_PERMISSIONS = Object.freeze([
  P.USERS_READ,
  P.USERS_CREATE,
  P.USERS_MANAGE,
  P.USERS_INVITE,
  P.ROLES_ASSIGN_CUSTOMER,
  P.ROLES_ASSIGN_EMPLOYEE,
  P.ROLES_ASSIGN_MANAGER,
  P.ROLES_ASSIGN_ADMINISTRATOR,
]);

export const ROLE_PERMISSIONS = Object.freeze({
  // The own customer record: read it, and create it once when the account has none.
  [Roles.CUSTOMER]: Object.freeze([P.CUSTOMERS_READ_OWN, P.CUSTOMERS_WRITE_OWN, P.RESOURCES_READ]),

  // Table 1 (Restaurant Staff): catalogue, products and the kitchen viewer, read-only.
  [Roles.EMPLOYEE]: Object.freeze([
    P.PRODUCTS_READ,
    P.STOCK_READ,
    P.KITCHEN_READ,
    P.RESOURCES_READ,
  ]),

  [Roles.MANAGER]: Object.freeze([
    P.CUSTOMERS_READ,
    P.CUSTOMERS_WRITE,
    P.PRODUCTS_READ,
    P.PRODUCTS_WRITE,
    P.CATEGORIES_WRITE,
    P.ALLERGENS_READ,
    P.ALLERGENS_WRITE,
    P.PIZZAS_WRITE,
    P.STOCK_READ,
    P.STOCK_READ_INACTIVE,
    P.STOCK_WRITE,
    P.KITCHEN_READ,
    P.KITCHEN_WRITE,
    P.FORECASTS_READ,
    P.FORECASTS_WRITE,
    P.SUPPLIERS_READ,
    P.SUPPLIERS_IMPORT,
    P.PLANNING_EXECUTE,
    P.RESOURCES_READ,
  ]),

  // SYS04: every authenticated role reads the shared folder; only administrators write to it.
  [Roles.ADMINISTRATOR]: Object.freeze([...ADMIN_PERMISSIONS, P.RESOURCES_READ, P.RESOURCES_WRITE]),
});

/**
 * AA02: customer features withheld while the account has no contact phone. Add here every new
 * permission that only a Customer uses (e.g. placing orders).
 */
export const CUSTOMER_CONTACT_PERMISSIONS = Object.freeze([P.CUSTOMERS_READ_OWN, P.CUSTOMERS_WRITE_OWN]);

/**
 * @param {string[]} [roles=[]]
 * @param {{contactPhoneMissing?: boolean}} [options] - true withholds CUSTOMER_CONTACT_PERMISSIONS.
 * @returns {string[]}
 */
export function permissionsFor(roles = [], { contactPhoneMissing = false } = {}) {
  const granted = new Set(GUEST_PERMISSIONS);
  for (const role of Array.isArray(roles) ? roles : []) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) granted.add(permission);
  }
  if (contactPhoneMissing) CUSTOMER_CONTACT_PERMISSIONS.forEach((p) => granted.delete(p));
  return [...granted].sort(); // .sort() serve para obter um /auth/me estável.
}

export function hasPermission(permissions, required) {
  return Array.isArray(permissions) && permissions.includes(required);
}

export function roleAssignmentPermission(role) {
  return `roles:assign:${String(role).toLowerCase()}`;
}

export const RoleChangeDenial = Object.freeze({
  SELF_ROLE_CHANGE: 'SELF_ROLE_CHANGE',
  ROLE_NOT_ASSIGNABLE: 'ROLE_NOT_ASSIGNABLE',
});

export function evaluateRoleChange({
  actorPermissions,
  isSelf,
  currentRoles = [],
  nextRoles = [],
}) {
  const current = new Set(currentRoles);
  const next = new Set(nextRoles);

  const changed = [
    ...[...next].filter((role) => !current.has(role)),
    ...[...current].filter((role) => !next.has(role)),
  ];

  if (changed.length === 0) return { allowed: true };
  if (isSelf) return { allowed: false, reason: RoleChangeDenial.SELF_ROLE_CHANGE, roles: changed };

  const denied = changed.filter(
    (role) => !hasPermission(actorPermissions, roleAssignmentPermission(role)),
  );

  return denied.length === 0
    ? { allowed: true }
    : { allowed: false, reason: RoleChangeDenial.ROLE_NOT_ASSIGNABLE, roles: denied };
}

/**
 * Base roles an actor may assign or remove (AA06), from its assignment permissions.
 *
 * @param {string[]} actorPermissions
 * @returns {string[]}
 */
export function assignableRoles(actorPermissions) {
  return Object.values(Roles).filter((role) =>
    hasPermission(actorPermissions, roleAssignmentPermission(role)),
  );
}
