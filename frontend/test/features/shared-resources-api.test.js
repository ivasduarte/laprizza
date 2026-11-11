import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedResourcesApi } from '../../src/features/shared-resources/shared-resources.api.js';
import {
  formatSize,
  getSharedResourcesErrorKey,
  validateUpload,
  MAX_FILE_SIZE,
} from '../../src/features/shared-resources/shared-resources.utils.js';
import { ApiError } from '../../src/shared/api/http-client.js';
import { sessionStore } from '../../src/shared/auth/session-store.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function mockFetch(t, ...responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  return calls;
}


test('Shared Resources API Client', async (t) => {
  sessionStore.start({
    accessToken: 'token-123',
    user: { id: '1', role: 'MANAGER' },
  });

  await t.test(
    'list sends the session token and returns the list',
    async (t) => {
      const files = [
        { name: 'manual.pdf', size: 10, updatedAt: '2026-11-07T10:00:00Z' },
      ];
      const calls = mockFetch(t, json(files));
      const controller = new AbortController();

      const result = await sharedResourcesApi.list(controller.signal);

      assert.deepEqual(result, files);
      assert.ok(calls[0].url.endsWith('/shared-resources'));
      assert.equal(calls[0].options.method, 'GET');
      assert.equal(calls[0].options.headers.Authorization, 'Bearer token-123');
      // WEB04: the client combines the caller's signal with its timeout, so fetch receives a
      // derived AbortSignal (abort propagation is tested in http-client-feedback.test.js).
      assert.ok(calls[0].options.signal instanceof AbortSignal);
      assert.equal(calls[0].options.signal.aborted, false);
    }
  );

  await t.test(
    'download encodes the file name and returns the content as a Blob',
    async (t) => {
      const calls = mockFetch(t, new Response('conteudo', { status: 200 }));

      const blob = await sharedResourcesApi.download('my file.txt');

      assert.ok(calls[0].url.endsWith('/shared-resources/my%20file.txt'));
      assert.ok(blob instanceof Blob);
      assert.equal(await blob.text(), 'conteudo');
    }
  );

  await t.test(
    'upload performs a PUT with the raw file and reports created/replaced',
    async (t) => {
      const file = new Blob(['x']);
      const calls = mockFetch(
        t,
        json({ name: 'a.txt', size: 1 }, 201),
        json({ name: 'a.txt', size: 1 }, 200)
      );

      assert.equal(await sharedResourcesApi.upload('a.txt', file), 'created');
      assert.equal(await sharedResourcesApi.upload('a.txt', file), 'replaced');
      assert.equal(calls[0].options.method, 'PUT');
      assert.equal(
        calls[0].options.headers['Content-Type'],
        'application/octet-stream'
      );
      assert.equal(
        calls[0].options.body,
        file,
        'the file must be sent as-is, not JSON-serialized'
      );
    }
  );

  await t.test('remove performs a DELETE request', async (t) => {
    const calls = mockFetch(t, new Response(null, { status: 204 }));

    await sharedResourcesApi.remove('a.txt');

    assert.equal(calls[0].options.method, 'DELETE');
    assert.ok(calls[0].url.endsWith('/shared-resources/a.txt'));
  });

  await t.test(
    'an error response becomes an ApiError with its status and code',
    async (t) => {
      mockFetch(
        t,
        json({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }, 403)
      );

      await assert.rejects(
        sharedResourcesApi.upload('a.txt', new Blob(['x'])),
        (err) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.code, 'FORBIDDEN');
          return err.status === 403;
        }
      );
    }
  );

  await t.test(
    'a download error is read as JSON, not returned as a Blob',
    async (t) => {
      mockFetch(
        t,
        json(
          { error: { code: 'NOT_FOUND', message: 'Resource not found.' } },
          404
        )
      );

      await assert.rejects(sharedResourcesApi.download('a.txt'), (err) => {
        assert.ok(err instanceof ApiError);
        return err.status === 404;
      });
    }
  );

  await t.test(
    'a network failure becomes an ApiError with status 0',
    async (t) => {
      mockFetch(t, new TypeError('fetch failed'));

      await assert.rejects(
        sharedResourcesApi.list(),
        (err) => err.status === 0
      );
    }
  );

  await t.test(
    'an expired token renews the session once and repeats the request',
    async (t) => {
      t.mock.method(sessionStore, 'refresh', async () => true);
      const calls = mockFetch(
        t,
        json({ error: { code: 'TOKEN_EXPIRED' } }, 401),
        json([])
      );

      assert.deepEqual(await sharedResourcesApi.list(), []);
      assert.equal(calls.length, 2);
    }
  );

  await t.test('the retried upload keeps sending the raw file', async (t) => {
    t.mock.method(sessionStore, 'refresh', async () => true);
    const file = new Blob(['x']);
    const calls = mockFetch(
      t,
      json({ error: { code: 'TOKEN_EXPIRED' } }, 401),
      json({ name: 'a.txt', size: 1 }, 201)
    );

    assert.equal(await sharedResourcesApi.upload('a.txt', file), 'created');
    assert.equal(calls[1].options.body, file);
    assert.equal(
      calls[1].options.headers['Content-Type'],
      'application/octet-stream'
    );
  });

  await t.test(
    'an expired token without a valid refresh ends the session as expired',
    async (t) => {
      t.mock.method(sessionStore, 'refresh', async () => false);
      const end = t.mock.method(sessionStore, 'end', () => {});
      mockFetch(t, json({ error: { code: 'TOKEN_EXPIRED' } }, 401));

      await assert.rejects(
        sharedResourcesApi.list(),
        (err) => err.status === 401
      );
      assert.deepEqual(end.mock.calls[0].arguments, [{ expired: true }]);
    }
  );

  await t.test(
    'a 401 that is not TOKEN_EXPIRED ends the session without refreshing',
    async (t) => {
      const refresh = t.mock.method(sessionStore, 'refresh', async () => true);
      const end = t.mock.method(sessionStore, 'end', () => {});
      const calls = mockFetch(
        t,
        json({ error: { code: 'SESSION_REVOKED' } }, 401)
      );

      await assert.rejects(
        sharedResourcesApi.list(),
        (err) => err.status === 401
      );
      assert.equal(refresh.mock.callCount(), 0);
      assert.equal(calls.length, 1);
      assert.deepEqual(end.mock.calls[0].arguments, [{ expired: true }]);
    }
  );

  sessionStore.end();
});


