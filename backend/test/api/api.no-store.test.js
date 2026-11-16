import test from 'node:test';
import assert from 'node:assert/strict';
import { noStore } from '../../src/api/middleware/no-store.js';

test('O middleware noStore define os cabeçalhos anti-cache corretos.', () => {
  const headers = new Map();
  
  // Dummy response object
  const resDummy = {
    setHeader(name, value) {
      headers.set(name, value);
    }
  };

  let nextCalled = false;
  const nextDummy = () => {
    nextCalled = true;
  };

  noStore({}, resDummy, nextDummy);

  assert.equal(headers.get('Cache-Control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
  assert.equal(headers.get('Pragma'), 'no-cache');
  assert.equal(headers.get('Expires'), '0');
  assert.equal(headers.get('Surrogate-Control'), 'no-store');
  assert.equal(nextCalled, true);
});