import Redis from 'ioredis';
import { createHash } from 'node:crypto';

const PREFIX = 'laprizza';

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false })
  : null;

redis?.on('error', (err) => console.error('[cache] redis:', err.message));

const versionKey = (ns) => `${PREFIX}:ver:${ns}`;

const stable = (_k, v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
    : v;

const hashParts = (parts) =>
  createHash('sha1').update(JSON.stringify(parts, stable)).digest('hex').slice(0, 16);

// TODO(debug): remover os logs [cache:debug] depois do diagnóstico.
const DEBUG_NAMESPACE = 'predefined-pizza';

export async function cached(namespace, parts, ttlSeconds, loader) {
  if (!redis) return loader();

  let key;
  try {
    const version = (await redis.get(versionKey(namespace))) ?? '0';
    key = `${PREFIX}:${namespace}:v${version}:${hashParts(parts)}`;
    const hit = await redis.get(key);
    if (namespace === DEBUG_NAMESPACE) {
      console.log('[cache:debug]', new Date().toISOString(), { parts, version, hit: hit !== null });
    }
    if (hit !== null) return JSON.parse(hit);
  } catch (err) {
    console.error('[cache] read failed:', err.message);
    return loader();
  }

  const value = await loader();
  if (value !== undefined) {
    redis.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch(() => {});
  }
  return value;
}

export async function invalidate(...namespaces) {
  if (!redis) return;
  try {
    const versions = await Promise.all(namespaces.map((ns) => redis.incr(versionKey(ns))));
    if (namespaces.includes(DEBUG_NAMESPACE)) {
      console.log(
        '[cache:debug]',
        new Date().toISOString(),
        'invalidate',
        namespaces,
        '->',
        versions,
      );
    }
  } catch (err) {
    console.error('[cache] invalidate failed:', err.message);
    throw new Error(`Cache invalidation failed: ${err.message}`, { cause: err });
  }
}
