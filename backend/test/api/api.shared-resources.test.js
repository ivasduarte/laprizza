import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp, loadConfig } from '../../src/index.js';
import { passwordHasher } from '../../src/infrastructure/security/password-hasher.js';

process.env.JWT_SECRET = 'test_secret_key';

const PASSWORD = 'StrongPassword123!';
// Same hasher the API uses by default to verify passwords at login.
const PASSWORD_HASH = await passwordHasher.hash(PASSWORD);

const USERS = [
  { _id: 'abcdef000000000000000001', email: 'admin@laprizza.pt', role: 'MANAGER' },
  { _id: 'abcdef000000000000000002', email: 'emp@laprizza.pt', role: 'EMPLOYEE' },
].map((user) => ({
  ...user,
  status: 'active',
  passwordHash: PASSWORD_HASH,
  failedLoginCount: 0,
  lockedUntil: null,
  tokenVersion: 0,
}));

/** Mocked users repository and auth infrastructure: just enough to log in through the API. */
function createAuthMocks() {
  const userById = (id) => USERS.find((u) => u._id === String(id)) ?? null;
  return {
    usersRepository: {
      findByEmailWithPasswordHash: mock.fn(
        async (email) => USERS.find((u) => u.email === email) ?? null,
      ),
      findById: mock.fn(async (id) => userById(id)),
    },
    // One always-active session per user (session id = user id).
    sessionsRepository: {
      create: mock.fn(async (data) => ({ _id: String(data.userId), ...data })),
      findById: mock.fn(async (id) =>
        userById(id)
          ? {
              _id: id,
              userId: id,
              tokenVersion: 0,
              expiresAt: new Date(Date.now() + 3_600_000),
              revokedAt: null,
            }
          : null,
      ),
    },
    securityLogger: { log: mock.fn() },
  };
}

async function setupTestServer() {
  const authMocks = createAuthMocks();
  // Nothing exists until a test programs the answers of each step.
  const storage = {
    list: mock.fn(async () => []),
    findPath: mock.fn(async () => null),
    save: mock.fn(async () => true),
    remove: mock.fn(async () => true),
  };
  const server = createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test' }), {
    ...authMocks,
    sharedResourcesStorage: storage,
  }).listen(0);

  await once(server, 'listening');
  const port = server.address().port;

  return { server, port, storage, securityLogger: authMocks.securityLogger };
}

async function loginAs(port, email) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const { accessToken: token } = await res.json();
  return (method, requestPath, { body, contentType = 'application/octet-stream' } = {}) =>
    fetch(`http://127.0.0.1:${port}/api/v1${requestPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': contentType }),
      },
      body,
    });
}

const auditEntries = (securityLogger) =>
  securityLogger.log.mock.calls
    .filter((call) => call.arguments[0] === 'SHARED_RESOURCE_ACCESS')
    .map((call) => call.arguments[1]);

test('API /shared-resources requires authentication', async (t) => {
  const { server, port, storage } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const base = `http://127.0.0.1:${port}/api/v1/shared-resources`;

  const list = await fetch(base);
  assert.equal(list.status, 401);

  const put = await fetch(`${base}/manual.txt`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: 'conteudo',
  });
  assert.equal(put.status, 401);

  const remove = await fetch(`${base}/manual.txt`, { method: 'DELETE' });
  assert.equal(remove.status, 401);

  assert.equal(storage.list.mock.callCount(), 0);
  assert.equal(storage.save.mock.callCount(), 0);
  assert.equal(storage.remove.mock.callCount(), 0);
});

test('API /shared-resources RBAC: any authenticated user reads, only MANAGER writes', async (t) => {
  const { server, port, storage } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  storage.list.mock.mockImplementation(async () => [
    { name: 'manual.pdf', size: 10, updatedAt: new Date('2026-11-01T10:00:00Z') },
  ]);

  const empRequest = await loginAs(port, 'emp@laprizza.pt');
  const managerRequest = await loginAs(port, 'admin@laprizza.pt');

  const listEmp = await empRequest('GET', '/shared-resources');
  assert.equal(listEmp.status, 200);
  const files = await listEmp.json();
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'manual.pdf');
  assert.equal(files[0].size, 10);

  const putEmp = await empRequest('PUT', '/shared-resources/manual.txt', { body: 'conteudo' });
  assert.equal(putEmp.status, 403);
  const deleteEmp = await empRequest('DELETE', '/shared-resources/manual.txt');
  assert.equal(deleteEmp.status, 403);
  assert.equal(storage.save.mock.callCount(), 0);
  assert.equal(storage.remove.mock.callCount(), 0);

  const putManager = await managerRequest('PUT', '/shared-resources/manual.txt', {
    body: 'conteudo',
  });
  assert.equal(putManager.status, 201);
  assert.equal(storage.save.mock.callCount(), 1);
});

