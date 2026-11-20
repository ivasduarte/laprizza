import { initialRoleChanges, roleChange } from '../../domain/users/role-changes.domain.js';

/**
 * Writes the AA06 role change records (who, what, when).
 *
 * @param {object} deps
 * @param {object} deps.roleChangesRepository - insertMany, listForUser.
 * @param {{now: () => Date}} deps.clock
 */
export function createRoleChangeRecorder({ roleChangesRepository, clock }) {
  return {
    /** Records the roles of a new account (CUSTOMER by the AA03 process, the rest by `actor`). */
    async recordInitialRoles(user, actor) {
      const changes = initialRoleChanges({
        userId: user._id,
        roles: user.roles ?? [],
        actor,
        at: clock.now(),
      });
      if (changes.length > 0) await roleChangesRepository.insertMany(changes);
    },

    /** Records one assignment or removal. */
    async record({ userId, role, action, actor }) {
      await roleChangesRepository.insertMany([
        roleChange({ userId, role, action, actor, at: clock.now() }),
      ]);
    },

    history(userId) {
      return roleChangesRepository.listForUser(userId);
    },
  };
}
