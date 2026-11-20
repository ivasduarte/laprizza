import { passwordHasher as defaultPasswordHasher } from '../../infrastructure/security/password-hasher.js';
import {
  Roles,
  AccountStatus,
  normalizeEmail,
  withInitialCustomerRole,
  evaluateStatusChange,
} from '../../domain/users/users.domain.js';
import { evaluateRoleChange, assignableRoles } from '../../domain/auth/permissions.domain.js';
import { RoleChangeAction, userActor } from '../../domain/users/role-changes.domain.js';
import { assertPasswordPolicy } from '../auth/password-policy.js';
import { AppError } from '../app-error.js';

/**
 * Converts a user document into a safe DTO (no password hash or internal fields).
 *
 * @param {Object} user - The raw database document representing a user.
 * @returns {Object} The filtered user DTO safe for client consumption.
 */
export function toUserDto(user) {
  const status = user.status ?? AccountStatus.ACTIVE;
  return {
    id: user._id || user.id,
    username: user.username,
    email: user.email,
    roles: Array.isArray(user.roles) ? [...user.roles] : [],
    status,
    isActive: status === AccountStatus.ACTIVE,
    pendingActivation: status === AccountStatus.INACTIVE && !user.activatedAt,
    customerId: user.customerId || null,
  };
}

/**
 * Refuses role changes the actor may not make (AA05/AA06): no change to one's own roles and
 * only roles the actor may assign.
 *
 * @throws {AppError} 403 SELF_ROLE_CHANGE or ROLE_NOT_ASSIGNABLE.
 */
export function assertRoleChangeAllowed(actor, targetId, currentRoles, nextRoles) {
  const decision = evaluateRoleChange({
    actorPermissions: actor?.permissions ?? [],
    isSelf: Boolean(targetId) && String(actor?.userId) === String(targetId),
    currentRoles,
    nextRoles,
  });

  if (!decision.allowed) {
    throw new AppError(
      'You are not allowed to change these roles.',
      403,
      { roles: decision.roles },
      decision.reason,
    );
  }
}

const userNotFound = () => new AppError('User not found.', 404);
const roleRecordUnavailable = () =>
  new AppError('The role change could not be recorded. Nothing was changed.', 503);

/**
 * User administration (AA05/AA06). Every dependency is injected.
 *
 * @param {object} deps
 * @param {object} deps.usersRepository
 * @param {ReturnType<import('./role-change-recorder.js').createRoleChangeRecorder>} deps.roleChangeRecorder
 * @param {ReturnType<import('./activation-invitation.service.js').createActivationInvitationService>} deps.invitationService
 * @param {{log: Function}} deps.securityLogger
 * @param {object} [deps.passwordHasher]
 */
