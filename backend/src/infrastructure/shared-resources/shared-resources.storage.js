import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function baseDir() {
  if (!process.env.SHARED_DIR) {
    throw new Error('SHARED_DIR is not configured: set it to the shared folder path.');
  }
  return path.resolve(process.env.SHARED_DIR);
}
const fullPath = (name) => path.join(baseDir(), name);

let ensuredDir = null;
async function ensureBaseDir() {
  const dir = baseDir();
  if (ensuredDir !== dir) {
    await fs.mkdir(dir, { recursive: true });
    ensuredDir = dir;
  }
  return dir;
}

export async function list() {
  const entries = await fs.readdir(await ensureBaseDir(), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const stats = await fs.stat(fullPath(entry.name));
    files.push({ name: entry.name, size: stats.size, updatedAt: stats.mtime });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function findPath(name) {
  try {
    const stats = await fs.stat(fullPath(name));
    return stats.isFile() ? fullPath(name) : null;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function save(name, content) {
  await ensureBaseDir();
  const created = (await findPath(name)) === null;
  const tmp = fullPath(`.${randomUUID()}.tmp`);
  await fs.writeFile(tmp, content);
  await fs.rename(tmp, fullPath(name));
  return created;
}

export async function remove(name) {
  try {
    await fs.unlink(fullPath(name));
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}
