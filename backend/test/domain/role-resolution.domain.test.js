import test from 'node:test';
import assert from 'node:assert/strict';
import { withInitialCustomerRole, activeRoles } from '../../src/domain/users/users.domain.js';
import { evaluateRoleAuthorization } from '../../src/domain/auth/auth.domain.js';

test('AA03: withInitialCustomerRole always adds CUSTOMER and keeps the requested roles', () => {
  assert.deepEqual(withInitialCustomerRole(), ['CUSTOMER']);
  assert.deepEqual(withInitialCustomerRole([]), ['CUSTOMER']);
  assert.deepEqual(withInitialCustomerRole(['EMPLOYEE']), ['CUSTOMER', 'EMPLOYEE']);
  assert.deepEqual(withInitialCustomerRole(['MANAGER', 'CUSTOMER']), ['CUSTOMER', 'MANAGER']);
  assert.deepEqual(withInitialCustomerRole('MANAGER'), ['CUSTOMER']); // not an array
});

test('AA03: activeRoles keeps only known base roles, without duplicates', () => {
  assert.deepEqual(activeRoles(['EMPLOYEE', 'ADMIN', 'EMPLOYEE', 'manager', null]), ['EMPLOYEE']);
  assert.deepEqual(activeRoles(undefined), []);
  assert.deepEqual(activeRoles('MANAGER'), []);
});

test('AA03: evaluateRoleAuthorization denies accounts without an active role', () => {
  assert.deepEqual(evaluateRoleAuthorization(['CUSTOMER']), { allowed: true });
  assert.deepEqual(evaluateRoleAuthorization([]), { allowed: false, reason: 'NO_ACTIVE_ROLE' });
  assert.deepEqual(evaluateRoleAuthorization(undefined), { allowed: false, reason: 'NO_ACTIVE_ROLE' });
});
