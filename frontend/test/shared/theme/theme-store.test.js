import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createThemeStore, THEME_STORAGE_KEY } from '../../../src/shared/theme/theme-store.js';

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: mock.fn((key) => data.get(key) ?? null),
    setItem: mock.fn((key, value) => data.set(key, value)),
  };
}

function createMedia(matches) {
  const handlers = new Set();
  return {
    matches,
    addEventListener: mock.fn((_type, handler) => handlers.add(handler)),
    removeEventListener: mock.fn((_type, handler) => handlers.delete(handler)),
    emit(nextMatches) {
      this.matches = nextMatches;
      handlers.forEach((handler) => handler());
    },
  };
}

function createDeps({ stored, systemDark = false } = {}) {
  const media = createMedia(systemDark);
  const meta = { setAttribute: mock.fn() };
  return {
    media,
    meta,
    deps: {
      storage: createStorage(stored ? { [THEME_STORAGE_KEY]: stored } : {}),
      matchMedia: () => media,
      root: { dataset: {}, style: {} },
      doc: { querySelector: () => meta },
    },
  };
}

describe('Theme store', () => {
  it('follows the system preference when there is no stored choice', () => {
    const { deps } = createDeps({ systemDark: true });
    const store = createThemeStore(deps);

    store.init();

    assert.equal(store.getTheme(), 'dark');
    assert.equal(store.isExplicit(), false);
    assert.equal(deps.root.dataset.theme, 'dark');
    assert.equal(deps.root.style.colorScheme, 'dark');
  });

  it('prefers the stored choice over the system preference', () => {
    const { deps } = createDeps({ stored: 'light', systemDark: true });
    assert.equal(createThemeStore(deps).getTheme(), 'light');
  });

  it('ignores an invalid stored value', () => {
    const { deps } = createDeps({ stored: '<script>', systemDark: false });
    assert.equal(createThemeStore(deps).getTheme(), 'light');
  });

  it('toggle persists the choice, updates the document and notifies once', () => {
    const { deps, meta } = createDeps();
    const store = createThemeStore(deps);
    const listener = mock.fn();
    store.subscribe(listener);

    store.toggle();

    assert.equal(store.getTheme(), 'dark');
    assert.deepEqual(deps.storage.setItem.mock.calls[0].arguments, [THEME_STORAGE_KEY, 'dark']);
    assert.equal(deps.root.dataset.theme, 'dark');
    assert.deepEqual(meta.setAttribute.mock.calls.at(-1).arguments, ['content', '#17100e']);
    assert.equal(listener.mock.callCount(), 1);
  });

  it('reacts to system changes only while there is no explicit choice', () => {
    const { deps, media } = createDeps();
    const store = createThemeStore(deps);
    store.init();

    media.emit(true);
    assert.equal(store.getTheme(), 'dark');

    store.setTheme('light');
    media.emit(true);
    assert.equal(store.getTheme(), 'light');
  });

  it('still applies the theme when storage throws', () => {
    const { deps } = createDeps();
    deps.storage.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    const store = createThemeStore(deps);

    store.setTheme('dark');

    assert.equal(store.getTheme(), 'dark');
  });

  it('rejects unknown themes', () => {
    const { deps } = createDeps();
    assert.throws(() => createThemeStore(deps).setTheme('sepia'), /Unknown theme/);
  });
});
