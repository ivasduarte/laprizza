import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI is missing');
  await mongoose.connect(uri, { dbName: 'laprizza' });
  console.log('Database connection successful');
}