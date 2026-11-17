import { Permission, hasPermission } from './permissions.domain.js';

export function canReadCustomer(principal, customerId) {
  const permissions = principal?.permissions ?? [];
  if (hasPermission(permissions, Permission.CUSTOMERS_READ)) return true;

  return (
    hasPermission(permissions, Permission.CUSTOMERS_READ_OWN) &&
    Boolean(principal?.customerId) &&
    Boolean(customerId) &&
    String(principal.customerId) === String(customerId)
  );
}
