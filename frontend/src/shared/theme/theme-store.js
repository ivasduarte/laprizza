export const THEMES = ['light', 'dark'];
export const THEME_STORAGE_KEY = 'laprizza.theme';

/** Browser-chrome colour (meta theme-color) of each theme. */
const THEME_COLORS = { light: '#c8231a', dark: '#17100e' };
const DARK_QUERY = '(prefers-color-scheme: dark)';

const isTheme = (value) => THEMES.includes(value);

/**
 * Theme store: the explicit user choice (persisted) wins; without one, the theme
 * follows the operating-system preference and reacts to its changes.
 *
 * Every browser dependency is injectable, so the store is testable in Node.
 *
 * @param {{ storage?: Storage, matchMedia?: (q: string) => MediaQueryList, root?: HTMLElement, doc?: Document }} [deps]
 */
export function createThemeStore({
  storage = globalThis.localStorage,
  matchMedia = globalThis.matchMedia?.bind(globalThis),
  root = globalThis.document?.documentElement,
  doc = globalThis.document,
} = {}) {
  const listeners = new Set();
  const media = matchMedia?.(DARK_QUERY);

  const readStored = () => {
    try {
      const value = storage?.getItem(THEME_STORAGE_KEY);
      return isTheme(value) ? value : null;
    } catch {
      return null; // storage blocked (private mode, sandboxed iframe)
    }
  };
  const systemTheme = () => (media?.matches ? 'dark' : 'light');

  let explicit = readStored();
  let theme = explicit ?? systemTheme();

  function apply() {
    if (root) {
      root.dataset.theme = theme;
      root.style.colorScheme = theme;
    }
    doc?.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  }

  function update(next) {
    if (next === theme) return;
    theme = next;
    apply();
    listeners.forEach((listener) => listener());
  }

  const onSystemChange = () => {
    if (!explicit) update(systemTheme());
  };

  function setTheme(next) {
    if (!isTheme(next)) throw new Error(`Unknown theme: ${next}`);
    explicit = next;
    try {
      storage?.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // not persisted, but still applied for this visit
    }
    update(next);
  }

  return {
    getTheme: () => theme,
    isExplicit: () => explicit !== null,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Applies the current theme to the document and starts following the OS preference. */
    init() {
      apply();
      media?.addEventListener?.('change', onSystemChange);
      return () => media?.removeEventListener?.('change', onSystemChange);
    },

    setTheme,
    toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  };
}

export const themeStore = createThemeStore();
