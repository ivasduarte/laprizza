import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp, loadConfig } from '../../src/index.js';
import { createTokenService } from '../../src/infrastructure/security/token-service.js';

/**
 * AA07 through the HTTP API, with in-memory repositories that behave like MongoDB for the
 * fields the activation uses (conditional consume and activateAccount).
 */
const PASSWORD = 'StrongPassword123!';
const TOKEN = 'Abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE'; // 43 chars, base64url
const OTHER_TOKEN = 'Z'.repeat(43);
const LOCAL_ID = 'abcdef000000000000000011';
const EXTERNAL_ID = 'abcdef000000000000000012';
const tokenService = createTokenService({ jwtSecret: 'test', accessTokenTtlSeconds: 60 });

function createStore() {
  const users = [
    {
      _id: LOCAL_ID,
      email: 'new.employee@laprizza.pt',
      roles: ['CUSTOMER', 'EMPLOYEE'],
      status: 'inactive',
      activatedAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      tokenVersion: 0,
    },
    {
      _id: EXTERNAL_ID,
      email: 'ext.user@gmail.com',
      roles: ['CUSTOMER'],
      status: 'inactive',
      activatedAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      tokenVersion: 0,
    },
  ];
  const invitations = [
    {
      tokenHash: tokenService.hashOpaqueToken(TOKEN),
      userId: LOCAL_ID,
      email: 'new.employee@laprizza.pt',
      expiresAt: new Date(Date.now() + 3_600_000),
      usedAt: null,
      revokedAt: null,
    },
    {
      tokenHash: tokenService.hashOpaqueToken(OTHER_TOKEN),
      userId: EXTERNAL_ID,
      email: 'ext.user@gmail.com',
      expiresAt: new Date(Date.now() + 3_600_000),
      usedAt: null,
      revokedAt: null,
    },
  ];
  const identities = [
    {
      userId: EXTERNAL_ID,
      provider: 'google',
      issuer: 'https://accounts.google.com',
      subject: 'g-1',
    },
  ];
  const byId = (id) => users.find((u) => u._id === String(id)) ?? null;

  return {
    users,
    invitations,
    repos: {
      usersRepository: {
        findById: mock.fn(async (id) => byId(id)),
        findByEmailWithPasswordHash: mock.fn(
          async (email) => users.find((u) => u.email === email) ?? null,
        ),
        registerFailedLogin: mock.fn(async (id) => ({ ...byId(id), failedLoginCount: 1 })),
        extendLockout: mock.fn(async () => {}),
        clearLoginFailures: mock.fn(async () => {}),
        activateAccount: mock.fn(async (id, data) => {
          const user = byId(id);
          if (!user || user.status !== 'inactive' || user.activatedAt) return null;
          Object.assign(user, { status: 'active', failedLoginCount: 0, lockedUntil: null }, data);
          return user;
        }),
      },
      sessionsRepository: {
        create: mock.fn(async (data) => ({ _id: String(data.userId), ...data })),
        findById: mock.fn(async () => null),
      },
      invitationsRepository: {
        create: mock.fn(async (data) => data),
        revokePendingForUser: mock.fn(async () => ({})),
        findByTokenHash: mock.fn(
          async (hash) => invitations.find((i) => i.tokenHash === hash) ?? null,
        ),
        consume: mock.fn(async (hash, now) => {
          const inv = invitations.find(
            (i) => i.tokenHash === hash && !i.usedAt && !i.revokedAt && i.expiresAt > now,
          );
          if (!inv) return null;
          inv.usedAt = now;
          return inv;
        }),
      },
      externalIdentitiesRepository: {
        findByUserId: mock.fn(async (userId) =>
          identities.filter((i) => i.userId === String(userId)),
        ),
      },
      emailService: { send: mock.fn(async () => {}) },
      securityLogger: { log: mock.fn() },
    },
  };
}

