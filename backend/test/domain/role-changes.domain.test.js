import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActorKind,
  RoleChangeAction,
  SystemProcess,
  initialRoleChanges,
  roleChange,
  systemActor,
  userActor,
} from '../../src/domain/users/role-changes.domain.js';

const AT = new Date('2026-11-20T10:00:00Z');
const ADMIN = userActor('abcdef0000000000000000ad');

test('AA06: actors identify a user or a known system process', () => {
  assert.deepEqual(ADMIN, { kind: ActorKind.USER, userId: 'abcdef0000000000000000ad' });
  assert.deepEqual(systemActor(SystemProcess.INITIAL_CUSTOMER_ROLE), {
    kind: ActorKind.SYSTEM,
    process: 'initial-customer-role',
  });
  assert.throws(() => userActor(undefined));
  assert.throws(() => systemActor('cron'));
});

test('AA06: a new account records CUSTOMER as the AA03 process and the other roles as the actor', () => {
  const changes = initialRoleChanges({
    userId: 'u1',
    roles: ['CUSTOMER', 'EMPLOYEE'],
    actor: ADMIN,
    at: AT,
  });
  assert.deepEqual(changes, [
    {
      userId: 'u1',
      role: 'CUSTOMER',
      action: RoleChangeAction.ASSIGNED,
      actor: { kind: ActorKind.SYSTEM, process: 'initial-customer-role' },
      at: AT,
    },
    { userId: 'u1', role: 'EMPLOYEE', action: RoleChangeAction.ASSIGNED, actor: ADMIN, at: AT },
  ]);
});

test('AA06: every record has a known role, an action, an actor and a time', () => {
  const valid = { userId: 'u1', role: 'MANAGER', action: 'REMOVED', actor: ADMIN, at: AT };
  assert.deepEqual(roleChange(valid), valid);
  assert.throws(() => roleChange({ ...valid, role: 'GUEST' }));
  assert.throws(() => roleChange({ ...valid, action: 'CHANGED' }));
  assert.throws(() => roleChange({ ...valid, actor: undefined }));
  assert.throws(() => roleChange({ ...valid, at: '2026-11-20' }));
});
