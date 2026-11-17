import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadCustomer } from '../../src/domain/auth/ownership.domain.js';
import { permissionsFor } from '../../src/domain/auth/permissions.domain.js';

const OWN = '65231abcd345678901234567';
const OTHER = '65231abcd345678901234999';

const principal = (roles, customerId = null) => ({ permissions: permissionsFor(roles), customerId });

test('a customer reads only their own record', () => {
  const customer = principal(['CUSTOMER'], OWN);
  assert.equal(canReadCustomer(customer, OWN), true);
  assert.equal(canReadCustomer(customer, OTHER), false);
});

test('ids are compared by value (ObjectId vs string)', () => {
  const customer = principal(['CUSTOMER'], OWN);
  assert.equal(canReadCustomer(customer, { toString: () => OWN }), true);
});

test('a customer account without a linked customer reads nothing', () => {
  assert.equal(canReadCustomer(principal(['CUSTOMER']), OWN), false);
  assert.equal(canReadCustomer(principal(['CUSTOMER'], OWN), null), false);
});

test('customers:read (manager duties) reads any customer', () => {
  assert.equal(canReadCustomer(principal(['MANAGER']), OTHER), true);
});

test('roles without customer permissions read nothing', () => {
  assert.equal(canReadCustomer(principal(['EMPLOYEE'], OWN), OWN), false);
  assert.equal(canReadCustomer(principal([], OWN), OWN), false);
  assert.equal(canReadCustomer(undefined, OWN), false);
});

test('multiple roles keep the ownership restriction', () => {
  const staffCustomer = principal(['CUSTOMER', 'EMPLOYEE'], OWN);
  assert.equal(canReadCustomer(staffCustomer, OWN), true);
  assert.equal(canReadCustomer(staffCustomer, OTHER), false);
});
