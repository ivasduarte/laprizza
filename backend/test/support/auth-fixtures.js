import { mock } from 'node:test';
import { createTokenService } from '../../src/infrastructure/security/token-service.js';

/** JWT secret used by every app built with these fixtures (loadConfig({ JWT_SECRET })). */
export const TEST_JWT_SECRET = 'test_secret_key';

/** Customer record linked to the CUSTOMER persona. */
export const PERSONA_CUSTOMER_ID = 'c0c0c0000000000000000001';

/**
 * Test personas (AA05). GUEST has no account; every other persona is an active user.
 * Base roles follow Table 1; the multi-role and no-role personas check the union rule
 * and the "authenticated but without roles" case.
 */
export const PERSONAS = Object.freeze({
  GUEST: null,
  CUSTOMER: {
    _id: 'abcdef0000000000000000c1',
    roles: ['CUSTOMER'],
    customerId: PERSONA_CUSTOMER_ID,
  },
  EMPLOYEE: { _id: 'abcdef0000000000000000e1', roles: ['EMPLOYEE'] },
  MANAGER: { _id: 'abcdef0000000000000000a1', roles: ['MANAGER'] },
  MANAGER_EMPLOYEE: { _id: 'abcdef0000000000000000a2', roles: ['MANAGER', 'EMPLOYEE'] },
  CUSTOMER_EMPLOYEE: {
    _id: 'abcdef0000000000000000c2',
    roles: ['CUSTOMER', 'EMPLOYEE'],
    customerId: PERSONA_CUSTOMER_ID,
  },
  NO_ROLES: { _id: 'abcdef0000000000000000f1', roles: [] },
});

/** Stored user documents for the personas (as the users repository returns them). */
export const PERSONA_USERS = Object.entries(PERSONAS)
  .filter(([, persona]) => persona)
  .map(([name, persona]) => ({
    email: `${name.toLowerCase().replace(/_/g, '.')}@laprizza.test`,
    status: 'active',
    failedLoginCount: 0,
    lockedUntil: null,
    tokenVersion: 0,
    customerId: null,
    ...persona,
  }));

/**
 * Users and sessions repositories that authenticate the personas.
 * Each user has one always-active session whose id is the user id.
 */
export function createAuthMocks(users = PERSONA_USERS) {
  const userById = (id) => users.find((u) => u._id === String(id)) ?? null;
  return {
    usersRepository: createRepositoryStub({
      findById: mock.fn(async (id) => userById(id)),
      findByEmail: mock.fn(async (email) => users.find((u) => u.email === email) ?? null),
      findByEmailWithPasswordHash: mock.fn(
        async (email) => users.find((u) => u.email === email) ?? null,
      ),
    }),
    sessionsRepository: createRepositoryStub({
      findById: mock.fn(async (id) =>
        userById(id)
          ? {
              _id: String(id),
              userId: String(id),
              tokenVersion: 0,
              expiresAt: new Date(Date.now() + 3_600_000),
              revokedAt: null,
            }
          : null,
      ),
    }),
    securityLogger: { log: mock.fn() },
  };
}

const tokenService = createTokenService({
  jwtSecret: TEST_JWT_SECRET,
  accessTokenTtlSeconds: 3600,
});

/** Access token of a persona (null for GUEST). Signed exactly as a real login would. */
export function tokenFor(personaName) {
  const persona = PERSONAS[personaName];
  if (!persona) return null;
  return tokenService.signAccessToken({
    userId: persona._id,
    sessionId: persona._id,
    tokenVersion: 0,
  });
}

/**
 * Repository stub that never touches the database: explicit methods are used as given,
 * any other method resolves to [] (list/search*) or null. Authorization tests only need the
 * request to get past the guards; the business outcome (200/400/404) is not under test.
 */
export function createRepositoryStub(methods = {}) {
  return new Proxy(methods, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      return async () => (/^(list|search)/.test(prop) ? [] : null);
    },
  });
}
