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
};
const SESSION_ONLY = ['change-password'];
// auth-callback (AA02): landing page of the external login; the session does not exist yet.
const PUBLIC = [
  'home',
  'login',
  'forgot-password',
  'reset-password',
  'auth-callback',
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
