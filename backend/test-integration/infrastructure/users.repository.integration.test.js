import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { AccountStatus, Roles } from '../../src/domain/users/users.domain.js';
import Users from '../../src/infrastructure/users/users.model.js';
import * as usersRepository from '../../src/infrastructure/users/users.repository.js';
import { startMongo, STARTUP_TIMEOUT_MS } from '../support/mongo-container.js';

/**
 * Integration tests: the Users repository against a real MongoDB (Testcontainers).
 * They cover what mocks cannot: unique/sparse indexes, hidden fields and atomic update operators.
 */
let mongo;

before(
  async () => {
    mongo = await startMongo();
  },
  { timeout: STARTUP_TIMEOUT_MS },
);

after(async () => {
  await mongo?.stop();
});

beforeEach(async () => {
  await Users.deleteMany({});
});

const createUser = (overrides = {}) =>
  usersRepository.create({
    email: 'user@laprizza.pt',
    passwordHash: 'hash',
    role: Roles.MANAGER,
    status: AccountStatus.ACTIVE,
    ...overrides,
  });

test('the unique index rejects two users with the same email', async () => {
  await createUser();

  await assert.rejects(createUser(), (err) => err.code === 11000);
});

test('the sparse index on username allows several users without one', async () => {
  await createUser({ email: 'a@laprizza.pt' });
  await createUser({ email: 'b@laprizza.pt' });

  assert.equal(await Users.countDocuments(), 2);
});

test('passwordHash is only returned by the WithPasswordHash lookups', async () => {
  await createUser();

  const plain = await usersRepository.findByEmail('user@laprizza.pt');
  const withHash = await usersRepository.findByEmailWithPasswordHash('user@laprizza.pt');

  assert.equal(plain.passwordHash, undefined);
  assert.equal(withHash.passwordHash, 'hash');
});

test('registerFailedLogin increments the counter and clearLoginFailures resets it', async () => {
  const user = await createUser();

  await usersRepository.registerFailedLogin(user._id);
  const afterTwo = await usersRepository.registerFailedLogin(user._id);
  assert.equal(afterTwo.failedLoginCount, 2);

  await usersRepository.extendLockout(user._id, new Date('2030-01-01T00:00:00Z'));
  await usersRepository.clearLoginFailures(user._id);

  const cleared = await usersRepository.findById(user._id);
  assert.equal(cleared.failedLoginCount, 0);
  assert.equal(cleared.lockedUntil, null);
});

test('extendLockout never shortens an existing lockout', async () => {
  const user = await createUser();
  const later = new Date('2030-01-01T00:00:00Z');
  const earlier = new Date('2029-01-01T00:00:00Z');

  await usersRepository.extendLockout(user._id, later);
  await usersRepository.extendLockout(user._id, earlier);

  const reloaded = await usersRepository.findById(user._id);
  assert.equal(reloaded.lockedUntil.toISOString(), later.toISOString());
});

test('setPasswordHash can revoke the tokens by bumping tokenVersion', async () => {
  const user = await createUser();

  const updated = await usersRepository.setPasswordHash(user._id, 'new-hash', {
    revokeTokens: true,
  });

  assert.equal(updated.tokenVersion, 1);
});
