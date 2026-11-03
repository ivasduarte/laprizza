const NEW_COLLECTIONS = ['Auth Sessions', 'Password Reset Tokens', 'Login Throttles'];

export const up = async (db) => {
  const users = db.collection('users');

  await users.updateMany(
    { status: { $exists: false }, isActive: false },
    { $set: { status: 'disabled' } },
  );
  await users.updateMany({ status: { $exists: false } }, { $set: { status: 'active' } });
  await users.updateMany(
    { password: { $exists: true }, passwordHash: { $exists: false } },
    { $rename: { password: 'passwordHash' } },
  );
  await users.updateMany({ tokenVersion: { $exists: false } }, { $set: { tokenVersion: 0 } });
  await users.updateMany(
    { failedLoginCount: { $exists: false } },
    { $set: { failedLoginCount: 0 } },
  );
  await users.updateMany({ lockedUntil: { $exists: false } }, { $set: { lockedUntil: null } });
  await users.updateMany({ isActive: { $exists: true } }, { $unset: { isActive: '' } });

  await users.createIndex({ email: 1 }, { unique: true, sparse: true });

  const sessions = db.collection('Auth Sessions');
  await sessions.createIndex({ refreshTokenHash: 1 }, { unique: true });
  await sessions.createIndex({ rotatedHashes: 1 });
  await sessions.createIndex({ userId: 1 });
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const resetTokens = db.collection('Password Reset Tokens');
  await resetTokens.createIndex({ tokenHash: 1 }, { unique: true });
  await resetTokens.createIndex({ userId: 1 });
  await resetTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const throttles = db.collection('Login Throttles');
  await throttles.createIndex({ keyHash: 1 }, { unique: true });
  await throttles.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  const withoutEmail = await users
    .find(
      { $or: [{ email: { $exists: false } }, { email: null }, { email: '' }] },
      { projection: { username: 1 } },
    )
    .toArray();
  if (withoutEmail.length > 0) {
    console.warn(
      `[AA01] ${withoutEmail.length} account(s) without email cannot log in until an email is set:`,
      withoutEmail.map((u) => `${u._id} (${u.username ?? '-'})`).join(', '),
    );
  }
};

export const down = async (db) => {
  const users = db.collection('users');

  await users.updateMany({ status: { $exists: true } }, [
    { $set: { isActive: { $eq: ['$status', 'active'] } } },
  ]);
  await users.updateMany(
    { passwordHash: { $exists: true }, password: { $exists: false } },
    { $rename: { passwordHash: 'password' } },
  );
  await users.updateMany(
    {},
    { $unset: { status: '', tokenVersion: '', failedLoginCount: '', lockedUntil: '' } },
  );

  for (const name of NEW_COLLECTIONS) {
    if (await db.listCollections({ name }).hasNext()) await db.collection(name).drop();
  }
};
