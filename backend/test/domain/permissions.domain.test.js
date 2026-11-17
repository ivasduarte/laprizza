import test from 'node:test';
import assert from 'node:assert/strict';
import { Roles } from '../../src/domain/users/users.domain.js';
import {
  Permission,
  ALL_PERMISSIONS,
  GUEST_PERMISSIONS,
  ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
  RoleChangeDenial,
  permissionsFor,
  hasPermission,
  roleAssignmentPermission,
  evaluateRoleChange,
} from '../../src/domain/auth/permissions.domain.js';

const sorted = (list) => [...list].sort();

test('every role has a matrix entry and every entry is a known role', () => {
  assert.deepEqual(sorted(Object.keys(ROLE_PERMISSIONS)), sorted(Object.values(Roles)));
});

test('every role has an assignment permission in the catalogue', () => {
  for (const role of Object.values(Roles)) {
    assert.ok(ALL_PERMISSIONS.includes(roleAssignmentPermission(role)), role);
  }
});

test('the matrix only uses known permissions, without duplicates', () => {
  const known = new Set(ALL_PERMISSIONS);
  for (const list of [GUEST_PERMISSIONS, ADMIN_PERMISSIONS, ...Object.values(ROLE_PERMISSIONS)]) {
    for (const permission of list) assert.ok(known.has(permission), `unknown: ${permission}`);
    assert.equal(new Set(list).size, list.length);
  }
});

test('every permission follows the resource:action[:scope] format', () => {
  for (const permission of ALL_PERMISSIONS) {
    assert.match(permission, /^[a-z]+(:[a-z]+){1,2}$/, permission);
  }
});

test('the matrix is immutable', () => {
  assert.ok(Object.isFrozen(ROLE_PERMISSIONS));
  assert.ok(Object.isFrozen(GUEST_PERMISSIONS));
  assert.ok(Object.isFrozen(ADMIN_PERMISSIONS));
  for (const list of Object.values(ROLE_PERMISSIONS)) assert.ok(Object.isFrozen(list));
});

test('Guest only browses the public catalogue', () => {
  assert.deepEqual([...GUEST_PERMISSIONS], ['catalogue:read']);
});

test('users without roles (or with unknown roles) get only the Guest permissions', () => {
  assert.deepEqual(permissionsFor([]), ['catalogue:read']);
  assert.deepEqual(permissionsFor(), ['catalogue:read']);
  assert.deepEqual(permissionsFor(null), ['catalogue:read']);
  assert.deepEqual(permissionsFor(['GUEST', 'ROOT']), ['catalogue:read']);
});

test('base roles follow Table 1', () => {
  assert.deepEqual(permissionsFor([Roles.CUSTOMER]), ['catalogue:read', 'customers:read:own']);

  assert.deepEqual(permissionsFor([Roles.EMPLOYEE]), [
    'catalogue:read',
    'kitchen:read',
    'products:read',
    'resources:read',
    'stock:read',
  ]);

  assert.deepEqual(permissionsFor([Roles.MANAGER]), [
    'allergens:write',
    'catalogue:read',
    'categories:write',
    'customers:read',
    'customers:write',
    'forecasts:read',
    'forecasts:write',
    'kitchen:read',
    'kitchen:write',
    'pizzas:write',
    'planning:execute',
    'products:read',
    'products:write',
    'resources:read',
    'resources:write',
    'roles:assign:customer',
    'roles:assign:employee',
    'roles:assign:manager',
    'stock:read',
    'stock:read:inactive',
    'stock:write',
    'suppliers:import',
    'suppliers:read',
    'users:create',
    'users:manage',
    'users:read',
  ]);
});

test('Employee reads stock but cannot change it or see inactive products', () => {
  const employee = permissionsFor([Roles.EMPLOYEE]);
  assert.ok(hasPermission(employee, Permission.STOCK_READ));
  assert.ok(!hasPermission(employee, Permission.STOCK_WRITE));
  assert.ok(!hasPermission(employee, Permission.STOCK_READ_INACTIVE));
});

