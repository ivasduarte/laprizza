import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { features } from '../../src/features/registry.js';
import { visibleFeatures } from '../../src/features/navigation.js';

/**
 * Permissions granted by the back end to each base role (AA05 matrix, Table 1), written by hand:
 * the menu must follow them, never role names.
 */
const PERMISSIONS = {
  GUEST: ['catalogue:read'],
  CUSTOMER: ['catalogue:read', 'customers:read:own', 'resources:read'],
  EMPLOYEE: ['catalogue:read', 'products:read', 'resources:read', 'stock:read'],
  MANAGER: [
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
  ],
  // AA06: user administration only
  ADMINISTRATOR: [
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
  ],
  NO_ROLES: ['catalogue:read'],
};

const menuOf = (persona) =>
  visibleFeatures(features, {
    permissions: PERMISSIONS[persona],
    authenticated: persona !== 'GUEST',
  }).map((feature) => feature.id);

describe('Dynamic navigation menu (WEB03)', () => {
  it('a Guest only sees the public pages (WEB05: the catalogue is public)', () => {
    assert.deepEqual(menuOf('GUEST'), ['home', 'catalogue']);
  });

  it('a Customer also sees the shared resources (team decision)', () => {
    assert.deepEqual(menuOf('CUSTOMER'), [
      'home',
      'shared-resources',
      'catalogue',
      'my-data',
    ]);
  });

  it('a user without roles sees what a Guest sees', () => {
    assert.deepEqual(menuOf('NO_ROLES'), ['home', 'catalogue']);
  });

  it('an Employee sees the shared resources and the read-only catalogue pages, but nothing of the kitchen (MANAGER only)', () => {
    assert.deepEqual(menuOf('EMPLOYEE'), [
      'home',
      'shared-resources',
      'product-categories',
      'pizza-sizes',
      'pizza-component-types',
      'products',
      'stock',
      'predefined-pizzas',
      'catalogue',
    ]);
  });

  it('a Manager also sees planning (AI)', () => {
    assert.deepEqual(menuOf('MANAGER'), [
      'home',
      'visualization3d',
      'ai',
      'kitchen-configuration',
      'shared-resources',
      'product-categories',
      'allergens',
      'pizza-sizes',
      'pizza-component-types',
      'products',
      'stock',
      'predefined-pizzas',
      'catalogue',
      'customers',
    ]);
  });

  it('an Administrator sees the user administration and the shared folder, nothing of the restaurant (AA06, SYS04)', () => {
    assert.deepEqual(menuOf('ADMINISTRATOR'), [
      'home',
      'shared-resources',
      'users',
      'catalogue',
    ]);
  });

  it('a Manager does not see the user administration (AA06)', () => {
    assert.ok(!menuOf('MANAGER').includes('users'));
  });

  it('several roles see the union of their pages', () => {
    const both = visibleFeatures(features, {
      permissions: [
        ...new Set([...PERMISSIONS.MANAGER, ...PERMISSIONS.EMPLOYEE]),
      ],
      authenticated: true,
    }).map((feature) => feature.id);
    assert.deepEqual(both, menuOf('MANAGER'));
  });

  it('never lists pages that are hidden from the menu (login, recovery, change password)', () => {
    const everything = visibleFeatures(features, {
      permissions: PERMISSIONS.MANAGER,
      authenticated: true,
    }).map((feature) => feature.id);
    for (const hidden of [
      'login',
      'forgot-password',
      'reset-password',
      'change-password',
    ]) {
      assert.ok(!everything.includes(hidden), hidden);
    }
  });

  it('a page that needs a session is hidden without one, even if its permission is granted', () => {
    const page = {
      id: 'x',
      showInNav: true,
      requiresAuth: true,
      permission: 'catalogue:read',
    };
    assert.deepEqual(
      visibleFeatures([page], {
        permissions: ['catalogue:read'],
        authenticated: false,
      }),
      []
    );
    assert.equal(
      visibleFeatures([page], {
        permissions: ['catalogue:read'],
        authenticated: true,
      }).length,
      1
    );
  });

  it('fails closed with an empty or invalid permission list (only public pages)', () => {
    for (const permissions of [[], undefined, null]) {
      const ids = visibleFeatures(features, {
        permissions,
        authenticated: true,
      }).map((f) => f.id);
      assert.deepEqual(ids, ['home', 'catalogue'], String(permissions));
    }
  });
});
