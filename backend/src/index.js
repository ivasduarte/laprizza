import { pathToFileURL } from 'node:url';
import { connectDB } from './infrastructure/database.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { seedInitialManager } from './infrastructure/seeder.js';
import { dummyPostalCodeValidator } from './infrastructure/external/postal-code.validator.js';

import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import pkg from '../package.json' with { type: 'json' };

import authRouterFactory from './api/auth.routes.js';
import usersRouterFactory from './api/users.routes.js';
import productsRouter from './api/products.routes.js';
import allergenRouter from './api/allergen.routes.js';
import customersRouterFactory from './api/customers.routes.js';
import pizzaCTypeRouter from './api/pizza-component-type.routes.js';
import pizzaSizeRouter from './api/pizza-size.routes.js';
import predPIzzaRouter from './api/predefined-pizza.routes.js';
import prodCatRouter from './api/product-categories.routes.js';

const API_PREFIX = '/api/v1';

/**
 * Reads the runtime configuration from environment variables.
 * See .env.example for the supported variables.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] - The environment variables object.
 * @returns {{nodeEnv: string, port: number, corsOrigins: string[], mongoUri: string}} The parsed configuration object.
 * @throws {Error} If the JWT_SECRET is missing from the environment variables.
 */
export function loadConfig(env = process.env) {
  if (!env.JWT_SECRET) throw new Error('Fatal: JWT_SECRET is missing from environment variables.');

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: Number(env.PORT ?? 3000),
    corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    mongoUri: env.MONGODB_URI,
  };
}

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

/**
 * OpenAPI description of the API.
 * Defines the available endpoints, request bodies, and responses for Swagger UI.
 * Add new paths here as endpoints are created.
 *
 * @type {Object}
 */
const openApiSpec = {
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

/**
 * Middleware to handle requests to non-existent routes.
 * Creates a 404 error and passes it to the next error handler.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} _res - The Express response object (unused).
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.status = 404;
  error.expose = true;
  next(error);
}

/**
 * Bootstraps the Express application, configures middleware, and registers all API routes.
 *
 * @param {Object} [config=loadConfig()] - The application configuration object.
 * @param {Object} [repos={}] - The repository dependencies to inject into the routes.
 * @param {Object} [repos.usersRepository] - The users repository instance (optional).
 * @returns {import('express').Application} The configured Express application instance.
 * @param {Object} [repos.postalCodeValidator] - The postal code validator instance (optional).
 */
export function createApp(config = loadConfig(), repos = {}) {
  const app = express();
  app.disable('x-powered-by');

  if (config.nodeEnv !== 'test') {
    app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  }
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());

  const api = express.Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: pkg.version, timestamp: new Date().toISOString() });
  });

  api.use('/auth', authRouterFactory(repos.usersRepository));
  api.use('/users', usersRouterFactory(repos.usersRepository));
  api.use('/products', productsRouter);
  api.use('/allergen', allergenRouter);
  api.use('/pizza-component-type', pizzaCTypeRouter);
  api.use('/pizza-size', pizzaSizeRouter);
  api.use('/predefined-pizza', predPIzzaRouter);
  api.use('/product-categories', prodCatRouter);
  api.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  api.use(
    '/customers',
    customersRouterFactory(
      repos.customersRepository,
      repos.postalCodeValidator ?? dummyPostalCodeValidator,
    ),
  );
  app.use(API_PREFIX, api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Start the server only when this file is run directly (not when imported by tests)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = loadConfig();
    await connectDB(config.mongoUri);
    await seedInitialManager();

    createApp(config).listen(config.port, () => {
      console.log(`LaPrizza API listening on http://localhost:${config.port}${API_PREFIX}`);
    });
  } catch (err) {
    console.error('Failed to start server: ', err.message);
    process.exit(1); // Aborts immediately
  }
}