test('Customer has no access to other customers, stock, planning or administration', () => {
  const customer = permissionsFor([Roles.CUSTOMER]);
  for (const denied of ['customers:read', 'stock:read', 'planning:execute', 'users:manage']) {
    assert.ok(!hasPermission(customer, denied), denied);
  }
});

test('administration permissions are granted to MANAGER (provisional)', () => {
  for (const permission of ADMIN_PERMISSIONS) {
    assert.ok(ROLE_PERMISSIONS[Roles.MANAGER].includes(permission), permission);
  }
});

test('Manager keeps creating users and assigning EMPLOYEE outside the admin group', () => {
  for (const permission of ['users:read', 'users:create', 'roles:assign:employee']) {
    assert.ok(!ADMIN_PERMISSIONS.includes(permission), permission);
    assert.ok(ROLE_PERMISSIONS[Roles.MANAGER].includes(permission), permission);
  }
});

test('multiple roles receive the union of their permissions', () => {
  const both = permissionsFor([Roles.CUSTOMER, Roles.EMPLOYEE]);
  assert.ok(hasPermission(both, 'customers:read:own'));
  assert.ok(hasPermission(both, 'kitchen:read'));
  assert.deepEqual(permissionsFor([Roles.MANAGER, Roles.EMPLOYEE]), permissionsFor([Roles.MANAGER]));
  assert.deepEqual(permissionsFor([Roles.EMPLOYEE, Roles.EMPLOYEE]), permissionsFor([Roles.EMPLOYEE]));
});

test('hasPermission fails closed on invalid input', () => {
  assert.equal(hasPermission(undefined, 'catalogue:read'), false);
  assert.equal(hasPermission([], 'catalogue:read'), false);
});

test('an actor only adds or removes roles it may assign', () => {
  const employeeAssigner = ['users:read', 'roles:assign:employee'];
  const change = (currentRoles, nextRoles) =>
    evaluateRoleChange({ actorPermissions: employeeAssigner, isSelf: false, currentRoles, nextRoles });

  assert.deepEqual(change([], ['EMPLOYEE']), { allowed: true });
  assert.deepEqual(change(['EMPLOYEE'], []), { allowed: true });
  assert.deepEqual(change([], ['MANAGER', 'EMPLOYEE']), {
    allowed: false,
    reason: RoleChangeDenial.ROLE_NOT_ASSIGNABLE,
    roles: ['MANAGER'],
  });
});

test('unchanged roles are not checked', () => {
  const result = evaluateRoleChange({
    actorPermissions: ['roles:assign:employee'],
    isSelf: false,
    currentRoles: ['MANAGER', 'EMPLOYEE'],
    nextRoles: ['MANAGER'],
  });
  assert.deepEqual(result, { allowed: true });
});

test('a change without differences is always allowed', () => {
  const result = evaluateRoleChange({
    actorPermissions: [],
    isSelf: true,
    currentRoles: ['EMPLOYEE'],
    nextRoles: ['EMPLOYEE'],
  });
  assert.deepEqual(result, { allowed: true });
});

test('nobody changes their own roles, even with every assignment permission', () => {
  const result = evaluateRoleChange({
    actorPermissions: permissionsFor([Roles.MANAGER]),
    isSelf: true,
    currentRoles: ['MANAGER'],
    nextRoles: ['MANAGER', 'EMPLOYEE'],
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, RoleChangeDenial.SELF_ROLE_CHANGE);
});

test('a role without a granted assignment permission (e.g. ADMINISTRATOR) is never assignable', () => {
  const result = evaluateRoleChange({
    actorPermissions: permissionsFor([Roles.MANAGER]),
    isSelf: false,
    currentRoles: [],
    nextRoles: ['ADMINISTRATOR'],
  });
  assert.deepEqual(result, {
    allowed: false,
    reason: RoleChangeDenial.ROLE_NOT_ASSIGNABLE,
    roles: ['ADMINISTRATOR'],
  });
});
