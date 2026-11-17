import { useSyncExternalStore } from 'react';
import { themeStore } from './theme-store.js';

export function useTheme() {
  return useSyncExternalStore(themeStore.subscribe, themeStore.getTheme);
}
