const SCENARIOS = 'AI BOM Scenarios';
const CODE_INDEX = 'code_1'; // same name Mongoose gives to the unique index declared in the model.

async function collectionExists(db, name) {
  return db.listCollections({ name }, { nameOnly: true }).hasNext();
}

export const up = async (db) => {
  if (!(await collectionExists(db, SCENARIOS))) await db.createCollection(SCENARIOS);
  await db.collection(SCENARIOS).createIndex({ code: 1 }, { unique: true, name: CODE_INDEX });

  await db
    .collection('products')
    .updateMany({ aggregate: { $exists: false } }, { $set: { aggregate: null } });
};

export const down = async (db) => {
  if (await collectionExists(db, SCENARIOS)) await db.collection(SCENARIOS).drop();

  await db
    .collection('products')
    .updateMany({ aggregate: { $exists: true } }, { $unset: { aggregate: '' } });
};
