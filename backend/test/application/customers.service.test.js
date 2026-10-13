import test from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../../src/application/AppError.js';
import { createDummyCustomersRepository } from '../infrastructure/customers.dummy.repository.js';
import {
  createCustomer,
  getCustomerById,
  updateCustomer,
  listCustomers,
} from '../../src/application/customers.service.js';

const dummyValidator = { isValidMatch: async () => true };

/**
 * Unit test: createCustomer service.
 * Ensures domain validations are executed before interacting with the database.
 */
test('createCustomer enforces domain validations before saving', async () => {
  const dummyRepo = createDummyCustomersRepository();

  // Action & Assert: Invalid phone prevents DB insertion
  await assert.rejects(
    async () =>
      await createCustomer({ phoneNumber: '123', address: {} }, dummyRepo, dummyValidator),
    (err) => err.status === 400 && err.message.includes('format'),
  );
  assert.equal(dummyRepo._getCustomers().length, 0);

  // Action & Assert: Valid data passes through and DTO strips the internal _id
  const customer = await createCustomer(
    {
      name: 'OK',
      email: 'ok@pt.pt',
      phoneNumber: '912345678',
      address: {},
    },
    dummyRepo,
    dummyValidator,
  );

  assert.equal(dummyRepo._getCustomers().length, 1);
  assert.ok(customer.id); // DTO exposed standard id
  assert.equal(customer._id, undefined); // Internal _id shielded
});

/**
 * Unit test: getCustomerById and listCustomers services.
 * Validates error throwing and DTO mapping on queries.
 */
test('getCustomerById and listCustomers fetch and map correctly', async () => {
  const dummyRepo = createDummyCustomersRepository();
  const created = await createCustomer(
    {
      name: 'Fetch',
      email: 'f@f.pt',
      phoneNumber: '912345678',
      address: {},
    },
    dummyRepo,
    dummyValidator,
  );

  const found = await getCustomerById(created.id, dummyRepo);
  assert.equal(found.name, 'Fetch');

  const list = await listCustomers({}, dummyRepo);
  assert.equal(list.length, 1);
  assert.equal(list[0].email, 'f@f.pt');

  await assert.rejects(
    async () => await getCustomerById('invalid_id', dummyRepo),
    (err) => err.status === 404,
  );
});

/**
 * Unit test: updateCustomer service.
 * Verifies partial state manipulation.
 */
test('updateCustomer applies partial changes and preserves existing data', async () => {
  const dummyRepo = createDummyCustomersRepository();
  const customer = await createCustomer(
    {
      name: 'Old',
      email: 'old@pt.pt',
      phoneNumber: '912345678',
      address: {},
    },
    dummyRepo,
    dummyValidator,
  );

  const updated = await updateCustomer(customer.id, { isActive: false, name: 'New' }, dummyRepo);

  assert.equal(updated.isActive, false);
  assert.equal(updated.name, 'New');
  assert.equal(updated.email, 'old@pt.pt'); // Field not included in update remains untouched
});

test('listCustomers filters by name, email and phone number', async () => {
  const dummyRepo = createDummyCustomersRepository();
  await createCustomer(
    { name: 'Maria Santos', email: 'maria@pt.pt', phoneNumber: '912345678', address: {} },
    dummyRepo,
    dummyValidator,
  );
  await createCustomer(
    { name: 'João Silva', email: 'joao@pt.pt', phoneNumber: '223456789', address: {} },
    dummyRepo,
    dummyValidator,
  );

  assert.equal((await listCustomers({}, dummyRepo)).length, 2);
  assert.equal((await listCustomers({ search: 'maria' }, dummyRepo)).length, 1); // name
  assert.equal((await listCustomers({ search: 'joao@pt' }, dummyRepo)).length, 1); // email
  assert.equal((await listCustomers({ search: '2234' }, dummyRepo)).length, 1); // phone
  assert.equal((await listCustomers({ search: 'xyz' }, dummyRepo)).length, 0);
});

test('createCustomer stores the phone normalized and rejects duplicates in any format', async () => {
  const dummyRepo = createDummyCustomersRepository();
  const created = await createCustomer(
    { name: 'A', email: 'a@pt.pt', phoneNumber: '+351 912 345 678', address: {} },
    dummyRepo,
    dummyValidator,
  );
  assert.equal(created.phoneNumber, '912345678');

  await assert.rejects(
    async () =>
      await createCustomer(
        { name: 'B', email: 'b@pt.pt', phoneNumber: '912345678', address: {} },
        dummyRepo,
        dummyValidator,
      ),
    (err) => err.status === 409 && err.message === 'Phone number already in use.',
  );

  await assert.rejects(
    async () =>
      await createCustomer(
        { name: 'C', email: 'a@pt.pt', phoneNumber: '922222222', address: {} },
        dummyRepo,
        dummyValidator,
      ),
    (err) => err.status === 409 && err.message === 'Email already in use.',
  );
  assert.equal(dummyRepo._getCustomers().length, 1);
});

test('updateCustomer rejects a phone or email used by another customer', async () => {
  const dummyRepo = createDummyCustomersRepository();
  await createCustomer(
    { name: 'First', email: 'first@pt.pt', phoneNumber: '912345678', address: {} },
    dummyRepo,
    dummyValidator,
  );
  const second = await createCustomer(
    { name: 'Second', email: 'second@pt.pt', phoneNumber: '922222222', address: {} },
    dummyRepo,
    dummyValidator,
  );

  await assert.rejects(
    async () => await updateCustomer(second.id, { phoneNumber: '+351 912 345 678' }, dummyRepo),
    (err) => err.status === 409 && err.message === 'Phone number already in use.',
  );
  await assert.rejects(
    async () => await updateCustomer(second.id, { email: 'first@pt.pt' }, dummyRepo),
    (err) => err.status === 409 && err.message === 'Email already in use.',
  );
  await assert.rejects(
    async () => await updateCustomer(second.id, { phoneNumber: 'abc' }, dummyRepo),
    (err) => err.status === 400,
  );

  // Keeping its own phone number is not a conflict
  const updated = await updateCustomer(
    second.id,
    { phoneNumber: '922222222', name: 'Renamed' },
    dummyRepo,
  );
  assert.equal(updated.name, 'Renamed');
});

test('createCustomer and updateCustomer turn an address mismatch into a 400 AppError', async () => {
  const dummyRepo = createDummyCustomersRepository();
  const failingValidator = { isValidMatch: async () => false };
  const address = {
    street: 'R',
    houseNumber: '1',
    postalCode: '4460-123',
    city: 'Porto',
    district: 'P',
  };

  await assert.rejects(
    async () =>
      await createCustomer(
        { name: 'A', email: 'a@pt.pt', phoneNumber: '912345678', address },
        dummyRepo,
        failingValidator,
      ),
    (err) => err instanceof AppError && err.status === 400 && err.message.includes('mismatch'),
  );
  assert.equal(dummyRepo._getCustomers().length, 0);

  const created = await createCustomer(
    { name: 'B', email: 'b@pt.pt', phoneNumber: '912345678', address: {} },
    dummyRepo,
    dummyValidator,
  );
  await assert.rejects(
    async () => await updateCustomer(created.id, { address }, dummyRepo, failingValidator),
    (err) => err instanceof AppError && err.status === 400,
  );
});