test('API /shared-resources upload creates or replaces and validates the request', async (t) => {
  const { server, port, storage } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const created = await request('PUT', '/shared-resources/manual.txt', { body: 'conteudo' });
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { name: 'manual.txt', size: 8 });
  const [savedName, savedContent] = storage.save.mock.calls[0].arguments;
  assert.equal(savedName, 'manual.txt');
  assert.ok(Buffer.isBuffer(savedContent));
  assert.equal(savedContent.toString(), 'conteudo');

  // Step: a file with that name already exists.
  storage.save.mock.mockImplementationOnce(async () => false);
  const replaced = await request('PUT', '/shared-resources/manual.txt', { body: 'novo' });
  assert.equal(replaced.status, 200);

  const accented = await request(
    'PUT',
    `/shared-resources/${encodeURIComponent('relatório.pdf')}`,
    {
      body: 'abc',
    },
  );
  assert.equal(accented.status, 201);
  assert.equal(storage.save.mock.calls.at(-1).arguments[0], 'relatório.pdf');

  const callsBefore = storage.save.mock.callCount();

  for (const name of ['script.exe', 'noextension', '.hidden.txt', '..%2F..%2Fetc%2Fpasswd']) {
    const res = await request('PUT', `/shared-resources/${name}`, { body: 'x' });
    assert.equal(res.status, 400, name);
  }

  const emptyBody = await request('PUT', '/shared-resources/empty.txt', { body: '' });
  assert.equal(emptyBody.status, 400);

  const wrongType = await request('PUT', '/shared-resources/a.txt', {
    body: '{}',
    contentType: 'application/json',
  });
  assert.equal(wrongType.status, 400);

  assert.equal(storage.save.mock.callCount(), callsBefore);
});

test('API /shared-resources download returns the file or an error', async (t) => {
  const { server, port, storage } = await setupTestServer();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'laprizza-shared-'));
  t.after(async () => {
    server.close();
    server.closeAllConnections();
    await fs.rm(dir, { recursive: true, force: true });
  });

  const filePath = path.join(dir, 'manual.txt');
  await fs.writeFile(filePath, 'conteudo do manual');
  storage.findPath.mock.mockImplementation(async (name) =>
    name === 'manual.txt' ? filePath : null,
  );

  const request = await loginAs(port, 'emp@laprizza.pt');

  const ok = await request('GET', '/shared-resources/manual.txt');
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), 'conteudo do manual');
  assert.equal(ok.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(ok.headers.get('content-disposition').includes('manual.txt'));

  const missing = await request('GET', '/shared-resources/other.txt');
  assert.equal(missing.status, 404);

  const invalid = await request('GET', '/shared-resources/..%2Fsecret.txt');
  assert.equal(invalid.status, 400);
  assert.equal(storage.findPath.mock.callCount(), 2); // the invalid name never reached the storage
});

test('API /shared-resources delete removes the file or reports it missing', async (t) => {
  const { server, port, storage } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const request = await loginAs(port, 'admin@laprizza.pt');

  const removed = await request('DELETE', '/shared-resources/manual.txt');
  assert.equal(removed.status, 204);
  assert.equal(storage.remove.mock.calls[0].arguments[0], 'manual.txt');

  storage.remove.mock.mockImplementation(async () => false);
  const missing = await request('DELETE', '/shared-resources/manual.txt');
  assert.equal(missing.status, 404);

  const invalid = await request('DELETE', '/shared-resources/script.exe');
  assert.equal(invalid.status, 400);
  assert.equal(storage.remove.mock.callCount(), 2); // the invalid name never reached the storage
});

test('API /shared-resources records every access in the security log', async (t) => {
  const { server, port, storage, securityLogger } = await setupTestServer();
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });

  const empRequest = await loginAs(port, 'emp@laprizza.pt');
  const managerRequest = await loginAs(port, 'admin@laprizza.pt');

  await managerRequest('GET', '/shared-resources');
  await managerRequest('PUT', '/shared-resources/manual.txt', { body: 'conteudo' });
  storage.remove.mock.mockImplementation(async () => false);
  await managerRequest('DELETE', '/shared-resources/missing.txt');

  const pick = ({ action, file, result }) => ({ action, file, result });
  const entries = auditEntries(securityLogger);
  assert.deepEqual(entries.map(pick), [
    { action: 'LIST', file: null, result: 'OK' },
    { action: 'UPLOAD', file: 'manual.txt', result: 'OK' },
    { action: 'DELETE', file: 'missing.txt', result: 'ERROR_404' },
  ]);
  assert.ok(entries.every((entry) => entry.userId));

  // A denied write is recorded by the authentication layer, never as a folder operation.
  const before = auditEntries(securityLogger).length;
  const denied = await empRequest('PUT', '/shared-resources/manual.txt', { body: 'x' });
  assert.equal(denied.status, 403);
  assert.equal(auditEntries(securityLogger).length, before);
  assert.ok(
    securityLogger.log.mock.calls.some(
      (call) =>
        call.arguments[0] === 'ACCESS_DENIED' && call.arguments[1].reason === 'INSUFFICIENT_ROLE',
    ),
  );
});
