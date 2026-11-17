import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEV_USERS,
  DEV_CUSTOMER,
  SeedError,
  checkPreconditions,
  describeTarget,
} from '../../scripts/seed-dev-users.js';
import { Roles } from '../../src/domain/users/users.domain.js';

/**
 * Development users seed (AA05): one account per base role, one with two roles and one without
 * roles, so the permission matrix can be tried by hand. These checks run without a database.
 */
const LOCAL_URI = 'mongodb://localhost:27018/laprizza';
const VALID_PASSWORD = 'DevPassword123!';
const preconditions = (overrides = {}) =>
  checkPreconditions({
    nodeEnv: 'development',
    argv: ['node', 'seed-dev-users.js', '--confirm'],
    uri: LOCAL_URI,
    password: VALID_PASSWORD,
    ...overrides,
  });

test('there is one account per base role, one with two roles and one without roles', () => {
  const roleSets = DEV_USERS.map((u) => [...u.roles].sort().join('+'));
  for (const role of Object.values(Roles)) assert.ok(roleSets.includes(role), role);
  assert.ok(roleSets.includes('EMPLOYEE+MANAGER'));
  assert.ok(roleSets.includes(''));
});

test('dev users have unique emails and only known roles', () => {
  assert.equal(new Set(DEV_USERS.map((u) => u.email)).size, DEV_USERS.length);
  for (const user of DEV_USERS) {
    for (const role of user.roles) assert.ok(Object.values(Roles).includes(role), role);
    assert.equal(new Set(user.roles).size, user.roles.length, user.email);
  }
});

test('only CUSTOMER accounts are linked to the dev customer record', () => {
  for (const user of DEV_USERS) {
    if (user.customerId) {
      assert.ok(user.roles.includes(Roles.CUSTOMER), user.email);
      assert.equal(String(user.customerId), String(DEV_CUSTOMER._id), user.email);
    }
  }
  assert.ok(DEV_USERS.some((u) => u.customerId));
});

test('preconditions pass for a local database with --confirm and a valid password', () => {
  assert.deepEqual(preconditions(), { confirmed: true });
});

test('without --confirm nothing is written (dry run)', () => {
  assert.deepEqual(preconditions({ argv: ['node', 'seed-dev-users.js'] }), { confirmed: false });
});

test('refuses production, a remote database, a missing URI and a missing or weak password', () => {
  for (const overrides of [
    { nodeEnv: 'production' },
    { uri: 'mongodb+srv://user:secret@cluster0.abcde.mongodb.net/laprizza' },
    { uri: undefined },
    { password: undefined },
    { password: 'weak' },
  ]) {
    assert.throws(() => preconditions(overrides), SeedError, JSON.stringify(overrides));
  }
});

test('a remote database is only accepted with --allow-remote', () => {
  const remote = 'mongodb+srv://user:secret@cluster0.abcde.mongodb.net/laprizza';
  const argv = ['node', 'seed-dev-users.js', '--confirm', '--allow-remote'];
  assert.deepEqual(preconditions({ uri: remote, argv }), { confirmed: true });
});

test('describeTarget never shows credentials or query options', () => {
  const described = describeTarget(
    'mongodb://user:secret@db1:27017,db2:27017/laprizza?authSource=admin',
  );
  assert.ok(!described.includes('secret'));
  assert.ok(!described.includes('user'));
  assert.ok(!described.includes('authSource'));
  assert.ok(described.includes('db1:27017'));
});
