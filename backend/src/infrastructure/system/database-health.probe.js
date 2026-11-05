import mongoose from 'mongoose';

const CONNECTED = 1;
const DEFAULT_TIMEOUT_MS = 2000;

export function createMongooseHealthProbe({
  connection = mongoose.connection,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  return {
    async isHealthy() {
      if (connection.readyState !== CONNECTED || !connection.db) return false;

      let timer;
      const timeout = new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Database ping timed out')), timeoutMs);
      });

      try {
        await Promise.race([connection.db.admin().ping(), timeout]);
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
