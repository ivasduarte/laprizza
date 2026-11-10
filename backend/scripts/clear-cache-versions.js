import Redis from 'ioredis';

if (!process.env.REDIS_URL) {
  console.error('REDIS_URL não está definido.');
  process.exit(1);
}

const redis = new Redis(process.env.REDIS_URL);

try {
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', 'laprizza:ver:*', 'COUNT', 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');

  if (keys.length > 0) await redis.del(...keys);
  console.log(`Apagadas ${keys.length} version keys:`, keys);
} finally {
  redis.disconnect();
}
