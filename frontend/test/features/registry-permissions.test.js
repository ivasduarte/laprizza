import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { features } from '../../src/features/registry.js';

const byId = (id) => features.find((feature) => feature.id === id);

/**
 * Permission of each protected page, written by hand from the API routes the page uses
 * (AA05 matrix). A page added without deciding who may use it fails these tests.
 */
const EXPECTED_PERMISSIONS = {
  visualization3d: 'kitchen:read',
  ai: 'planning:execute',
  'kitchen-configuration': 'kitchen:read',
  'shared-resources': 'resources:read',
  // AA06: user administration (GET /users), Administrator only
  users: 'users:read',
  // WEB05: Sprint 1 management pages (GET of each resource)
  'product-categories': 'products:read',
  allergens: 'allergens:read',
  'pizza-sizes': 'products:read',
  'pizza-component-types': 'products:read',
  products: 'products:read',
  stock: 'stock:read',
  'predefined-pizzas': 'products:read',
  customers: 'customers:read',
  // WEB05: the customer's own record (GET /customers/me)
  'my-data': 'customers:read:own',
};
// complete-profile (AA02): contact phone of the signed-in account, before any customer permission.
const SESSION_ONLY = ['change-password', 'complete-profile'];
// auth-callback (AA02): landing page of the external login; the session does not exist yet.
// activate-account (AA07): the account is not active yet, so there is no session to require.
// catalogue (WEB05): the sellable catalogue is open to Guests (catalogue:read, Table 1).
const PUBLIC = [
  'home',
  'login',
  'forgot-password',
  'reset-password',
  'auth-callback',
  'activate-account',
  'catalogue',
];

describe('Registry permissions (WEB03)', () => {
  it('each protected page requires the permission of its API routes', () => {
    for (const [id, permission] of Object.entries(EXPECTED_PERMISSIONS)) {
      assert.equal(byId(id)?.permission, permission, id);
    }
  });

  it('pages that only need a session have no permission', () => {
    for (const id of SESSION_ONLY) {
      assert.equal(byId(id).requiresAuth, true, id);
      assert.equal(byId(id).permission, undefined, id);
    }
  });

  it('public pages need neither a session nor a permission', () => {
    for (const id of PUBLIC) {
      assert.notEqual(byId(id).requiresAuth, true, id);
      assert.equal(byId(id).permission, undefined, id);
    }
  });

  it('every page is classified: a new page must be added to one of the lists above', () => {
    const known = [
      ...Object.keys(EXPECTED_PERMISSIONS),
      ...SESSION_ONLY,
      ...PUBLIC,
    ];
    const unclassified = features
      .map((f) => f.id)
      .filter((id) => !known.includes(id));
    assert.deepEqual(unclassified, []);
  });

  it('permissions use the resource:action[:scope] format of the back end', () => {
    for (const feature of features.filter((f) => f.permission)) {
      assert.match(feature.permission, /^[a-z]+(:[a-z]+){1,2}$/, feature.id);
    }
  });
});
