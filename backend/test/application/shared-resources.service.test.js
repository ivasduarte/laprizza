import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/application/app-error.js';
import {
  deleteResource,
  getResourcePath,
  listResources,
  saveResource,
} from '../../src/application/shared-resources/shared-resources.service.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const INVALID_NAMES = ['../a.txt', 'a/b.txt', '.hidden.txt', 'script.exe', 'noextension', ''];

const badRequest = (err) => err instanceof AppError && err.status === 400;

const createStorage = () => ({
  list: mock.fn(async () => []),
  findPath: mock.fn(async () => null),
  save: mock.fn(async () => true),
  remove: mock.fn(async () => true),
});

test('listResources returns what the storage lists', async () => {
  const files = [{ name: 'manual.pdf', size: 10, updatedAt: new Date() }];
  const storage = createStorage();
  storage.list.mock.mockImplementation(async () => files);

  assert.deepEqual(await listResources(storage), files);
  assert.equal(storage.list.mock.callCount(), 1);
});

test('getResourcePath validates the name before touching the storage', async () => {
  const storage = createStorage();

  for (const name of INVALID_NAMES) {
    await assert.rejects(async () => await getResourcePath(name, storage), badRequest);
  }
  assert.equal(storage.findPath.mock.callCount(), 0);
});

test('getResourcePath returns the path or 404 when the file does not exist', async () => {
  const storage = createStorage();

  await assert.rejects(
    async () => await getResourcePath('manual.txt', storage),
    (err) => err instanceof AppError && err.status === 404,
  );

  storage.findPath.mock.mockImplementation(async () => '/srv/laprizza-shared/manual.txt');
  assert.equal(await getResourcePath('manual.txt', storage), '/srv/laprizza-shared/manual.txt');
  assert.equal(storage.findPath.mock.calls[1].arguments[0], 'manual.txt');
});

test('saveResource validates name, content and size before storing', async () => {
  const storage = createStorage();
  const content = Buffer.from('conteudo');

  for (const name of INVALID_NAMES) {
    await assert.rejects(async () => await saveResource(name, content, storage), badRequest);
  }
  for (const invalid of [Buffer.alloc(0), 'texto', undefined, {}]) {
    await assert.rejects(async () => await saveResource('a.txt', invalid, storage), badRequest);
  }
  await assert.rejects(
    async () => await saveResource('a.txt', Buffer.alloc(MAX_FILE_SIZE + 1), storage),
    (err) => err instanceof AppError && err.status === 413,
  );

  assert.equal(storage.save.mock.callCount(), 0);
});

test('saveResource stores the file and reports whether it was created or replaced', async () => {
  const storage = createStorage();
  const content = Buffer.from('abc');

  const created = await saveResource('manual.pdf', content, storage);
  assert.deepEqual(created, { name: 'manual.pdf', size: 3, created: true });
  assert.equal(storage.save.mock.calls[0].arguments[0], 'manual.pdf');
  assert.equal(storage.save.mock.calls[0].arguments[1], content);

  storage.save.mock.mockImplementation(async () => false);
  const replaced = await saveResource('manual.pdf', content, storage);
  assert.equal(replaced.created, false);
});

test('saveResource accepts the maximum size and upper-case extensions', async () => {
  const storage = createStorage();

  const result = await saveResource('MANUAL.PDF', Buffer.alloc(MAX_FILE_SIZE), storage);
  assert.equal(result.size, MAX_FILE_SIZE);
  assert.equal(storage.save.mock.callCount(), 1);
});

test('deleteResource validates the name and reports files that do not exist', async () => {
  const storage = createStorage();

  for (const name of INVALID_NAMES) {
    await assert.rejects(async () => await deleteResource(name, storage), badRequest);
  }
  assert.equal(storage.remove.mock.callCount(), 0);

  storage.remove.mock.mockImplementation(async () => false);
  await assert.rejects(
    async () => await deleteResource('manual.txt', storage),
    (err) => err instanceof AppError && err.status === 404,
  );
});

test('deleteResource removes an existing file', async () => {
  const storage = createStorage();

  await deleteResource('manual.txt', storage);
  assert.equal(storage.remove.mock.callCount(), 1);
  assert.equal(storage.remove.mock.calls[0].arguments[0], 'manual.txt');
});

test('saveResource accepts accented names and stores them normalized (NFC)', async () => {
  const storage = createStorage();
  const decomposed = 'relato\u0301rio de operac\u0327o\u0303es.pdf'; // NFD, como em alguns sistemas
  const composed = 'relatório de operações.pdf';

  const result = await saveResource(decomposed, Buffer.from('abc'), storage);
  assert.equal(result.name, composed);
  assert.equal(storage.save.mock.calls[0].arguments[0], composed);
});

test('saveResource rejects names longer than the file system allows', async () => {
  const storage = createStorage();
  const tooManyBytes = `${'界'.repeat(90)}.txt`; // 94 caracteres, mas mais de 255 bytes

  await assert.rejects(
    async () => await saveResource(tooManyBytes, Buffer.from('abc'), storage),
    badRequest,
  );
  assert.equal(storage.save.mock.callCount(), 0);
});