test('getSharedResourcesErrorKey maps HTTP statuses to translation keys without exposing internals', () => {
  assert.equal(
    getSharedResourcesErrorKey({ status: 0 }),
    'sharedResources.err.network'
  );
  assert.equal(
    getSharedResourcesErrorKey({ status: 400 }),
    'sharedResources.err.invalid'
  );
  assert.equal(
    getSharedResourcesErrorKey({ status: 401 }),
    'sharedResources.err.session'
  );
  assert.equal(
    getSharedResourcesErrorKey({ status: 403 }),
    'sharedResources.err.forbidden'
  );
  assert.equal(
    getSharedResourcesErrorKey({ status: 404 }),
    'sharedResources.err.notFound'
  );
  assert.equal(
    getSharedResourcesErrorKey({ status: 413 }),
    'sharedResources.err.tooLarge'
  );
  assert.equal(
    getSharedResourcesErrorKey({ status: 500 }),
    'sharedResources.err.generic'
  );
  assert.equal(getSharedResourcesErrorKey(null), 'sharedResources.err.generic');
  assert.equal(getSharedResourcesErrorKey({}), 'sharedResources.err.generic');
});

test('validateUpload accepts a valid file', () => {
  assert.equal(validateUpload('manual.pdf', { size: 100 }), null);
  assert.equal(validateUpload('MANUAL.PDF', { size: 100 }), null);
  assert.equal(
    validateUpload('relatório de operações.pdf', { size: 100 }),
    null
  );
  assert.equal(validateUpload('relatório.pdf', { size: 100 }), null);
});

test('validateUpload rejects invalid uploads with the matching message key', () => {
  assert.equal(validateUpload('a.txt', null), 'sharedResources.err.noFile');
  assert.equal(
    validateUpload('a.txt', { size: 0 }),
    'sharedResources.err.empty'
  );
  assert.equal(
    validateUpload('a.txt', { size: MAX_FILE_SIZE + 1 }),
    'sharedResources.err.tooLarge'
  );
  assert.equal(
    validateUpload('../a.txt', { size: 1 }),
    'sharedResources.err.name'
  );
  assert.equal(
    validateUpload('.hidden.txt', { size: 1 }),
    'sharedResources.err.name'
  );
  assert.equal(
    validateUpload(`${'界'.repeat(90)}.txt`, { size: 1 }),
    'sharedResources.err.name'
  );
  assert.equal(
    validateUpload('script.exe', { size: 1 }),
    'sharedResources.err.type'
  );
  assert.equal(
    validateUpload('noextension', { size: 1 }),
    'sharedResources.err.type'
  );
});

test('validateUpload rejects names that suggest personal or sensitive data', () => {
  const file = { size: 1 };
  for (const name of [
    'Clientes Maria.xlsx',
    'CLIENTES.xlsx',
    'customer-list.xlsx',
    'lista 912345678.xlsx',
    'Backup_BD.docx',
    'credenciais.txt',
    'Palavra-Passe.md',
    'palavra_passe.txt',
    'perfis_alimentares.docx',
    'Dietary Profiles.pdf',
  ]) {
    assert.equal(
      validateUpload(name, file),
      'sharedResources.err.personalData',
      name
    );
  }
});

test('validateUpload still accepts dates and neutral names', () => {
  const file = { size: 1 };
  assert.equal(validateUpload('relatorio_2026-11-09.pdf', file), null);
  assert.equal(validateUpload('fatura 20261109.pdf', file), null);
  assert.equal(validateUpload('Relatório Operações.pdf', file), null);
  assert.equal(validateUpload('alergenios do menu.pdf', file), null);
});

test('formatSize shows bytes, KB and MB', () => {
  assert.equal(formatSize(500), '500 B');
  assert.equal(formatSize(2048), '2.0 KB');
  assert.equal(formatSize(5 * 1024 * 1024), '5.0 MB');
});
