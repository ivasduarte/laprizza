import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../../src/application/app-error.js';
import {
  createCustomer,
  getCustomerById,
  updateCustomer,
  listCustomers,
} from '../../src/application/customers/customers.service.js';

const CUSTOMER_ID = 'c0c0c0000000000000000001';

const createValidator = (isValid = true) => ({ isValidMatch: mock.fn(async () => isValid) });

const duplicateKeyError = (field) =>
  Object.assign(new Error('Duplicate key'), { code: 11000, keyPattern: { [field]: 1 } });

/** Repository whose create echoes the payload with a generated _id. */
const createCustomersRepository = () => ({
  create: mock.fn(async (data) => ({
    _id: CUSTOMER_ID,
    isActive: true,
    dietaryRestrictions: [],
    ...data,
  })),
});

/**
 * Unit test: createCustomer service.
 * Ensures domain validations are executed before interacting with the database.
 */
test('createCustomer enforces domain validations before saving', async () => {
  const customersRepository = createCustomersRepository();
  const validator = createValidator();

  // Action & Assert: Invalid phone prevents DB insertion
  await assert.rejects(
    async () =>
      await createCustomer({ phoneNumber: '123', address: {} }, customersRepository, validator),
    (err) => err.status === 400 && err.message.includes('format'),
  );
  assert.equal(customersRepository.create.mock.callCount(), 0);

  // Action & Assert: Valid data passes through and DTO strips the internal _id
  const customer = await createCustomer(
    {
      name: 'OK',
      email: 'ok@pt.pt',
      phoneNumber: '912345678',
      address: {},
    },
    customersRepository,
    validator,
  );

  assert.equal(customersRepository.create.mock.callCount(), 1);
  assert.ok(customer.id); // DTO exposed standard id
  assert.equal(customer._id, undefined); // Internal _id shielded
});

/**
 * Unit test: getCustomerById and listCustomers services.
 * Validates error throwing and DTO mapping on queries.
 */
test('getCustomerById and listCustomers fetch and map correctly', async () => {
  const stored = {
    _id: CUSTOMER_ID,
    name: 'Fetch',
    email: 'f@f.pt',
    phoneNumber: '912345678',
    address: {},
  };
  const customersRepository = {
    findById: mock.fn(async (id) => (id === CUSTOMER_ID ? stored : undefined)),
    listCustomers: mock.fn(async () => [stored]),
  };

  const found = await getCustomerById(CUSTOMER_ID, customersRepository);
  assert.equal(found.name, 'Fetch');

  const list = await listCustomers({}, customersRepository);
  assert.equal(list.length, 1);
  assert.equal(list[0].email, 'f@f.pt');
  assert.deepEqual(customersRepository.listCustomers.mock.calls[0].arguments[0], {});

  await assert.rejects(
    async () => await getCustomerById('invalid_id', customersRepository),
    (err) => err.status === 404,
  );
});

/**
 * Unit test: updateCustomer service.
 * Verifies partial state manipulation.
 */
test('updateCustomer applies partial changes and preserves existing data', async () => {
  const stored = {
    _id: CUSTOMER_ID,
    name: 'Old',
    email: 'old@pt.pt',
    phoneNumber: '912345678',
    address: {},
    isActive: true,
  };
  const customersRepository = {
    findById: mock.fn(async () => stored),
    update: mock.fn(async (_id, data) => ({ ...stored, ...data })),
  };

  const updated = await updateCustomer(
    CUSTOMER_ID,
    { isActive: false, name: 'New' },
    customersRepository,
  );

  assert.equal(updated.isActive, false);
  assert.equal(updated.name, 'New');
  assert.equal(updated.email, 'old@pt.pt'); // Field not included in update remains untouched
  assert.deepEqual(customersRepository.update.mock.calls[0].arguments, [
    CUSTOMER_ID,
    { isActive: false, name: 'New' },
  ]);
});

