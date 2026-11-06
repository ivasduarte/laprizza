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

  await t.test('list performs a GET request', async (t) => {
    t.mock.method(api, 'get', async (path) => {
      assert.equal(path, '/kitchen-configurations');
      return [{ id: '1' }];
    });
    const result = await kitchenConfigurationApi.list();
    assert.equal(result.length, 1);
  });

  await t.test('getById performs a GET request', async (t) => {
    t.mock.method(api, 'get', async (path) => {
      assert.equal(path, '/kitchen-configurations/123');
      return { id: '123' };
    });
    const result = await kitchenConfigurationApi.getById('123');
    assert.equal(result.id, '123');
  });

  await t.test('update performs a PATCH request', async (t) => {
    const payload = { name: 'Updated' };
    t.mock.method(api, 'patch', async (path, body) => {
      assert.equal(path, '/kitchen-configurations/123');
      assert.deepEqual(body, payload);
      return { id: '123', ...body };
    });
    const result = await kitchenConfigurationApi.update('123', payload);
    assert.equal(result.name, 'Updated');
  });

  await t.test('remove performs a DELETE request', async (t) => {
    t.mock.method(api, 'delete', async (path) => {
      assert.equal(path, '/kitchen-configurations/123');
      return null;
    });
    const result = await kitchenConfigurationApi.remove('123');
    assert.equal(result, null);
  });

  await t.test('validate performs a POST request', async (t) => {
    const payload = { content: {} };
    t.mock.method(api, 'post', async (path, body) => {
      assert.equal(path, '/kitchen-configurations/validate');
      assert.deepEqual(body, payload);
      return { valid: true };
    });
    const result = await kitchenConfigurationApi.validate(payload);
    assert.equal(result.valid, true);
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