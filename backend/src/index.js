import { pathToFileURL } from 'node:url';
import { connectDB } from './infrastructure/database.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { seedInitialManager } from './infrastructure/seeder.js';

import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import pkg from '../package.json' with { type: 'json' };

import authRouterFactory from './api/auth.routes.js';
import usersRouterFactory from './api/users.routes.js';
import productsRouter from './api/products.routes.js';
import allergenRouter from './api/allergen.routes.js';
import customersRouter from './api/customers.routes.js';
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
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
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
  api.use('/customers', customersRouter);
  api.use('/pizza-component-type', pizzaCTypeRouter);
  api.use('/pizza-size', pizzaSizeRouter);
  api.use('/predefined-pizza', predPIzzaRouter);
  api.use('/product-categories', prodCatRouter);
  api.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
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