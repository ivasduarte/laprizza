import { Roles } from './users.domain.js';

/**
 * AA06: every role assignment or removal is recorded with the responsible user or system
 * process and the time. The records are append-only.
 */
export const RoleChangeAction = Object.freeze({
  ASSIGNED: 'ASSIGNED',
  REMOVED: 'REMOVED',
});

export const ActorKind = Object.freeze({
  USER: 'USER',
  SYSTEM: 'SYSTEM',
});

/** System processes that change roles without an Administrator. */
export const SystemProcess = Object.freeze({
  /** AA03: automatic Customer role of every new account. */
  INITIAL_CUSTOMER_ROLE: 'initial-customer-role',
  /** First start of an empty database (seeder). */
  INITIAL_ACCOUNT_SEED: 'initial-account-seed',
  /** AA06 data migration: first Administrator of an existing database. */
  MIGRATION_AA06: 'migration-aa06',
  /** AA02/AA06: activation invitation of an account created by its first external login. */
  EXTERNAL_FIRST_LOGIN: 'external-first-login',
});

const KNOWN_PROCESSES = new Set(Object.values(SystemProcess));

/** Actor for a change made by an authenticated user (an Administrator). */
export function userActor(userId) {
  if (!userId) throw new Error('A user actor needs a user id.');
  return Object.freeze({ kind: ActorKind.USER, userId: String(userId) });
}

/** Actor for a change made by a system process. */
export function systemActor(process) {
  if (!KNOWN_PROCESSES.has(process)) throw new Error(`Unknown system process: ${process}`);
  return Object.freeze({ kind: ActorKind.SYSTEM, process });
}

/**
 * One role change record.
 *
 * @param {{userId: string, role: string, action: string, actor: object, at: Date}} change
 */
export function roleChange({ userId, role, action, actor, at }) {
  if (!Object.values(Roles).includes(role)) throw new Error(`Unknown role: ${role}`);
  if (!Object.values(RoleChangeAction).includes(action))
    throw new Error(`Unknown action: ${action}`);
  if (!actor?.kind) throw new Error('A role change needs an actor.');
  if (!(at instanceof Date)) throw new Error('A role change needs a date.');
  return { userId: String(userId), role, action, actor, at };
}

/**
 * Records of the roles of a new account. CUSTOMER is always assigned by the AA03 process; the
 * other roles are attributed to the actor that created the account.
 *
 * @param {{userId: string, roles: string[], actor: object, at: Date}} input
 * @returns {object[]}
 */
export function initialRoleChanges({ userId, roles = [], actor, at }) {
  return roles.map((role) =>
    roleChange({
      userId,
      role,
      action: RoleChangeAction.ASSIGNED,
      actor: role === Roles.CUSTOMER ? systemActor(SystemProcess.INITIAL_CUSTOMER_ROLE) : actor,
      at,
    }),
  );
}
