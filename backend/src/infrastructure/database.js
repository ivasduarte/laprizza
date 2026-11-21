import mongoose from 'mongoose';

/**
 * Connects to MongoDB. The database comes from MONGODB_DB_NAME (the same variable the migrations
 * use, see migrate-mongo-config.js), so staging ("laprizza") and production ("laprizza_prod")
 * can share a MongoDB server.
 *
 * @param {string} uri
 * @param {string} [dbName=process.env.MONGODB_DB_NAME || 'laprizza']
 */
export async function connectDB(uri, dbName = process.env.MONGODB_DB_NAME || 'laprizza') {
  if (!uri) throw new Error('MONGODB_URI is missing');
  await mongoose.connect(uri, { dbName });
  console.log(`Database connection successful (${dbName})`);
}