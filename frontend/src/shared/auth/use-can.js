import { useSyncExternalStore } from 'react';
import { guestPermissionStore } from './guest-permissions.js';
import { can, effectivePermissions } from './permissions.js';
import { useSession } from './use-session.js';

export function usePermissions() {
  const session = useSession();
  const guestPermissions = useSyncExternalStore(
    guestPermissionStore.subscribe,
    guestPermissionStore.get
  );
  return effectivePermissions(session, guestPermissions);
}

export function useCan(permission) {
    return can(usePermissions(), permission);
}
