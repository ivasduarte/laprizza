import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * app.jsx is JSX (not loadable by node --test), so its routing rules are checked on the source.
 */
const app = readFileSync(new URL('../../src/app.jsx', import.meta.url), 'utf8');

describe('SPA routes (WEB03)', () => {
  it('has a catch-all route that shows the not-found page', () => {
    assert.match(app, /<Route\s+path="\*"\s+element=\{<NotFound\s*\/>\}\s*\/>/);
  });

  it('declares the catch-all route after the registry pages', () => {
    assert.ok(app.indexOf('path="*"') > app.indexOf('routes.map('));
  });

  it('guards every page that needs a session or a permission', () => {
    assert.match(app, /route\.requiresAuth\s*\|\|\s*route\.permission/);
    assert.match(app, /permission=\{route\.permission\}/);
  });
});
