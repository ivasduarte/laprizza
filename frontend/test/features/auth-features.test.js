import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { features } from '../../src/features/registry.js';

const AUTH_PAGES = {
  login: '/login',
  'change-password': '/change-password',
  'forgot-password': '/forgot-password',
  'reset-password': '/reset-password',
};

describe('Authentication pages in the registry', () => {
  it('registers every authentication page with its path', () => {
    Object.entries(AUTH_PAGES).forEach(([id, path]) => {
      const feature = features.find((f) => f.id === id);
      assert.ok(feature, id);
      assert.equal(feature.path, path);
    });
  });

  it('keeps authentication pages out of the main menu', () => {
    Object.keys(AUTH_PAGES).forEach((id) => {
      assert.equal(features.find((f) => f.id === id).showInNav, false, id);
    });
  });

  it('keeps the existing pages in the main menu', () => {
    ['home', 'visualization3d', 'ai'].forEach((id) => {
      assert.notEqual(features.find((f) => f.id === id).showInNav, false, id);
    });
  });
});
