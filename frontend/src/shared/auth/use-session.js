import { useSyncExternalStore } from 'react';
import { sessionStore } from './session-store.js';

export function useSession() {
    return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState);
}