const COLLECTION = 'External Identities';

export const up = async (db) => {
  const identities = db.collection(COLLECTION);
  await identities.createIndex({ issuer: 1, subject: 1 }, { unique: true });
  await identities.createIndex({ userId: 1, provider: 1 }, { unique: true });
};

export const down = async (db) => {
  if (await db.listCollections({ name: COLLECTION }).hasNext()) await db.collection(COLLECTION).drop();
};