test('listCustomers filters by name, email and phone number', async () => {
  const customersRepository = { listCustomers: mock.fn(async () => []) };

  for (const query of [{}, { search: 'maria' }, { search: 'joao@pt' }, { search: '2234' }]) {
    await listCustomers(query, customersRepository);
  }

  // The search term is delegated untouched to the repository (which filters name, email and phone).
  assert.deepEqual(
    customersRepository.listCustomers.mock.calls.map((c) => c.arguments[0]),
    [{}, { search: 'maria' }, { search: 'joao@pt' }, { search: '2234' }],
  );

  customersRepository.listCustomers.mock.mockImplementationOnce(async () => [
    { _id: CUSTOMER_ID, name: 'Maria Santos', email: 'maria@pt.pt', phoneNumber: '912345678' },
  ]);
  const result = await listCustomers({ search: 'maria' }, customersRepository);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Maria Santos');
});

test('createCustomer stores the phone normalized and rejects duplicates in any format', async () => {
  const customersRepository = createCustomersRepository();
  const validator = createValidator();

  const created = await createCustomer(
    { name: 'A', email: 'a@pt.pt', phoneNumber: '+351 912 345 678', address: {} },
    customersRepository,
    validator,
  );
  assert.equal(created.phoneNumber, '912345678');
  assert.equal(customersRepository.create.mock.calls[0].arguments[0].phoneNumber, '912345678');

  customersRepository.create.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError('phoneNumber');
  });
  await assert.rejects(
    async () =>
      await createCustomer(
        { name: 'B', email: 'b@pt.pt', phoneNumber: '912345678', address: {} },
        customersRepository,
        validator,
      ),
    (err) => err.status === 409 && err.message === 'Phone number already in use.',
  );

  customersRepository.create.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError('email');
  });
  await assert.rejects(
    async () =>
      await createCustomer(
        { name: 'C', email: 'a@pt.pt', phoneNumber: '922222222', address: {} },
        customersRepository,
        validator,
      ),
    (err) => err.status === 409 && err.message === 'Email already in use.',
  );
  assert.equal(customersRepository.create.mock.callCount(), 3);
});

test('updateCustomer rejects a phone or email used by another customer', async () => {
  const second = {
    _id: CUSTOMER_ID,
    name: 'Second',
    email: 'second@pt.pt',
    phoneNumber: '922222222',
    address: {},
  };
  const customersRepository = {
    findById: mock.fn(async () => second),
    update: mock.fn(async (_id, data) => ({ ...second, ...data })),
  };

  customersRepository.update.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError('phoneNumber');
  });
  await assert.rejects(
    async () =>
      await updateCustomer(CUSTOMER_ID, { phoneNumber: '+351 912 345 678' }, customersRepository),
    (err) => err.status === 409 && err.message === 'Phone number already in use.',
  );
  // The phone is normalized before reaching the repository.
  assert.equal(customersRepository.update.mock.calls[0].arguments[1].phoneNumber, '912345678');

  customersRepository.update.mock.mockImplementationOnce(async () => {
    throw duplicateKeyError('email');
  });
  await assert.rejects(
    async () => await updateCustomer(CUSTOMER_ID, { email: 'first@pt.pt' }, customersRepository),
    (err) => err.status === 409 && err.message === 'Email already in use.',
  );

  await assert.rejects(
    async () => await updateCustomer(CUSTOMER_ID, { phoneNumber: 'abc' }, customersRepository),
    (err) => err.status === 400,
  );
  assert.equal(customersRepository.update.mock.callCount(), 2);

  // Keeping its own phone number is not a conflict
  const updated = await updateCustomer(
    CUSTOMER_ID,
    { phoneNumber: '922222222', name: 'Renamed' },
    customersRepository,
  );
  assert.equal(updated.name, 'Renamed');
});

test('createCustomer and updateCustomer turn an address mismatch into a 400 AppError', async () => {
  const customersRepository = {
    ...createCustomersRepository(),
    findById: mock.fn(async () => ({ _id: CUSTOMER_ID, name: 'B', address: {} })),
    update: mock.fn(),
  };
  const failingValidator = createValidator(false);
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
        customersRepository,
        failingValidator,
      ),
    (err) => err instanceof AppError && err.status === 400 && err.message.includes('mismatch'),
  );
  assert.equal(customersRepository.create.mock.callCount(), 0);
  assert.ok(failingValidator.isValidMatch.mock.callCount() >= 1);

  await assert.rejects(
    async () =>
      await updateCustomer(CUSTOMER_ID, { address }, customersRepository, failingValidator),
    (err) => err instanceof AppError && err.status === 400,
  );
  assert.equal(customersRepository.update.mock.callCount(), 0);
});
