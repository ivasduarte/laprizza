/**
 * Login responses as the back end returns them since AA05 (roles AND permissions).
 * The permissions follow the back-end matrix (Table 1); the SPA decides only with them.
 */
const GUEST = ['catalogue:read'];
const CUSTOMER = [...GUEST, 'customers:read:own', 'resources:read'];
// The employee has no access to the kitchen (team decision): kitchen:read is MANAGER only.
const EMPLOYEE = [...GUEST, 'products:read', 'resources:read', 'stock:read'];
const MANAGER = [
  ...EMPLOYEE,
  'allergens:read',
  'allergens:write',
  'kitchen:read',
  'categories:write',
  'customers:read',
  'customers:write',
  'forecasts:read',
  'forecasts:write',
  'kitchen:write',
  'pizzas:write',
  'planning:execute',
  'products:write',
  'stock:read:inactive',
  'stock:write',
  'suppliers:import',
  'suppliers:read',
];
// AA06: user administration belongs to the ADMINISTRATOR role only.
export const ADMINISTRATOR_PERMISSIONS = [
  ...GUEST,
  'resources:read',
  'resources:write',
  'roles:assign:administrator',
  'roles:assign:customer',
  'roles:assign:employee',
  'roles:assign:manager',
  'users:create',
  'users:invite',
  'users:manage',
  'users:read',
];

export const GUEST_PERMISSIONS = GUEST;

const session = (id, email, roles, permissions) => ({
  accessToken: `fake-jwt-token-${id}`,
  tokenType: 'Bearer',
  expiresIn: 3600,
  user: { id, email, status: 'active', roles, permissions, customerId: null },
});

export const SESSIONS = Object.freeze({
  MANAGER: session('1', 'admin@laprizza.pt', ['MANAGER'], MANAGER),
  EMPLOYEE: session('2', 'emp@laprizza.pt', ['EMPLOYEE'], EMPLOYEE),
  CUSTOMER: {
    ...session('3', 'customer@laprizza.pt', ['CUSTOMER'], CUSTOMER),
    user: {
      id: '3',
      email: 'customer@laprizza.pt',
      status: 'active',
      roles: ['CUSTOMER'],
      permissions: CUSTOMER,
      customerId: 'c0c0c0000000000000000001',
    },
  },
  NO_ROLES: session('4', 'noroles@laprizza.pt', [], GUEST),
  MANAGER_EMPLOYEE: session(
    '5',
    'both@laprizza.pt',
    ['MANAGER', 'EMPLOYEE'],
    MANAGER
  ),
});
