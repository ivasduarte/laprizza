import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARGON2_OPTIONS,
  createPasswordHasher,
  passwordHasher,
} from '../../src/infrastructure/security/password-hasher.js';
import { FAST_ARGON2_OPTIONS } from './auth.dummy.dependencies.js';

const hasher = createPasswordHasher(FAST_ARGON2_OPTIONS);
const PASSWORD = 'StrongPassword123!';

/**
 * Unit test: production parameters.
 * argon2id, 64 MiB, 3 iterations, 4 lanes (above the OWASP minimum) and immutable.
 */
test('production hasher uses argon2id with the pinned parameters', async () => {
  assert.ok(Object.isFrozen(ARGON2_OPTIONS));
  const hash = await passwordHasher.hash(PASSWORD);
  assert.match(hash, /^\$argon2id\$v=19\$m=65536,p=4,t=3\$/);
});

/**
 * Unit test: one-way hash, unique salt per hash, never the original password.
 */
test('hash is salted and never contains the plain password', async () => {
  const a = await hasher.hash(PASSWORD);
  const b = await hasher.hash(PASSWORD);
  assert.notEqual(a, b);
  assert.ok(!a.includes(PASSWORD));
});

/**
 * Unit test: verify accepts the correct password and rejects the wrong one.
 */
test('verify returns true only for the right password', async () => {
  const hash = await hasher.hash(PASSWORD);
  assert.equal(await hasher.verify(hash, PASSWORD), true);
  assert.equal(await hasher.verify(hash, 'WrongPassword999!'), false);
});

/**
 * Unit test: verify never throws.
 * A missing hash (e.g. invited account) or a malformed one gives false (and not a 500).
 */
test('verify returns false for missing or malformed hashes', async () => {
  assert.equal(await hasher.verify(undefined, PASSWORD), false);
  assert.equal(await hasher.verify('', PASSWORD), false);
  assert.equal(await hasher.verify('not-a-hash', PASSWORD), false);
});

/**
 * Unit test: verifyDummy always returns false (used for non-existent accounts).
 */
test('verifyDummy always returns false', async () => {
  assert.equal(await hasher.verifyDummy(PASSWORD), false);
  assert.equal(await hasher.verifyDummy(''), false);
});

/**
 * Unit test: warmUp precomputes the fictitious hash without failing.
 */
test('warmUp resolves', async () => {
  await assert.doesNotReject(() => hasher.warmUp());
});

/**
 * Unit test: needsRehash detects hashes created with different parameters.
 */
test('needsRehash detects hashes created with other parameters', async () => {
  const weakHash = await hasher.hash(PASSWORD);
  assert.equal(hasher.needsRehash(weakHash), false);
  assert.equal(passwordHasher.needsRehash(weakHash), true);
});
