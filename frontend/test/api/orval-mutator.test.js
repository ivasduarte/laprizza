import test from 'node:test';
import assert from 'node:assert/strict';
import { axiosInstance } from '../../src/api/orval-mutator.js';
import { api } from '../../src/shared/api/index.js';

test('Orval mutator delegates to the shared http client', async (t) => {
  await t.test(
    'maps the generated request config to api.request',
    async (t) => {
      const signal = new AbortController().signal;
      const request = t.mock.method(api, 'request', async () => ({ ok: true }));

      const result = await axiosInstance({
        url: '/products',
        method: 'GET',
        params: { page: 2 },
        signal,
      });

      assert.deepEqual(result, { ok: true });
      assert.deepEqual(request.mock.calls[0].arguments, [
        '/products',
        { method: 'GET', query: { page: 2 }, body: undefined, signal },
      ]);
    }
  );
});
