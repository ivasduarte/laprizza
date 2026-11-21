import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

import { createAuthService } from '../../src/application/auth/auth.service.js';

// AA02 (contact phone) and AA04 (inactivity) rules of the auth service. The token service and
// the password hasher are mocks, so this file runs without the native dependencies.

const USER_ID = 'abcdef000000000000000001';
const SESSION_ID = 'bbbbbb000000000000000001';
const NOW = new Date('2026-11-21T10:00:00.000Z');
const IDLE_MS = 30 * 60_000;

const activeCustomer = (data = {}) => ({
  _id: USER_ID,
  email: 'ana@example.pt',
  status: 'active',
  roles: ['CUSTOMER'],
  customerId: null,
  phoneNumber: null,
  tokenVersion: 0,
  ...data,
});

function build({ user = activeCustomer(), session, idleTimeoutMs = IDLE_MS } = {}) {
  const usersRepository = {
    findById: mock.fn(async () => user),
    update: mock.fn(async (_id, patch) => ({ ...user, ...patch })),
  };
  const sessionsRepository = {
    findById: mock.fn(async () => session),
    rotateRefreshToken: mock.fn(async () => null),
    findByRotatedHash: mock.fn(async () => null),
    touch: mock.fn(async () => {}),
    revoke: mock.fn(async () => {}),
  };
  const tokenService = {
    verifyAccessToken: mock.fn(() => ({ sub: USER_ID, sid: SESSION_ID, tv: 0 })),
    hashOpaqueToken: mock.fn((t) => `hash(${t})`),
    generateOpaqueToken: mock.fn(() => 'next-token'),
  };
  const securityLogger = { log: mock.fn() };
  const service = createAuthService({
    usersRepository,
    sessionsRepository,
    resetTokensRepository: {},
    loginThrottleRepository: {},
    passwordHasher: {},
    tokenService,
    emailService: {},
    securityLogger,
    clock: { now: () => new Date(NOW) },
    config: { lockoutThreshold: 3, lockoutStepsMs: [], sessionIdleTimeoutMs: idleTimeoutMs },
  });
  return { service, usersRepository, sessionsRepository, securityLogger };
}

const sessionUsedAgo = (ms) => ({
  _id: SESSION_ID,
  userId: USER_ID,
  revokedAt: null,
  expiresAt: new Date(NOW.getTime() + 86_400_000),
  lastUsedAt: new Date(NOW.getTime() - ms),
});

// ---------- AA02: contact phone ----------

test('AA02: a Customer without phone gets phoneRequired and no customer permissions', async () => {
  const { service } = build();
  const me = await service.getCurrentUser(USER_ID);
  assert.equal(me.phoneRequired, true);
  assert.ok(!me.permissions.includes('customers:read:own'));
});

test('AA02: the same rule applies to every request (authenticated principal)', async () => {
  const { service } = build({ session: sessionUsedAgo(0) });
  const principal = await service.authenticateAccessToken('at');
  assert.ok(!principal.permissions.includes('customers:read:own'));
});

test('AA02: setContactPhone stores the normalized number and unlocks the customer features', async () => {
  const { service, usersRepository, securityLogger } = build();
  const me = await service.setContactPhone({ userId: USER_ID, phoneNumber: '+351 912 345 678' });
  assert.deepEqual(usersRepository.update.mock.calls[0].arguments, [
    USER_ID,
    { phoneNumber: '912345678' },
  ]);
  assert.equal(me.phoneRequired, false);
  assert.ok(me.permissions.includes('customers:read:own'));
  assert.ok(!JSON.stringify(securityLogger.log.mock.calls).includes('912345678')); // no PII in logs
});

test('AA02: an invalid phone is refused with PHONE_INVALID and nothing is written', async () => {
  const { service, usersRepository } = build();
  for (const phoneNumber of ['123', '812345678', 'abc', '']) {
    await assert.rejects(service.setContactPhone({ userId: USER_ID, phoneNumber }), {
      status: 400,
      code: 'PHONE_INVALID',
    });
  }
  assert.equal(usersRepository.update.mock.callCount(), 0);
});

test('AA02: a disabled account cannot set the phone', async () => {
  const { service } = build({ user: activeCustomer({ status: 'disabled' }) });
  await assert.rejects(service.setContactPhone({ userId: USER_ID, phoneNumber: '912345678' }), {
    status: 401,
    code: 'SESSION_REVOKED',
  });
});

test('AA02: a linked Customer record or a non-customer account never asks for the phone', async () => {
  const linked = build({ user: activeCustomer({ customerId: 'c1' }) });
  assert.equal((await linked.service.getCurrentUser(USER_ID)).phoneRequired, false);
  const staff = build({ user: activeCustomer({ roles: ['EMPLOYEE'] }) });
  assert.equal((await staff.service.getCurrentUser(USER_ID)).phoneRequired, false);
});

// ---------- AA04: inactivity ----------

test('AA04: refresh only rotates sessions used inside the inactivity window', async () => {
  const { service, sessionsRepository } = build();
  await assert.rejects(service.refresh('rt'), { status: 401, code: 'REFRESH_INVALID' });
  const [, , now, { idleSince }] = sessionsRepository.rotateRefreshToken.mock.calls[0].arguments;
  assert.equal(now.getTime(), NOW.getTime());
  assert.equal(idleSince.getTime(), NOW.getTime() - IDLE_MS);
});

test('AA04: an idle session is refused on protected requests', async () => {
  const { service } = build({ session: sessionUsedAgo(IDLE_MS) });
  await assert.rejects(service.authenticateAccessToken('at'), {
    status: 401,
    code: 'SESSION_REVOKED',
  });
});

test('AA04: requests keep the session alive (lastUsedAt written at most once a minute)', async () => {
  const recent = build({ session: sessionUsedAgo(30_000) });
  await recent.service.authenticateAccessToken('at');
  assert.equal(recent.sessionsRepository.touch.mock.callCount(), 0);

  const older = build({ session: sessionUsedAgo(5 * 60_000) });
  await older.service.authenticateAccessToken('at');
  assert.deepEqual(older.sessionsRepository.touch.mock.calls[0].arguments, [SESSION_ID, NOW]);
});

test('AA04: idle timeout 0 keeps only the absolute expiry', async () => {
  const { service, sessionsRepository } = build({
    idleTimeoutMs: 0,
    session: sessionUsedAgo(86_000_000),
  });
  await service.authenticateAccessToken('at');
  await assert.rejects(service.refresh('rt'));
  assert.equal(sessionsRepository.rotateRefreshToken.mock.calls[0].arguments[3].idleSince, null);
});
