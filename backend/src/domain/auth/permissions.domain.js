import { Roles } from '../users/users.domain.js';

export const Permission = Object.freeze({
  CATALOGUE_READ: 'catalogue:read',
  CUSTOMERS_READ_OWN: 'customers:read:own',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  CATEGORIES_WRITE: 'categories:write',
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
  ROLES_ASSIGN_CUSTOMER: 'roles:assign:customer',
  ROLES_ASSIGN_EMPLOYEE: 'roles:assign:employee',
  ROLES_ASSIGN_MANAGER: 'roles:assign:manager',
  // ROLES_ASSIGN_ADMINISTRATOR: 'roles:assign:administrator', // will exist, granted to nobody
});

export const ALL_PERMISSIONS = Object.freeze(Object.values(Permission));
const P = Permission;

export const GUEST_PERMISSIONS = Object.freeze([P.CATALOGUE_READ]);

// These permissions will be given to Manager temporarily.
export const ADMIN_PERMISSIONS = Object.freeze([
  P.USERS_MANAGE,
  P.ROLES_ASSIGN_CUSTOMER,
  P.ROLES_ASSIGN_MANAGER,
]);

export const ROLE_PERMISSIONS = Object.freeze({
  [Roles.CUSTOMER]: Object.freeze([P.CUSTOMERS_READ_OWN]),

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
    P.RESOURCES_WRITE,
    P.USERS_READ,
    P.USERS_CREATE,
    P.ROLES_ASSIGN_EMPLOYEE,
    ...ADMIN_PERMISSIONS, // Quando o ADMINISTRATOR for adicionado remover esta permissão
  ]),

  // [Roles.ADMINISTRATOR]: Object.freeze([
  //   P.USERS_READ, P.USERS_CREATE, P.ROLES_ASSIGN_EMPLOYEE, ...ADMIN_PERMISSIONS,
  // ]),
});

export function permissionsFor(roles = []) {
  const granted = new Set(GUEST_PERMISSIONS);
  for (const role of Array.isArray(roles) ? roles : []) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) granted.add(permission);
  }
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
    : { allowed: false, reason: RoleChangeDenial.ROLE_NOT_ASSIGNABLE, roles: denied }
}
