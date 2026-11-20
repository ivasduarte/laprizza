/**
 * AA06: Administrator role, role change records and activation invitations.
 *
 * up:
 * - accounts that were already usable (active or disabled) are marked as activated, so an
 *   Administrator can re-enable them; accounts still inactive wait for their invitation;
 * - if no account has ADMINISTRATOR, the first Manager (the seeded admin@laprizza.pt when it
 *   exists) receives it, and the assignment is recorded as made by this migration;
 * - indexes of "Role Changes" and "Activation Invitations".
 * down: removes the ADMINISTRATOR roles granted here, their records and the activatedAt field.
 * The collections are kept (they hold the history of the changes made meanwhile).
 */
const USERS = 'users';
const ROLE_CHANGES = 'Role Changes';
const INVITATIONS = 'Activation Invitations';
const PROCESS = 'migration-aa06';
const SEEDED_ADMIN_EMAIL = 'admin@laprizza.pt';

export const up = async (db) => {
  const users = db.collection(USERS);
  const now = new Date();

  await users.updateMany(
    { activatedAt: { $exists: false }, status: { $in: ['active', 'disabled'] } },
    { $set: { activatedAt: now } },
  );
  await users.updateMany({ activatedAt: { $exists: false } }, { $set: { activatedAt: null } });

  const roleChanges = db.collection(ROLE_CHANGES);
  await roleChanges.createIndex({ userId: 1, at: -1 });

  const invitations = db.collection(INVITATIONS);
  await invitations.createIndex({ tokenHash: 1 }, { unique: true });
  await invitations.createIndex({ userId: 1 });
  await invitations.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  if (await users.findOne({ roles: 'ADMINISTRATOR' }, { projection: { _id: 1 } })) return;

  const target =
    (await users.findOne({ email: SEEDED_ADMIN_EMAIL, roles: 'MANAGER' })) ??
    (await users.findOne({ roles: 'MANAGER', status: 'active' }, { sort: { _id: 1 } }));
  if (!target) {
    console.warn('[AA06] No Manager found: the seeder creates the first Administrator on start.');
    return;
  }

  await users.updateOne({ _id: target._id }, { $addToSet: { roles: 'ADMINISTRATOR' } });
  await roleChanges.insertOne({
    userId: target._id,
    role: 'ADMINISTRATOR',
    action: 'ASSIGNED',
    actor: { kind: 'SYSTEM', userId: null, process: PROCESS },
    at: now,
  });
  console.log(`[AA06] ADMINISTRATOR assigned to ${target.email}.`);
};

export const down = async (db) => {
  const users = db.collection(USERS);
  const roleChanges = db.collection(ROLE_CHANGES);

  const granted = await roleChanges
    .find({ 'actor.process': PROCESS, role: 'ADMINISTRATOR', action: 'ASSIGNED' })
    .toArray();
  for (const change of granted) {
    await users.updateOne({ _id: change.userId }, { $pull: { roles: 'ADMINISTRATOR' } });
  }
  await roleChanges.deleteMany({ 'actor.process': PROCESS });
  await users.updateMany({}, { $unset: { activatedAt: '' } });

  const others = await users.countDocuments({ roles: 'ADMINISTRATOR' });
  if (others > 0) {
    console.warn(
      `[AA06] ${others} account(s) still have ADMINISTRATOR (assigned after the migration). ` +
        'The previous schema does not accept that role: remove it before starting the old version.',
    );
  }
};
