import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { MongoDBContainer } from '@testcontainers/mongodb';
import mongoose from 'mongoose';
import { connectDB } from '../../src/infrastructure/database.js';

const execFileAsync = promisify(execFile);
const BACKEND_DIR = fileURLToPath(new URL('../../', import.meta.url));
const MIGRATE_MONGO_BIN = 'node_modules/migrate-mongo/bin/migrate-mongo.js';
const MONGO_IMAGE = 'mongo:8.0';
const DB_NAME = 'laprizza';

export const STARTUP_TIMEOUT_MS = 180_000;
const MAX_LOG_CHUNKS = 100;

export async function startMongo() {
  const recentLogs = [];
  const keepRecentLogs = (stream) => {
    stream.on('data', (chunk) => {
      recentLogs.push(String(chunk));
      if (recentLogs.length > MAX_LOG_CHUNKS) recentLogs.shift();
    });
  };
  const printRecentLogs = () => {
    console.error(`Last logs of the MongoDB container:\n${recentLogs.join('')}`);
  };
  let container;
  try {
    container = await new MongoDBContainer(MONGO_IMAGE).withLogConsumer(keepRecentLogs).start();
  } catch (error) {
    printRecentLogs();
    throw error;
  }
  try {
    const uri = `${container.getConnectionString().replace(/\/+$/, '')}/?directConnection=true`;
    try {
      await execFileAsync(process.execPath, [MIGRATE_MONGO_BIN, 'up'], {
        cwd: BACKEND_DIR,
        env: { ...process.env, MONGODB_URI: uri, MONGODB_DB_NAME: DB_NAME },
      });
    } catch (error) {
      throw new Error(`migrate-mongo up failed:\n${error.stderr || error.message}`, {
        cause: error,
      });
    }
    await connectDB(uri);
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    return {
      uri,
      async stop() {
        await mongoose.disconnect();
        await container.stop();
      },
    };
  } catch (error) {
    await mongoose.disconnect();
    await container.stop();
    throw error;
  }
}
