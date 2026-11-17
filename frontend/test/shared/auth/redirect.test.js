import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirectPath } from '../../../src/shared/auth/redirect.js';

describe('Safe redirect after login (AA04)', () => {
  it('accepts absolute paths of the app, with query', () => {
    assert.equal(safeRedirectPath('/ai'), '/ai');
    assert.equal(
      safeRedirectPath('/shared-resources?page=2'),
      '/shared-resources?page=2'
    );
  });

  it('falls back to the home page for missing or non-string values', () => {
    assert.equal(safeRedirectPath(undefined), '/');
    assert.equal(safeRedirectPath(null), '/');
    assert.equal(safeRedirectPath({ to: '/ai' }), '/');
    assert.equal(safeRedirectPath('', '/home'), '/home');
  });

  it('rejects other origins and protocol-relative URLs', () => {
    assert.equal(safeRedirectPath('https://evil.example/'), '/');
    assert.equal(safeRedirectPath('//evil.example'), '/');
    assert.equal(safeRedirectPath('/\\evil.example'), '/');
    assert.equal(safeRedirectPath('javascript:alert(1)'), '/');
  });

  it('rejects control characters', () => {
    assert.equal(safeRedirectPath('/ai\n/evil'), '/');
    assert.equal(safeRedirectPath('/ai\u0000'), '/');
  });

  it('never returns to the login page', () => {
    assert.equal(safeRedirectPath('/login'), '/');
    assert.equal(safeRedirectPath('/login?x=1'), '/');
    assert.equal(safeRedirectPath('/login/'), '/');
    assert.equal(safeRedirectPath('/login-help'), '/login-help');
  });
});
