import test from 'node:test';
import assert from 'node:assert/strict';
import { usersApi } from '../../src/features/users/users.api.js';
import {
  getUsersErrorKey,
  roleLabel,
  rolesToAdd,
  statusKey,
  validateNewUser,
} from '../../src/features/users/users.utils.js';
import { sessionStore } from '../../src/shared/auth/session-store.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function mockFetch(t, ...responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return responses.shift();
  });
  return calls;
}

test('Users API client (AA06)', async (t) => {
  sessionStore.start({ accessToken: 'token-123', user: { id: 'admin' } });

  await t.test(
    'create sends no password and omits an empty username',
    async (t) => {
      const calls = mockFetch(
        t,
        json({ id: '1', invitation: { sent: true } }, 201)
      );
      await usersApi.create({
        email: 'new@laprizza.pt',
        username: '',
        roles: ['X'],
      });

      assert.ok(calls[0].url.endsWith('/users'));
      assert.equal(calls[0].options.method, 'POST');
      assert.deepEqual(JSON.parse(calls[0].options.body), {
        email: 'new@laprizza.pt',
        roles: ['X'],
      });
    }
  );

  await t.test(
    'roles are added and removed on their own endpoints, encoded',
    async (t) => {
      const calls = mockFetch(t, json({}), json({}));
      await usersApi.addRole('abc', 'A B');
      await usersApi.removeRole('abc', 'A B');
      assert.ok(calls[0].url.endsWith('/users/abc/roles/A%20B'));
      assert.equal(calls[0].options.method, 'PUT');
      assert.equal(calls[1].options.method, 'DELETE');
    }
  );

  await t.test('assignable roles come from the back end', async (t) => {
    mockFetch(t, json({ roles: ['R1', 'R2'] }), json({}));
    assert.deepEqual(await usersApi.assignableRoles(), ['R1', 'R2']);
    assert.deepEqual(await usersApi.assignableRoles(), []);
  });

  await t.test('status, history and invitation endpoints', async (t) => {
    const calls = mockFetch(t, json({}), json([]), json({ sent: true }, 201));
    await usersApi.setActive('abc', false);
    await usersApi.roleHistory('abc');
    await usersApi.reissueInvitation('abc');
    assert.equal(calls[0].options.method, 'PATCH');
    assert.deepEqual(JSON.parse(calls[0].options.body), { isActive: false });
    assert.ok(calls[1].url.endsWith('/users/abc/role-history'));
    assert.ok(calls[2].url.endsWith('/users/abc/invitation'));
    assert.equal(calls[2].options.method, 'POST');
  });

  sessionStore.end();
});

test('getUsersErrorKey maps status and back-end codes to messages', () => {
  const cases = [
    [{ status: 0 }, 'users.err.network'],
    [{ status: 400 }, 'users.err.invalid'],
    [{ status: 401 }, 'users.err.session'],
    [{ status: 403, code: 'SELF_ROLE_CHANGE' }, 'users.err.self'],
    [{ status: 403, code: 'ROLE_NOT_ASSIGNABLE' }, 'users.err.notAssignable'],
    [{ status: 403, code: 'FORBIDDEN' }, 'users.err.forbidden'],
    [{ status: 404 }, 'users.err.notFound'],
    [
      { status: 409, code: 'ACTIVATION_REQUIRED' },
      'users.err.activationRequired',
    ],
    [
      { status: 409, code: 'ACCOUNT_ALREADY_ACTIVATED' },
      'users.err.alreadyActivated',
    ],
    [{ status: 409, code: 'ACCOUNT_DISABLED' }, 'users.err.disabled'],
    [{ status: 409, code: 'EMAIL_MISSING' }, 'users.err.emailMissing'],
    [{ status: 409, code: 'CONFLICT' }, 'users.err.duplicate'],
    [{ status: 503 }, 'users.err.unavailable'],
    [{ status: 500 }, 'users.err.generic'],
    [undefined, 'users.err.generic'],
  ];
  for (const [error, key] of cases)
    assert.equal(getUsersErrorKey(error), key, JSON.stringify(error));
});

test('validateNewUser checks the e-mail and the optional username', () => {
  assert.deepEqual(validateNewUser({ email: 'a@b.pt' }), {});
  assert.deepEqual(validateNewUser({ email: 'a@b.pt', username: 'ana2' }), {});
  assert.deepEqual(validateNewUser({ email: 'nope' }), {
    email: 'users.err.email',
  });
  assert.deepEqual(validateNewUser({ email: 'a@b.pt', username: 'a.b' }), {
    username: 'users.err.username',
  });
});

test('statusKey distinguishes accounts waiting for activation', () => {
  assert.equal(
    statusKey({ status: 'inactive', pendingActivation: true }),
    'users.status.pending'
  );
  assert.equal(statusKey({ status: 'active' }), 'users.status.active');
  assert.equal(statusKey({ status: 'disabled' }), 'users.status.disabled');
  assert.equal(statusKey({ status: 'inactive' }), 'users.status.inactive');
});

test('rolesToAdd keeps the back-end order and skips roles the user has', () => {
  assert.deepEqual(rolesToAdd({ roles: ['R2'] }, ['R1', 'R2', 'R3']), [
    'R1',
    'R3',
  ]);
  assert.deepEqual(rolesToAdd(undefined, undefined), []);
});

test('roleLabel translates known roles and falls back to the name sent by the back end', () => {
  const t = (key, { defaultValue }) =>
    key === 'users.roleNames.R1' ? 'Role one' : defaultValue;
  assert.equal(roleLabel(t, 'R1'), 'Role one');
  assert.equal(roleLabel(t, 'R9'), 'R9');
});
