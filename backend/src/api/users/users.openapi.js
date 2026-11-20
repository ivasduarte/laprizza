import { Roles } from '../../domain/users/users.domain.js';

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});
const json = (schema, description) => ({
  description,
  content: { 'application/json': { schema } },
});

const security = [{ BearerAuth: [] }];
const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
};
const roleParam = {
  name: 'role',
  in: 'path',
  required: true,
  schema: { type: 'string', enum: Object.values(Roles) },
};
const ROLE = { type: 'string', enum: Object.values(Roles) };

const USER = {
  type: 'object',
  required: ['id', 'email', 'roles', 'status', 'isActive', 'pendingActivation'],
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    email: { type: 'string', format: 'email' },
    roles: { type: 'array', items: ROLE },
    status: { type: 'string', enum: ['inactive', 'active', 'disabled'] },
    isActive: { type: 'boolean' },
    pendingActivation: {
      type: 'boolean',
      description: 'Inactive account that was never activated (it needs its invitation).',
    },
    customerId: { type: 'string', nullable: true },
  },
};
const INVITATION = {
  type: 'object',
  required: ['expiresAt', 'sent'],
  properties: {
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
    sent: {
      type: 'boolean',
      description: 'False when the e-mail could not be sent: issue a replacement.',
    },
  },
};
const userRef = { $ref: '#/components/schemas/AdminUser' };

const common = {
  401: errorResponse('Not authenticated'),
  403: errorResponse('Missing permission (Administrator only), own roles or role not assignable'),
};

/** User administration (AA05/AA06, Administrator). */
export const usersPaths = {
  '/users': {
    get: {
      summary: 'List users (Administrator)',
      security,
      responses: { 200: json({ type: 'array', items: userRef }, 'Users'), ...common },
    },
    post: {
      summary: 'Create an inactive account and send its activation invitation (Administrator)',
      description:
        'The account starts INACTIVE with CUSTOMER plus the requested roles (AA03). No password ' +
        'is accepted: the user sets it while activating the account (AA07).',
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              additionalProperties: false,
              properties: {
                username: {
                  type: 'string',
                  minLength: 3,
                  maxLength: 30,
                  pattern: '^[A-Za-z0-9]+$',
                },
                email: { type: 'string', format: 'email', maxLength: 254 },
                roles: { type: 'array', uniqueItems: true, items: ROLE },
                customerId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
              },
            },
          },
        },
      },
      responses: {
        201: json(
          {
            allOf: [userRef, { type: 'object', properties: { invitation: INVITATION } }],
          },
          'Created (inactive), invitation issued',
        ),
        400: errorResponse('Validation error (a password is refused)'),
        ...common,
        409: errorResponse('Email or username already in use'),
        503: errorResponse('The role assignment could not be recorded; nothing was created'),
      },
    },
  },
  '/users/assignable-roles': {
    get: {
      summary: 'Roles the current Administrator may assign',
      security,
      responses: {
        200: json(
          { type: 'object', properties: { roles: { type: 'array', items: ROLE } } },
          'Assignable roles',
        ),
        ...common,
      },
    },
  },
  '/users/{id}': {
    get: {
      summary: 'Get a user (Administrator)',
      security,
      parameters: [idParam],
      responses: {
        200: json(userRef, 'User'),
        400: errorResponse('Invalid ID'),
        ...common,
        404: errorResponse('User not found'),
      },
    },
    patch: {
      summary: 'Enable, disable or set the password of an account (Administrator)',
      description:
        'Disabling ends the sessions and the pending invitations. An account that was never ' +
        'activated cannot be enabled here (409 ACTIVATION_REQUIRED).',
      security,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              minProperties: 1,
              properties: { isActive: { type: 'boolean' }, password: { type: 'string' } },
            },
          },
        },
      },
      responses: {
        200: json(userRef, 'Updated'),
        400: errorResponse('Validation error'),
        ...common,
        404: errorResponse('User not found'),
        409: errorResponse('ACTIVATION_REQUIRED'),
      },
    },
  },
  '/users/{id}/roles/{role}': {
    put: {
      summary: 'Assign a role (Administrator)',
      description:
        'Idempotent. Takes effect on the next request and never requires a new activation. ' +
        'The assignment is recorded with the Administrator and the time.',
      security,
      parameters: [idParam, roleParam],
      responses: {
        200: json(userRef, 'Updated'),
        400: errorResponse('Invalid ID or role'),
        ...common,
        404: errorResponse('User not found'),
        503: errorResponse('The assignment could not be recorded; it was undone'),
      },
    },
    delete: {
      summary: 'Remove a role (Administrator)',
      description: 'Idempotent. The withdrawn permissions stop on the next request.',
      security,
      parameters: [idParam, roleParam],
      responses: {
        200: json(userRef, 'Updated'),
        400: errorResponse('Invalid ID or role'),
        ...common,
        404: errorResponse('User not found'),
      },
    },
  },
  '/users/{id}/role-history': {
    get: {
      summary: 'Role assignments and removals of a user, newest first (Administrator)',
      security,
      parameters: [idParam],
      responses: {
        200: json(
          {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: ROLE,
                action: { type: 'string', enum: ['ASSIGNED', 'REMOVED'] },
                actor: {
                  type: 'object',
                  properties: {
                    kind: { type: 'string', enum: ['USER', 'SYSTEM'] },
                    userId: { type: 'string', nullable: true },
                    process: { type: 'string', nullable: true },
                  },
                },
                at: { type: 'string', format: 'date-time' },
              },
            },
          },
          'Role changes',
        ),
        400: errorResponse('Invalid ID'),
        ...common,
        404: errorResponse('User not found'),
      },
    },
  },
  '/users/{id}/invitation': {
    post: {
      summary: 'Issue a replacement activation invitation (Administrator)',
      description: 'The previous link stops working. Only for accounts that were never activated.',
      security,
      parameters: [idParam],
      responses: {
        201: json(INVITATION, 'Invitation issued'),
        400: errorResponse('Invalid ID'),
        ...common,
        404: errorResponse('User not found'),
        409: errorResponse('ACCOUNT_ALREADY_ACTIVATED, ACCOUNT_DISABLED or EMAIL_MISSING'),
      },
    },
  },
};

export const adminUserSchema = USER;
