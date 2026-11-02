import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { features } from '../../src/features/registry.js';

describe('Feature registry', () => {
  it('has unique ids and paths', () => {
    assert.equal(new Set(features.map((f) => f.id)).size, features.length);
    assert.equal(new Set(features.map((f) => f.path)).size, features.length);
  });

  it('defines absolute paths, labels and lazy loaders', () => {
    features.forEach((feature) => {
      assert.ok(feature.path.startsWith('/'), feature.id);
      assert.ok(feature.label, feature.id);
      assert.equal(typeof feature.load, 'function', feature.id);
    });
  });
});
