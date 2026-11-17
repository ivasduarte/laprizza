import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { features } from '../../src/features/registry.js';

// Pages a Guest cannot reach (Sprint 2, Table 1): planning, kitchen viewer/config,
// shared resources (authenticated users only) and the own account.
const PROTECTED = [
  'visualization3d',
  'ai',
  'kitchen-configuration',
  'shared-resources',
  'change-password',
];
const PUBLIC = ['home', 'login', 'forgot-password', 'reset-password'];

const byId = (id) => features.find((feature) => feature.id === id);

describe('Route protection in the registry (AA04)', () => {
  it('requires authentication on the protected pages', () => {
    PROTECTED.forEach((id) => assert.equal(byId(id).requiresAuth, true, id));
  });

  it('keeps the entry points and recovery pages public', () => {
    PUBLIC.forEach((id) => assert.notEqual(byId(id).requiresAuth, true, id));
  });
});