async function setup(t) {
  const store = createStore();
  const server = createApp(
    loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }),
    store.repos,
  ).listen(0);
  await once(server, 'listening');
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/v2/auth`;
  const post = (path, body) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { store, post };
}

test('API AA07 /auth/activation/inspect: local and external links, nothing used', async (t) => {
  const { store, post } = await setup(t);

  let res = await post('/activation/inspect', { token: TOKEN });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const local = await res.json();
  assert.equal(local.method, 'local');
  assert.equal(local.email, 'n***e@laprizza.pt');
  assert.ok(local.expiresAt);

  res = await post('/activation/inspect', { token: OTHER_TOKEN });
  assert.deepEqual(
    { ...(await res.json()), expiresAt: undefined },
    { method: 'external', provider: 'google', email: 'e***r@gmail.com', expiresAt: undefined },
  );

  assert.ok(store.invitations.every((i) => i.usedAt === null));
  assert.ok(store.users.every((u) => u.status === 'inactive'));
});

test('API AA07 /auth/activation/inspect: malformed (400 VALIDATION_FAILED) and unknown (400 INVITATION_INVALID)', async (t) => {
  const { post } = await setup(t);

  let res = await post('/activation/inspect', { token: 'not-a-token' });
  assert.equal(res.status, 400);
  let body = await res.json();
  assert.equal(body.error.code, 'VALIDATION_FAILED');
  assert.ok(!JSON.stringify(body).includes('not-a-token')); // the value is never echoed

  res = await post('/activation/inspect', { token: 'Q'.repeat(43) });
  assert.equal(res.status, 400);
  body = await res.json();
  assert.equal(body.error.code, 'INVITATION_INVALID');
});

test('API AA07 /auth/activation/local: full flow (login refused before, activation, login after, single use)', async (t) => {
  const { store, post } = await setup(t);
  const email = 'new.employee@laprizza.pt';

  // Before the activation the account cannot log in (it has no password and is inactive).
  let res = await post('/login', { email, password: PASSWORD });
  assert.equal(res.status, 401);

  // A weak password is refused and does not spend the link.
  res = await post('/activation/local', { token: TOKEN, newPassword: 'weak' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'PASSWORD_POLICY_VIOLATION');
  assert.equal(store.invitations[0].usedAt, null);

  // Activation: 204, no session cookie, account active with the roles it had.
  res = await post('/activation/local', { token: TOKEN, newPassword: PASSWORD });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('set-cookie'), null);
  const user = store.users[0];
  assert.equal(user.status, 'active');
  assert.ok(user.activatedAt instanceof Date);
  assert.deepEqual(user.roles, ['CUSTOMER', 'EMPLOYEE']);
  assert.ok(user.passwordHash.startsWith('$argon2id$'));
  assert.notEqual(user.passwordHash, PASSWORD);
  assert.ok(store.invitations[0].usedAt instanceof Date);

  // The link is single use.
  res = await post('/activation/local', { token: TOKEN, newPassword: PASSWORD });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVITATION_INVALID');

  // Normal login now works and gets exactly the assigned roles.
  res = await post('/login', { email, password: PASSWORD });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).user.roles, ['CUSTOMER', 'EMPLOYEE']);
});

test('API AA07 /auth/activation/local: an external account cannot be activated with a password', async (t) => {
  const { store, post } = await setup(t);
  const res = await post('/activation/local', { token: OTHER_TOKEN, newPassword: PASSWORD });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVITATION_INVALID');
  assert.equal(store.users[1].status, 'inactive');
  assert.equal(store.users[1].passwordHash, undefined);
  assert.equal(store.invitations[1].usedAt, null);
});

test('API AA07 /auth/activation/local: expired and replaced links are refused', async (t) => {
  const { store, post } = await setup(t);
  store.invitations[0].expiresAt = new Date(Date.now() - 1000);
  let res = await post('/activation/local', { token: TOKEN, newPassword: PASSWORD });
  assert.equal((await res.json()).error.code, 'INVITATION_INVALID');

  store.invitations[0].expiresAt = new Date(Date.now() + 3_600_000);
  store.invitations[0].revokedAt = new Date();
  res = await post('/activation/local', { token: TOKEN, newPassword: PASSWORD });
  assert.equal(res.status, 400);
  assert.equal(store.users[0].status, 'inactive');
});
