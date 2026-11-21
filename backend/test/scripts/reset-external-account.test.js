import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ResetError,
  checkPreconditions,
  emailFromArgs,
} from '../../scripts/reset-external-account.js';

/** Development reset of an external test account: checks that run without a database. */
const LOCAL_URI = 'mongodb://localhost:27018/laprizza';
const preconditions = (overrides = {}) =>
  checkPreconditions({
    nodeEnv: 'development',
    argv: ['node', 'reset-external-account.js', '--email', 'Tester@Gmail.com', '--confirm'],
    uri: LOCAL_URI,
    ...overrides,
  });

test('reads the e-mail in both forms, normalized', () => {
  assert.equal(emailFromArgs(['--email', ' Tester@Gmail.com ']), 'tester@gmail.com');
  assert.equal(emailFromArgs(['--email=tester@gmail.com']), 'tester@gmail.com');
  assert.equal(emailFromArgs(['--confirm']), '');
});

test('a local database with an e-mail and --confirm is accepted', () => {
  assert.deepEqual(preconditions(), { email: 'tester@gmail.com', confirmed: true });
});

test('without --confirm it is a dry run', () => {
  const out = preconditions({ argv: ['node', 'x', '--email', 'tester@gmail.com'] });
  assert.equal(out.confirmed, false);
});

test('refuses production, a missing URI, a remote database and a missing or invalid e-mail', () => {
  assert.throws(() => preconditions({ nodeEnv: 'production' }), ResetError);
  assert.throws(() => preconditions({ uri: undefined }), ResetError);
  assert.throws(
    () => preconditions({ uri: 'mongodb+srv://user:secret@cluster0.example.net/laprizza' }),
    (err) => err instanceof ResetError && !err.message.includes('secret'),
  );
  assert.throws(() => preconditions({ argv: ['node', 'x', '--confirm'] }), ResetError);
  assert.throws(
    () => preconditions({ argv: ['node', 'x', '--email', 'nope', '--confirm'] }),
    ResetError,
  );
});

test('a remote database is accepted only with --allow-remote', () => {
  const out = preconditions({
    uri: 'mongodb://10.9.10.49:27017/laprizza',
    argv: ['node', 'x', '--email', 'tester@gmail.com', '--confirm', '--allow-remote'],
  });
  assert.equal(out.confirmed, true);
});
