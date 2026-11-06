import pkg from '../../package.json' with { type: 'json' };

const API_PREFIX = '/api/v1';

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const objectIdPathParam = (name) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
});
const productIdParam = objectIdPathParam('productId');
const sizeIdParam = objectIdPathParam('sizeId');

/**
 * OpenAPI description of the API.
 * Defines the available endpoints, request bodies, and responses for Swagger UI.
 *
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
          503: {
            description: 'The database is not reachable',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'unavailable' },
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
    '/version': {
      get: {
        summary: 'Deployed version',
        description:
          'Commit of the running release, read from VERSION.json at startup. sha and shortSha are "unknown" when the file does not exist.',
        responses: {
          200: {
            description: 'The deployed version',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/VersionInfo' } },
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
    '/pizza-size': {
      get: {
        summary: 'List pizza sizes (MANAGER only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'search',
            in: 'query',
            required: false,
            description: 'Case-insensitive partial match on name.',
            schema: { type: 'string', maxLength: 100 },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/PizzaSize' } },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
      post: {
        summary: 'Create pizza size (MANAGER only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 3, maxLength: 50 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PizzaSize' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          409: errorResponse('Name already in use'),
        },
      },
    },
    '/pizza-size/{id}': {
      get: {
        summary: 'Get pizza size by ID (MANAGER only)',
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
              'application/json': { schema: { $ref: '#/components/schemas/PizzaSize' } },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Pizza Size not found'),
        },
      },
      patch: {
        summary: 'Update pizza size (MANAGER only)',
        description:
          'Setting isActive to false is refused while the pizza size is used in size configurations of any product. Remove them first.',
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
              'application/json': { schema: { $ref: '#/components/schemas/PizzaSize' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Pizza Size not found'),
          409: errorResponse(
            'Name already in use, or the pizza size has size configurations and cannot be removed',
          ),
        },
      },
    },
    '/product-categories': {
      get: {
        summary: 'List or search product categories (MANAGER only)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'name',
            in: 'query',
            required: false,
            description:
              'Exact name, ignoring case and accents. A partial or blank name returns an empty list. Without this parameter, only active categories are returned.',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ProductCategory' } },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
      post: {
        summary: 'Create product category (MANAGER only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string', example: 'Beverages' } },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ProductCategory' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          409: errorResponse('An active category already has this name.'),
        },
      },
    },
    '/product-categories/{id}': {
      get: {
        summary: 'Get product category by ID (MANAGER only)',
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
              'application/json': { schema: { $ref: '#/components/schemas/ProductCategory' } },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product category not found'),
        },
      },
      put: {
        summary: 'Update product category name (MANAGER only)',
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
                required: ['name'],
                properties: { name: { type: 'string', example: 'Soft Drinks' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ProductCategory' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product category not found'),
          409: errorResponse('Name already in use'),
        },
      },
      delete: {
        summary: 'Remove product category (MANAGER only)',
        description: 'A category referenced by products cannot be removed.',
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
          204: { description: 'Removed' },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product category not found'),
          409: errorResponse('Category is referenced by active products'),
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
          409: errorResponse('Allergen is referenced by existing products ou customers'),
        },
      },
    },
    '/predefined-pizzas': {
      get: {
        summary: 'List predefined pizzas (MANAGER and EMPLOYEE)',
        description: 'Only active predefined pizzas are returned.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'name',
            in: 'query',
            required: false,
            description: 'Case-insensitive partial match on the name of the represented product.',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/PredefinedPizza' } },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
      post: {
        summary: 'Create predefined pizza (MANAGER only)',
        description:
          'The pizza is represented by an active sellable product. The default configuration only accepts active pizza components without repetitions, respecting the minimum/maximum of each pizza component type. Every size needs a component size configuration for every component.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'sizeIds', 'componentIds'],
                properties: {
                  productId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
                  sizeIds: {
                    type: 'array',
                    minItems: 1,
                    items: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
                  },
                  componentIds: {
                    type: 'array',
                    minItems: 1,
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
              'application/json': { schema: { $ref: '#/components/schemas/PredefinedPizza' } },
            },
          },
          400: errorResponse('Validation error or broken business rule'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          409: errorResponse('A predefined pizza already exists for this product'),
        },
      },
    },
    '/predefined-pizzas/name/{name}': {
      get: {
        summary:
          'Get predefined pizza by exact product name, case-insensitive (MANAGER and EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PredefinedPizzaDetails' },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Predefined pizza not found'),
        },
      },
    },
    '/predefined-pizzas/{id}': {
      get: {
        summary: 'Get predefined pizza and its default configuration by ID (MANAGER and EMPLOYEE)',
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
              'application/json': {
                schema: { $ref: '#/components/schemas/PredefinedPizzaDetails' },
              },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Predefined pizza not found'),
        },
      },
      put: {
        summary: 'Update or deactivate predefined pizza (MANAGER only)',
        description:
          'Accepts sizeIds, componentIds and/or { "isActive": false }. When sizes or components change, the full validation of the creation is repeated. Reactivation is not supported.',
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
                  sizeIds: {
                    type: 'array',
                    minItems: 1,
                    items: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
                  },
                  componentIds: {
                    type: 'array',
                    minItems: 1,
                    items: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
                  },
                  isActive: { type: 'boolean', enum: [false] },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PredefinedPizza' } },
            },
          },
          400: errorResponse('Validation error or broken business rule'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Predefined pizza not found'),
        },
      },
    },
    '/pizza-component-type': {
      get: {
        summary: 'List or search pizza component types (MANAGER only)',
        description:
          'Without the name parameter, only active types are returned, sorted by assembly order. With it, removed (inactive) types can also be found.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'name',
            in: 'query',
            required: false,
            description:
              'Exact name, ignoring case and accents. A partial or blank name returns an empty list.',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/PizzaComponentType' },
                },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
      post: {
        summary: 'Create pizza component type (MANAGER only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'assemblyOrder', 'minQuantity'],
                properties: {
                  name: { type: 'string', example: 'Cheese' },
                  assemblyOrder: { type: 'integer', minimum: 1, example: 3 },
                  minQuantity: { type: 'integer', minimum: 0, example: 0 },
                  maxQuantity: { type: 'integer', minimum: 1, nullable: true, example: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PizzaComponentType' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          409: errorResponse('Name or assembly order already in use'),
        },
      },
    },
    '/pizza-component-type/{id}': {
      get: {
        summary: 'Get pizza component type by ID (MANAGER only)',
        description: 'Removed (inactive) types are also returned, with isActive = false.',
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
              'application/json': { schema: { $ref: '#/components/schemas/PizzaComponentType' } },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Pizza component type not found'),
        },
      },
      put: {
        summary: 'Update pizza component type (MANAGER only)',
        description:
          'Replaces name, assembly order and quantity limits. Not applicable to removed types.',
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
                required: ['name', 'assemblyOrder', 'minQuantity'],
                properties: {
                  name: { type: 'string', example: 'Cheese' },
                  assemblyOrder: { type: 'integer', minimum: 1, example: 3 },
                  minQuantity: { type: 'integer', minimum: 0, example: 0 },
                  maxQuantity: { type: 'integer', minimum: 1, nullable: true, example: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PizzaComponentType' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Pizza component type not found'),
          409: errorResponse('Name or assembly order already in use'),
        },
      },
      delete: {
        summary: 'Remove pizza component type (MANAGER only)',
        description:
          'Logical removal (isActive = false). A type referenced by products cannot be removed.',
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
          204: { description: 'Removed' },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Pizza component type not found or already removed'),
          409: errorResponse('Pizza component type is referenced by products'),
        },
      },
    },
    '/products/{productId}/size-configurations': {
      get: {
        summary: 'List the size configurations of a product (MANAGER, EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        parameters: [productIdParam],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ComponentSizeConfiguration' },
                },
              },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product not found'),
        },
      },
      post: {
        summary: 'Create a size configuration (MANAGER only)',
        description:
          'Defines the price of a pizza component for a pizza size. Only pizza components can have size configurations, and each size can be configured once per product. stockUnitsConsumed is mandatory for stock controlled products and must be null or omitted otherwise.',
        security: [{ BearerAuth: [] }],
        parameters: [productIdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['pizzaSizeId', 'price'],
                properties: {
                  pizzaSizeId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
                  price: { type: 'number', minimum: 0, example: 1.5 },
                  stockUnitsConsumed: { type: 'integer', minimum: 1, nullable: true, example: 2 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ComponentSizeConfiguration' },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product or pizza size not found, or inactive'),
          409: errorResponse('The pizza size is already configured for this product'),
        },
      },
    },
    '/products/{productId}/size-configurations/{sizeId}': {
      get: {
        summary: 'Get a size configuration (MANAGER, EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        parameters: [productIdParam, sizeIdParam],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ComponentSizeConfiguration' },
              },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product or size configuration not found'),
        },
      },
      put: {
        summary: 'Update a size configuration (MANAGER only)',
        description:
          'Replaces price and stockUnitsConsumed. The pizza size cannot be changed: remove the configuration and create a new one.',
        security: [{ BearerAuth: [] }],
        parameters: [productIdParam, sizeIdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['price'],
                properties: {
                  price: { type: 'number', minimum: 0, example: 2 },
                  stockUnitsConsumed: { type: 'integer', minimum: 1, nullable: true, example: 3 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ComponentSizeConfiguration' },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product, pizza size or size configuration not found'),
        },
      },
      delete: {
        summary: 'Remove a size configuration (MANAGER only)',
        description: 'Physical removal. Returns the removed configuration.',
        security: [{ BearerAuth: [] }],
        parameters: [productIdParam, sizeIdParam],
        responses: {
          200: {
            description: 'Removed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ComponentSizeConfiguration' },
              },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product or size configuration not found'),
        },
      },
    },
    '/products': {
      get: {
        summary: 'List products',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'search',
            in: 'query',
            required: false,
            description: 'Case-insensitive partial match on name or description.',
            schema: { type: 'string', maxLength: 100 },
          },
          {
            name: 'categoryId',
            in: 'query',
            required: false,
            description: 'Filter by category ID.',
            schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
          },
          {
            name: 'sellable',
            in: 'query',
            required: false,
            description: 'Filter by sellable status',
            schema: { type: 'boolean' },
          },
          {
            name: 'isActive',
            in: 'query',
            required: false,
            description: 'Filter by active status.',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
        },
      },
      post: {
        summary: 'Create product (MANAGER only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'description', 'sellable', 'stockControlled', 'categoryId'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  description: { type: 'string' },
                  price: { type: 'number', minimum: 0 },
                  sellable: { type: 'boolean' },
                  stockControlled: { type: 'boolean' },
                  categoryId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
                  pizzaComponentTypeId: {
                    type: 'string',
                    pattern: '^[0-9a-fA-F]{24}$',
                    nullable: true,
                  },
                  allergenIds: {
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
              'application/json': { schema: { $ref: '#/components/schemas/Product' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Referenced entity not found'),
        },
      },
    },
    '/products/{id}': {
      get: {
        summary: 'Get product by ID',
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
              'application/json': { schema: { $ref: '#/components/schemas/Product' } },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          404: errorResponse('Product not found'),
        },
      },
      patch: {
        summary: 'Update product (MANAGER only)',
        description:
          'Setting isActive to false is refused while the product has size configurations. Remove them first.',
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
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  description: { type: 'string' },
                  price: { type: 'number', minimum: 0 },
                  sellable: { type: 'boolean' },
                  stockControlled: { type: 'boolean' },
                  categoryId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
                  pizzaComponentTypeId: {
                    type: 'string',
                    pattern: '^[0-9a-fA-F]{24}$',
                    nullable: true,
                  },
                  allergenIds: {
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
              'application/json': { schema: { $ref: '#/components/schemas/Product' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product or referenced entity not found'),
          409: errorResponse(
            'Name already in use, or the product has size configurations and cannot be removed',
          ),
        },
      },
    },
    '/catalogue': {
      get: {
        summary: 'List products in the catalogue (CUSTOMER, MANAGER, EMPLOYEE)',
        description: 'Returns only active and sellable products, formatted for the catalogue.',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'search',
            in: 'query',
            required: false,
            description: 'Case-insensitive partial match on name or description.',
            schema: { type: 'string', maxLength: 100 },
          },
          {
            name: 'categoryId',
            in: 'query',
            required: false,
            description: 'Filter by category ID.',
            schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/CatalogueItem' } },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
    },
    '/catalogue/{id}': {
      get: {
        summary: 'Get catalogue item by ID (CUSTOMER, MANAGER, EMPLOYEE)',
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
              'application/json': { schema: { $ref: '#/components/schemas/CatalogueItem' } },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product not found in the catalogue'),
        },
      },
    },
    '/stock': {
      get: {
        summary: 'List stock (MANAGER and EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'search',
            in: 'query',
            required: false,
            description: 'Case-insensitive partial match on product name.',
            schema: { type: 'string', maxLength: 100 },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Stock' } },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
    },
    '/stock/{productId}': {
      get: {
        summary: 'Get stock by Product ID (MANAGER and EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Stock' } },
            },
          },
          400: errorResponse('Invalid Product ID or Product is not stock controlled'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product not found'),
        },
      },
      patch: {
        summary: 'Adjust stock quantity (MANAGER and EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'productId',
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
                required: ['amount', 'operation'],
                properties: {
                  amount: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Positive integer amount to adjust.',
                  },
                  operation: {
                    type: 'string',
                    enum: ['increase', 'decrease'],
                    description: 'Type of adjustment. Cannot decrease below 0.',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Stock' } },
            },
          },
          400: errorResponse('Validation error, not stock controlled, or negative stock result'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Product not found'),
        },
      },
    },
    '/ai-data/snapshot': {
      get: {
        summary: 'Obter snapshot de dados para o motor de IA (MANAGER only)',
        description:
          'Devolve o estado atual do catálogo (produtos, stock, pizzas predefinidas e tamanhos) unificado para alimentar o motor Prolog de escalonamento.',
        tags: ['AI Scheduling'], // Isto cria uma secção dedicada no Swagger UI
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    products: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    stock: { type: 'array', items: { $ref: '#/components/schemas/Stock' } },
                    sizes: { type: 'array', items: { $ref: '#/components/schemas/PizzaSize' } },
                    predefinedPizzas: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/PredefinedPizza' },
                    },
                  },
                },
              },
            },
          },
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
    },
    '/kitchen-configurations': {
      get: {
        summary: 'List kitchen configurations (MANAGER and EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/KitchenConfiguration' },
                },
              },
            },
          },
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
      post: {
        summary: 'Create kitchen configuration (MANAGER only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'content'],
                properties: { name: { type: 'string' }, content: { type: 'object' } },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/KitchenConfiguration' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
    },
    '/kitchen-configurations/active': {
      get: {
        summary: 'Get active kitchen configuration (MANAGER and EMPLOYEE)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/KitchenConfiguration' } },
            },
          },
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('No active configuration found'),
        },
      },
    },
    '/kitchen-configurations/{id}/activate': {
      patch: {
        summary: 'Activate a kitchen configuration atomically (MANAGER only)',
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
              'application/json': { schema: { $ref: '#/components/schemas/KitchenConfiguration' } },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Configuration not found'),
        },
      },
    },
    '/kitchen-configurations/validate': {
      post: {
        summary: 'Validate kitchen configuration (MANAGER only)',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: { content: { type: 'object' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { valid: { type: 'boolean' } } },
              },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
        },
      },
    },
    '/kitchen-configurations/{id}': {
      get: {
        summary: 'Get kitchen configuration by ID (MANAGER and EMPLOYEE)',
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
              'application/json': { schema: { $ref: '#/components/schemas/KitchenConfiguration' } },
            },
          },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Configuration not found'),
        },
      },
      patch: {
        summary: 'Update kitchen configuration (MANAGER only)',
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
                properties: { name: { type: 'string' }, content: { type: 'object' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/KitchenConfiguration' } },
            },
          },
          400: errorResponse('Validation error'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Configuration not found'),
        },
      },
      delete: {
        summary: 'Delete kitchen configuration (MANAGER only)',
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
          204: { description: 'Removed' },
          400: errorResponse('Invalid ID'),
          401: errorResponse('Unauthorized'),
          403: errorResponse('Forbidden'),
          404: errorResponse('Configuration not found'),
          409: errorResponse('Cannot delete the active kitchen configuration'),
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
      PizzaSize: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '96427abcd2569873265480325' },
          name: { type: 'string', example: 'Medium' },
          isActive: { type: 'boolean' },
        },
      },
      ProductCategory: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65231abcd345678901234567' },
          name: { type: 'string', example: 'Beverages' },
          isActive: { type: 'boolean' },
        },
      },
      PizzaComponentType: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65231abcd345678901234567' },
          name: { type: 'string', example: 'Cheese' },
          assemblyOrder: { type: 'integer', example: 3 },
          minQuantity: { type: 'integer', example: 0 },
          maxQuantity: { type: 'integer', nullable: true, example: 1 },
          isActive: { type: 'boolean' },
        },
      },
      ComponentSizeConfiguration: {
        type: 'object',
        properties: {
          productId: { type: 'string', example: '65231abcd345678901234567' },
          pizzaSizeId: { type: 'string', example: '65231abcd345678901234568' },
          price: { type: 'number', example: 1.5 },
          stockUnitsConsumed: { type: 'integer', nullable: true, example: 2 },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65231abcd345678901234567' },
          name: { type: 'string', example: 'Pepperoni Pizza' },
          description: { type: 'string', example: 'Delicious classic pepperoni pizza' },
          price: { type: 'number', example: 12.5 },
          sellable: { type: 'boolean' },
          stockControlled: { type: 'boolean' },
          categoryId: { type: 'string', example: '65231abcd345678901234567' },
          pizzaComponentTypeId: { type: 'string', nullable: true, example: null },
          allergenIds: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean' },
          isPizzaComponent: { type: 'boolean' },
        },
      },
      CatalogueItem: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65231abcd345678901234567' },
          name: { type: 'string', example: 'Pizza Margherita' },
          description: { type: 'string', example: 'Classic tomato and mozzarella' },
          price: { type: 'number', example: 9.5 },
          category: {
            type: 'object',
            nullable: true,
            properties: {
              id: { type: 'string', example: '65231abcd345678901234567' },
              name: { type: 'string', example: 'Pizzas' },
            },
          },
          allergens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '65231abcd345678901234568' },
                name: { type: 'string', example: 'Dairy' },
              },
            },
          },
          availableSizes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pizzaSizeId: { type: 'string', example: '65231abcd345678901234569' },
                price: { type: 'number', example: 12.0 },
              },
            },
          },
        },
      },
      Stock: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '76342abcd345678901234568' },
          productId: { type: 'string', example: '65231abcd345678901234567' },
          product: { $ref: '#/components/schemas/Product' },
          quantity: {
            type: 'integer',
            minimum: 0,
            example: 25,
            description: 'Non-negative integer representing the abstract stock units.',
          },
        },
      },
      PredefinedPizza: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65231abcd345678901234567' },
          productId: { type: 'string', example: '65231abcd345678901234567' },
          sizeIds: { type: 'array', items: { type: 'string' } },
          componentIds: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean' },
        },
      },
      PredefinedPizzaDetails: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65231abcd345678901234567' },
          product: { $ref: '#/components/schemas/Product' },
          sizes: { type: 'array', items: { $ref: '#/components/schemas/PizzaSize' } },
          components: { type: 'array', items: { $ref: '#/components/schemas/PizzaComponentType' } },
          isActive: { type: 'boolean' },
        },
      },
      KitchenConfiguration: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '65231abcd345678901234567' },
          name: { type: 'string', example: 'Standard Layout' },
          isActive: { type: 'boolean' },
          content: {
            type: 'object',
            description: 'JSON object defining kitchen dimensions and elements.',
          },
          VersionInfo: {
            type: 'object',
            required: ['sha', 'shortSha'],
            properties: {
              sha: { type: 'string', example: 'd455e69a1b2c3d4e5f60718293a4b5c6d7e8f901' },
              shortSha: { type: 'string', example: 'd455e69' },
              branch: { type: 'string', example: 'main' },
              commitDate: { type: 'string', format: 'date-time' },
              deployedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  },
};