export function createUsersService({
  usersRepository,
  roleChangeRecorder,
  invitationService,
  securityLogger,
  passwordHasher = defaultPasswordHasher,
}) {
  async function findUser(id) {
    const user = await usersRepository.findById(id);
    if (!user) throw userNotFound();
    return user;
  }

  async function listUsers() {
    const users = await usersRepository.listUsers();
    return users.map(toUserDto);
  }

  async function getUserById(id) {
    return toUserDto(await findUser(id));
  }

  /**
   * AA06: creates an INACTIVE account and sends its activation invitation. The password is set
   * by the user during activation (AA07), never by the Administrator. CUSTOMER is added by the
   * back end (AA03); every other role must be assignable by the actor.
   *
   * @returns {Promise<Object>} The user DTO with `invitation: {expiresAt, sent}`
   *   (`expiresAt` is null when the invitation could not be stored).
   */
  async function createUser(actor, { username, email, roles = [], customerId }) {
    assertRoleChangeAllowed(actor, null, [], roles);
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new AppError('Email is mandatory.', 400);

    let user;
    try {
      user = await usersRepository.create({
        username: username?.trim().toLowerCase(),
        email: normalizedEmail,
        roles: withInitialCustomerRole(roles),
        customerId,
        status: AccountStatus.INACTIVE,
        activatedAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        tokenVersion: 0,
      });
    } catch (err) {
      if (err?.code === 11000) throw new AppError('Email or username already in use.', 409);
      throw err;
    }

    const actorRef = userActor(actor.userId);
    try {
      await roleChangeRecorder.recordInitialRoles(user, actorRef);
    } catch (err) {
      // Without the record the roles have no responsible actor: the account is not kept.
      securityLogger.log('ROLE_CHANGE_RECORD_FAILED', {
        userId: String(user._id),
        operation: 'create-user',
        reason: err?.name ?? 'Error',
      });
      await usersRepository.deleteById(user._id);
      throw roleRecordUnavailable();
    }

    let invitation;
    try {
      invitation = await invitationService.issue(user, { issuedBy: actorRef });
    } catch (err) {
      securityLogger.log('ACTIVATION_INVITATION_FAILED', {
        userId: String(user._id),
        reason: err?.code ?? err?.name ?? 'Error',
      });
      invitation = { expiresAt: null, sent: false };
    }

    securityLogger.log('USER_CREATED', {
      userId: String(user._id),
      createdBy: String(actor.userId),
      roles: user.roles,
    });
    return { ...toUserDto(user), invitation };
  }

  /**
   * Status and password changes. Disabling ends the sessions and the pending invitations;
   * an account that was never activated cannot be enabled here (AA06/AA07).
   */
  async function updateUser(id, updateData) {
    const user = await findUser(id);

    const dataToSave = {};
    let revokeSessions = false;
    let disabling = false;

    if (updateData.isActive !== undefined) {
      const decision = evaluateStatusChange(user, updateData.isActive);
      if (!decision.allowed) {
        throw new AppError(
          'The account must be activated through its invitation.',
          409,
          null,
          decision.reason,
        );
      }
      dataToSave.status = decision.status;
      disabling = decision.status !== AccountStatus.ACTIVE;
      revokeSessions ||= disabling;
    }

    if (updateData.password) {
      assertPasswordPolicy(updateData.password);
      dataToSave.passwordHash = await passwordHasher.hash(updateData.password);
      dataToSave.failedLoginCount = 0;
      dataToSave.lockedUntil = null;
      revokeSessions = true;
    }

    if (revokeSessions) dataToSave.tokenVersion = (user.tokenVersion ?? 0) + 1;

    const updatedUser = await usersRepository.update(id, dataToSave);
    if (disabling) await invitationService.revokePending(user._id);
    return toUserDto(updatedUser);
  }

  /**
   * AA06: assigns a role. The change takes effect on the next request (AA03) and never
   * requires a new activation. If it cannot be recorded, it is undone.
   */
  async function addRole(actor, targetId, role) {
    const user = await findUser(targetId);
    const current = user.roles ?? [];
    assertRoleChangeAllowed(actor, targetId, current, [...current, role]);

    const updated = await usersRepository.addRoleIfAbsent(targetId, role);
    if (!updated) return toUserDto(await findUser(targetId)); // already had it: nothing to record

    try {
      await roleChangeRecorder.record({
        userId: targetId,
        role,
        action: RoleChangeAction.ASSIGNED,
        actor: userActor(actor.userId),
      });
    } catch (err) {
      securityLogger.log('ROLE_CHANGE_RECORD_FAILED', {
        userId: String(targetId),
        role,
        operation: 'assign',
        reason: err?.name ?? 'Error',
      });
      await usersRepository.removeRoleIfPresent(targetId, role);
      throw roleRecordUnavailable();
    }
    return toUserDto(updated);
  }

  /**
   * AA06: removes a role. The withdrawn permissions stop on the next request (AA03).
   * The removal is never undone: if the record cannot be written, the security log keeps
   * the actor and the time, and the failure is reported there.
   */
  async function removeRole(actor, targetId, role) {
    const user = await findUser(targetId);
    const current = user.roles ?? [];
    assertRoleChangeAllowed(
      actor,
      targetId,
      current,
      current.filter((r) => r !== role),
    );

    const updated = await usersRepository.removeRoleIfPresent(targetId, role, {
      clearCustomerId: role === Roles.CUSTOMER,
    });
    if (!updated) return toUserDto(await findUser(targetId));

    try {
      await roleChangeRecorder.record({
        userId: targetId,
        role,
        action: RoleChangeAction.REMOVED,
        actor: userActor(actor.userId),
      });
    } catch (err) {
      securityLogger.log('ROLE_CHANGE_RECORD_FAILED', {
        userId: String(targetId),
        role,
        operation: 'remove',
        removedBy: String(actor.userId),
        reason: err?.name ?? 'Error',
      });
    }
    return toUserDto(updated);
  }

  /** Role changes of a user, newest first. */
  async function getRoleHistory(targetId) {
    await findUser(targetId);
    const changes = await roleChangeRecorder.history(targetId);
    return changes.map((change) => ({
      role: change.role,
      action: change.action,
      actor: {
        kind: change.actor?.kind,
        userId: change.actor?.userId ? String(change.actor.userId) : null,
        process: change.actor?.process ?? null,
      },
      at: change.at,
    }));
  }

  /** AA06: replaces the activation invitation of an account that was never activated. */
  async function reissueInvitation(actor, targetId) {
    const user = await findUser(targetId);
    return invitationService.issue(user, { issuedBy: userActor(actor.userId) });
  }

  /** Roles the actor may assign, for the administration page. */
  function listAssignableRoles(actor) {
    return assignableRoles(actor?.permissions ?? []);
  }

  return {
    listUsers,
    getUserById,
    createUser,
    updateUser,
    addRole,
    removeRole,
    getRoleHistory,
    reissueInvitation,
    listAssignableRoles,
  };
}
