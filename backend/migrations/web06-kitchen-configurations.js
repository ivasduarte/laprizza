export const up = async (db) => {
  const collection = db.collection('kitchen configurations');
  await collection.createIndex(
    { isActive: 1 },
    {
      unique: true,
      partialFilterExpression: { isActive: true },
      name: 'active_kitchen_config_unique',
    },
  );
};

export const down = async (db) => {
  const collection = db.collection('kitchen configurations');
  if (await collection.indexExists('active_kitchen_config_unique')) {
    await collection.dropIndex('active_kitchen_config_unique');
  }
};