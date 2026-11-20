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
  assignableRoles,
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
  assert.deepEqual(permissionsFor([Roles.CUSTOMER]), [
    'catalogue:read',
    'customers:read:own',
    'resources:read',
  ]);

  assert.deepEqual(permissionsFor([Roles.EMPLOYEE]), [
    'catalogue:read',
    'products:read',
    'resources:read',
    'stock:read',
  ]);

  assert.deepEqual(permissionsFor([Roles.MANAGER]), [
    'allergens:read',
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
    'stock:read',
    'stock:read:inactive',
    'stock:write',
    'suppliers:import',
    'suppliers:read',
  ]);

  assert.deepEqual(permissionsFor([Roles.ADMINISTRATOR]), [
    'catalogue:read',
    'resources:read',
    'resources:write',
    'roles:assign:administrator',
    'roles:assign:customer',
    'roles:assign:employee',
    'roles:assign:manager',
    'users:create',
    'users:invite',
    'users:manage',
    'users:read',
  ]);
});

test('Employee has no access to the kitchen (configurations, viewer, assembly lines)', () => {
  const employee = permissionsFor([Roles.EMPLOYEE]);
  assert.ok(!hasPermission(employee, Permission.KITCHEN_READ));
  assert.ok(!hasPermission(employee, Permission.KITCHEN_WRITE));
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

test('AA06: only ADMINISTRATOR holds the user administration permissions', () => {
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const admin = permissions.filter((p) => /^(users|roles):/.test(p));
    assert.deepEqual(admin, role === Roles.ADMINISTRATOR ? [...ADMIN_PERMISSIONS] : [], role);
  }
});

test('SYS04: every base role reads the shared folder; only ADMINISTRATOR writes to it', () => {
  for (const role of Object.values(Roles)) {
    const permissions = permissionsFor([role]);
    assert.ok(hasPermission(permissions, 'resources:read'), role);
    assert.equal(hasPermission(permissions, 'resources:write'), role === Roles.ADMINISTRATOR, role);
  }
});

test('AA06: ADMINISTRATOR grants no restaurant management (needs MANAGER as well)', () => {
  const admin = permissionsFor([Roles.ADMINISTRATOR]);
  for (const denied of ['customers:read', 'products:write', 'stock:read', 'kitchen:read', 'planning:execute']) {
    assert.ok(!hasPermission(admin, denied), denied);
  }
  const both = permissionsFor([Roles.ADMINISTRATOR, Roles.MANAGER]);
  assert.ok(hasPermission(both, 'users:manage') && hasPermission(both, 'kitchen:write'));
});

test('AA06: only an Administrator may assign roles, ADMINISTRATOR included', () => {
  assert.deepEqual(assignableRoles(permissionsFor([Roles.ADMINISTRATOR])).sort(), [
    'ADMINISTRATOR',
    'CUSTOMER',
    'EMPLOYEE',
    'MANAGER',
  ]);
  for (const role of [Roles.MANAGER, Roles.EMPLOYEE, Roles.CUSTOMER]) {
    assert.deepEqual(assignableRoles(permissionsFor([role])), [], role);
  }
  assert.deepEqual(assignableRoles(undefined), []);
});

test('multiple roles receive the union of their permissions', () => {
  const both = permissionsFor([Roles.CUSTOMER, Roles.EMPLOYEE]);
  assert.ok(hasPermission(both, 'customers:read:own'));
  assert.ok(hasPermission(both, 'stock:read'));
  assert.deepEqual(
    permissionsFor([Roles.MANAGER, Roles.EMPLOYEE]),
    permissionsFor([Roles.MANAGER]),
  );
  assert.deepEqual(
    permissionsFor([Roles.EMPLOYEE, Roles.EMPLOYEE]),
    permissionsFor([Roles.EMPLOYEE]),
  );
});

test('hasPermission fails closed on invalid input', () => {
  assert.equal(hasPermission(undefined, 'catalogue:read'), false);
  assert.equal(hasPermission([], 'catalogue:read'), false);
});

test('an actor only adds or removes roles it may assign', () => {
  const employeeAssigner = ['users:read', 'roles:assign:employee'];
  const change = (currentRoles, nextRoles) =>
    evaluateRoleChange({
      actorPermissions: employeeAssigner,
      isSelf: false,
      currentRoles,
      nextRoles,
    });

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

test('AA06: a Manager cannot grant ADMINISTRATOR (no administrative role without an Administrator)', () => {
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
