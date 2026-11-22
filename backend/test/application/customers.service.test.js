import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { AppError } from '../../src/application/app-error.js';
import {
  createCustomer,
  getCustomerById,
  updateCustomer,
  listCustomers,
  getOwnCustomer,
  createOwnCustomer,
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

/**
 * Unit test (AA05): getOwnCustomer only reads the customer linked to the session.
 */
test('getOwnCustomer reads only the customer linked to the session', async () => {
  const stored = { _id: CUSTOMER_ID, name: 'Own', email: 'o@o.pt', phoneNumber: '912345678', address: {} };
  const customersRepository = {
    findById: mock.fn(async (id) => (id === CUSTOMER_ID ? stored : undefined)),
  };

  const own = await getOwnCustomer(
    { customerId: CUSTOMER_ID, permissions: ['catalogue:read', 'customers:read:own'] },
    customersRepository,
  );

  assert.equal(own.name, 'Own');
  assert.deepEqual(
    customersRepository.findById.mock.calls.map((c) => c.arguments[0]),
    [CUSTOMER_ID],
  );
});

/**
 * Unit test (AA05): without a linked customer (or without customers:read:own) -> 404, no query.
 */
test('getOwnCustomer answers 404 CUSTOMER_PROFILE_NOT_FOUND without a linked customer', async () => {
  const customersRepository = { findById: mock.fn() };

  for (const principal of [
    { customerId: null, permissions: ['customers:read:own'] },
    { customerId: CUSTOMER_ID, permissions: ['catalogue:read'] },
    undefined,
  ]) {
    await assert.rejects(getOwnCustomer(principal, customersRepository), (err) => {
      assert.equal(err.status, 404);
      assert.equal(err.code, 'CUSTOMER_PROFILE_NOT_FOUND');
      return true;
    });
  }
  assert.equal(customersRepository.findById.mock.callCount(), 0);
});

/* ===================== Self-service customer record ===================== */

const USER_ID = 'abcdef000000000000000099';
const OWN_ADDRESS = {
  street: 'Rua Direita',
  houseNumber: '10',
  postalCode: '4000-001',
  city: 'Porto',
  district: 'Porto',
};

/** Dependencies of createOwnCustomer: an account without a customer record and with a phone. */
const ownDeps = ({ user = {}, link = true, create } = {}) => {
  const account = { _id: USER_ID, email: 'ana@laprizza.pt', phoneNumber: '912345678', customerId: null, ...user };
  return {
    customersRepository: {
      create: create ?? mock.fn(async (data) => ({ _id: CUSTOMER_ID, isActive: true, ...data })),
      deleteById: mock.fn(async () => ({})),
    },
    usersRepository: {
      findById: mock.fn(async () => account),
      linkCustomerIfUnlinked: mock.fn(async () => (link ? { ...account, customerId: CUSTOMER_ID } : null)),
    },
    postalCodeValidator: createValidator(),
  };
};
const rejectsWithCode = (promise, status, code) =>
  assert.rejects(promise, (err) => {
    assert.equal(err.status, status);
    assert.equal(err.code, code);
    return true;
  });

test('createOwnCustomer creates the record with the account e-mail and phone, and links it', async () => {
  const deps = ownDeps();

  const created = await createOwnCustomer(
    { userId: USER_ID, customerId: null },
    { name: 'Ana Costa', email: 'other@x.pt', address: OWN_ADDRESS },
    deps,
  );

  assert.equal(created.id, CUSTOMER_ID);
  const [saved] = deps.customersRepository.create.mock.calls[0].arguments;
  assert.equal(saved.email, 'ana@laprizza.pt'); // never from the body
  assert.equal(saved.phoneNumber, '912345678'); // the contact phone of the account
  assert.deepEqual(saved.dietaryRestrictions, []);
  assert.deepEqual(deps.usersRepository.linkCustomerIfUnlinked.mock.calls[0].arguments, [USER_ID, CUSTOMER_ID]);
});

test('createOwnCustomer uses the phone of the body when given, normalized', async () => {
  const deps = ownDeps();
  await createOwnCustomer(
    { userId: USER_ID },
    { name: 'Ana Costa', phoneNumber: '+351 932 222 222', address: OWN_ADDRESS },
    deps,
  );
  assert.equal(deps.customersRepository.create.mock.calls[0].arguments[0].phoneNumber, '932222222');
});

test('createOwnCustomer refuses an account that already has a customer record (409)', async () => {
  const fromSession = ownDeps();
  await rejectsWithCode(
    createOwnCustomer({ userId: USER_ID, customerId: CUSTOMER_ID }, { name: 'Ana Costa', address: OWN_ADDRESS }, fromSession),
    409,
    'CUSTOMER_PROFILE_EXISTS',
  );
  const fromDatabase = ownDeps({ user: { customerId: CUSTOMER_ID } });
  await rejectsWithCode(
    createOwnCustomer({ userId: USER_ID }, { name: 'Ana Costa', address: OWN_ADDRESS }, fromDatabase),
    409,
    'CUSTOMER_PROFILE_EXISTS',
  );
  assert.equal(fromSession.customersRepository.create.mock.callCount(), 0);
  assert.equal(fromDatabase.customersRepository.create.mock.callCount(), 0);
});

test('createOwnCustomer never links an existing record by e-mail (409 CUSTOMER_EMAIL_IN_USE)', async () => {
  const deps = ownDeps({ create: mock.fn(async () => Promise.reject(duplicateKeyError('email'))) });
  await rejectsWithCode(
    createOwnCustomer({ userId: USER_ID }, { name: 'Ana Costa', address: OWN_ADDRESS }, deps),
    409,
    'CUSTOMER_EMAIL_IN_USE',
  );
  assert.equal(deps.usersRepository.linkCustomerIfUnlinked.mock.callCount(), 0);
});

test('createOwnCustomer reports a phone used by another customer on the phone field', async () => {
  const deps = ownDeps({ create: mock.fn(async () => Promise.reject(duplicateKeyError('phoneNumber'))) });
  await assert.rejects(
    createOwnCustomer({ userId: USER_ID }, { name: 'Ana Costa', address: OWN_ADDRESS }, deps),
    (err) => {
      assert.equal(err.status, 409);
      assert.equal(err.code, 'PHONE_IN_USE');
      assert.equal(err.details[0].field, 'phoneNumber');
      return true;
    },
  );
});

test('createOwnCustomer validates the phone and the address before saving', async () => {
  const deps = ownDeps({ user: { phoneNumber: null } });
  await rejectsWithCode(
    createOwnCustomer({ userId: USER_ID }, { name: 'Ana Costa', address: OWN_ADDRESS }, deps),
    400,
    'PHONE_INVALID',
  );
  const badAddress = ownDeps();
  badAddress.postalCodeValidator = createValidator(false);
  await assert.rejects(
    createOwnCustomer({ userId: USER_ID }, { name: 'Ana Costa', address: OWN_ADDRESS }, badAddress),
    (err) => err instanceof AppError && err.status === 400,
  );
  assert.equal(deps.customersRepository.create.mock.callCount(), 0);
  assert.equal(badAddress.customersRepository.create.mock.callCount(), 0);
});

test('createOwnCustomer undoes the creation when another request linked a record first', async () => {
  const deps = ownDeps({ link: false });
  await rejectsWithCode(
    createOwnCustomer({ userId: USER_ID }, { name: 'Ana Costa', address: OWN_ADDRESS }, deps),
    409,
    'CUSTOMER_PROFILE_EXISTS',
  );
  assert.deepEqual(deps.customersRepository.deleteById.mock.calls[0].arguments, [CUSTOMER_ID]);
});
