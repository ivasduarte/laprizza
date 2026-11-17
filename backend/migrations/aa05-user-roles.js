const DOWN_PRIORITY = ['MANAGER', 'EMPLOYEE', 'CUSTOMER'];

export const up = async (db) => {
  const users = db.collection('users');

  await users.updateMany({ roles: { $exists: false }, role: { $type: 'string', $ne: '' } }, [
    { $set: { roles: ['$role'] } },
  ]);

  await users.updateMany({ roles: { $exists: false } }, { $set: { roles: [] } });
  await users.updateMany({ role: { $exists: true } }, { $unset: { role: '' } });

  await users.createIndex({ roles: 1 });
};

export const down = async (db) => {
  const users = db.collection('users');
  const lossy = [];

  const cursor = users.find({ roles: { $exists: true } }, { projection: { roles: 1 } });
  for await (const user of cursor) {
    const roles = Array.isArray(user.roles) ? user.roles : [];
    const role = DOWN_PRIORITY.find((r) => roles.includes(r));
    if (roles.length !== 1) lossy.push(`${user._id} [${roles.join(', ') || '-'}]`);

    await users.updateOne(
      { _id: user._id },
      role ? { $set: { role }, $unset: { roles: '' } } : { $unset: { roles: '' } },
    );
  }

  if (await users.indexExists('roles_1')) await users.dropIndex('roles_1');

  if (lossy.length > 0) {
    console.warn(
      `[AA05] ${lossy.length} account(s) did not have exactly one role; kept the most privileged one ` +
        '(accounts without roles have no role and cannot be saved by the old schema):',
      lossy.join(', '),
    );
  }
};
