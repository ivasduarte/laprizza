import test from 'node:test';
import assert from 'node:assert/strict';
import {
  kitchenConfigurationApi,
  getKitchenConfigErrorKey,
} from '../../src/features/kitchen-configuration/kitchen-configuration-api.js';
import { api } from '../../src/shared/api/index.js';

test('Kitchen Configuration API Client', async (t) => {
  await t.test('getActive calls the correct endpoint', async (t) => {
    t.mock.method(api, 'get', async (path) => {
      assert.equal(path, '/kitchen-configurations/active');
      return { id: '1', isActive: true };
    });

    const result = await kitchenConfigurationApi.getActive();
    assert.equal(result.id, '1');
    assert.equal(result.isActive, true);
  });

  await t.test('activate performs a PATCH request', async (t) => {
    t.mock.method(api, 'patch', async (path) => {
      assert.equal(path, '/kitchen-configurations/123/activate');
      return { id: '123', isActive: true };
    });

    const result = await kitchenConfigurationApi.activate('123');
    assert.equal(result.isActive, true);
  });

  await t.test('create performs a POST request with payload', async (t) => {
    const payload = { name: 'Test', content: {} };
    t.mock.method(api, 'post', async (path, body) => {
      assert.equal(path, '/kitchen-configurations');
      assert.deepEqual(body, payload);
      return { id: '999', ...body };
    });

    const result = await kitchenConfigurationApi.create(payload);
    assert.equal(result.id, '999');
  });
});

test('getKitchenConfigErrorKey maps HTTP statuses to translation keys without exposing internals', () => {
  assert.equal(
    getKitchenConfigErrorKey({ status: 400 }),
    'kitchenConfig.errors.invalid'
  );
  assert.equal(
    getKitchenConfigErrorKey({ status: 404 }),
    'kitchenConfig.errors.notFound'
  );
  assert.equal(
    getKitchenConfigErrorKey({ status: 409 }),
    'kitchenConfig.errors.conflict'
  );

  // Casos default ou network errors (ex: 500 ou objeto nulo)
  assert.equal(
    getKitchenConfigErrorKey({ status: 500 }),
    'kitchenConfig.errors.default'
  );
  assert.equal(getKitchenConfigErrorKey(null), 'kitchenConfig.errors.default');
  assert.equal(getKitchenConfigErrorKey({}), 'kitchenConfig.errors.default');
});