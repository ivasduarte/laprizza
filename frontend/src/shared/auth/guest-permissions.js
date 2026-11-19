export function createGuestPermissionStore() {
  let permissions = Object.freeze([]);
  const listeners = new Set();

  return {
    get: () => permissions,
    set(list) {
      permissions = Object.freeze(Array.isArray(list) ? [...list] : []);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const guestPermissionStore = createGuestPermissionStore();
