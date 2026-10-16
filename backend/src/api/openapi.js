import pkg from '../../package.json' with { type: 'json' };

const API_PREFIX = '/api/v1';

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

/**
 * OpenAPI description of the API.
 * Defines the available endpoints, request bodies, and responses for Swagger UI.
 *
 * @todo Add new paths here as endpoints are created.
 * @type {Object}
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: { title: 'LaPrizza API', version: pkg.version },
  servers: [{ url: API_PREFIX }],
  paths: {
    '/health': {
      get: {
        summary: 'Service health check',
        responses: {
          200: {
            description: 'The service is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    version: { type: 'string', example: pkg.version },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['identifier', 'password'],
                properties: { identifier: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { token: { type: 'string' } } },
              },
            },
          },
          400: { description: 'Validation error' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/users': {
      post: {
        summary: 'Create user (MANAGER only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password', 'role'],
                properties: {
                  username: { type: 'string', minLength: 3 },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  role: { type: 'string', enum: ['MANAGER', 'EMPLOYEE', 'CUSTOMER'] },
                  customerId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created' },
          400: { description: 'Validation' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          409: { description: 'Conflict' },
        },
      },
      get: {
        summary: 'List users',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Success' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/customers': {
      get: {
        summary: 'List customers (MANAGER only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'search',
            in: 'query',
            required: false,
            description: 'Case-insensitive partial match on name, email or phone number.',
            schema: { type: 'string', maxLength: 100 },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Customer' } },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
      post: {
        summary: 'Create customer (MANAGER only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'phoneNumber', 'address'],
                properties: {
                  name: { type: 'string', minLength: 3, maxLength: 50 },
                  email: { type: 'string', format: 'email' },
                  phoneNumber: {
                    type: 'string',
                    description:
                      'Portuguese phone number in any common format. Stored as 9 national digits and must be unique.',
                    example: '+351 912 345 678',
                  },
                  address: { $ref: '#/components/schemas/Address' },
                  dietaryRestrictions: {
                    type: 'array',
                    uniqueItems: true,
                    items: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Customer' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          409: errorResponse('Email or phone number already in use'),
        },
      },
    },
    '/customers/{id}': {
      get: {
        summary: 'Get customer by ID (MANAGER only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Customer' } },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Customer not found'),
        },
      },
      patch: {
        summary: 'Update customer (MANAGER only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: {
                  name: { type: 'string', minLength: 3, maxLength: 50 },
                  email: { type: 'string', format: 'email' },
                  phoneNumber: { type: 'string', example: '+351 912 345 678' },
                  address: { $ref: '#/components/schemas/Address' },
                  dietaryRestrictions: {
                    type: 'array',
                    uniqueItems: true,
                    items: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
                  },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Customer' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Customer not found'),
          409: errorResponse('Email or phone number already in use'),
        },
      },
    },
    '/allergens': {
      get: {
        summary: 'List allergens (MANAGER and EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'name',
            in: 'query',
            required: false,
            description: 'Case-insensitive partial match on name.',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Allergen' } },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
      post: {
        summary: 'Create allergen (MANAGER only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string', minLength: 1, example: 'Gluten' } },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Allergen' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          409: errorResponse('Allergen name already in use'),
        },
      },
    },
    '/allergens/name/{name}': {
      get: {
        summary: 'Get allergen by exact name, case-insensitive (MANAGER and EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Allergen' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Allergen not found'),
        },
      },
    },
    '/allergens/{id}': {
      get: {
        summary: 'Get allergen by ID (MANAGER and EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Allergen' } },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Allergen not found'),
        },
      },
      put: {
        summary: 'Deactivate allergen (MANAGER only). Only { "isActive": false } is accepted.',
        description:
          'Logical removal. An allergen referenced by existing products or customers cannot be deactivated.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['isActive'],
                properties: { isActive: { type: 'boolean', enum: [false] } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Deactivated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Allergen' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Allergen not found'),
          409: errorResponse('Allergen is referenced by existing products or customers'),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              status: { type: 'integer', example: 400 },
              code: { type: 'string', example: 'BAD_REQUEST' },
              message: { type: 'string', example: 'Validation failed' },
              details: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      Address: {
        type: 'object',
        required: ['street', 'houseNumber', 'postalCode', 'city', 'district'],
        properties: {
          street: { type: 'string' },
          houseNumber: { type: 'string' },
          complement: { type: 'string' },
          postalCode: { type: 'string', pattern: '^\\d{4}-\\d{3}$', example: '4460-123' },
          city: { type: 'string' },
          district: { type: 'string' },
        },
      },
      Allergen: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65231abcd345678901234567' },
          name: { type: 'string', example: 'Gluten' },
          isActive: { type: 'boolean' },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65231abcd345678901234567' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phoneNumber: { type: 'string', example: '912345678' },
          address: { $ref: '#/components/schemas/Address' },
          dietaryRestrictions: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean' },
        },
      },
    },
  },
};