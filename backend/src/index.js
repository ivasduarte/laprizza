import { STATUS_CODES } from 'node:http';
import { pathToFileURL } from 'node:url';
import { connectDB } from './infrastructure/database.js';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import pkg from '../package.json' with { type: 'json' };
import usersRouter from './api/users.routes.js';
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
 */
export function loadConfig(env = process.env) {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: Number(env.PORT ?? 3000),
    corsOrigins: (env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    mongoUri: env.MONGODB_URI,
  };
}

/** OpenAPI description of the API. Add new paths here as endpoints are created. */
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
  },
};

function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.status = 404;
  error.expose = true;
  next(error);
}

// Express identifies error handlers by their four parameters, so `_next` must stay.
function errorHandler(err, _req, res, _next) {
  const status =
    Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);

  const code = STATUS_CODES[status].toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const message = status < 500 && err.expose ? err.message : STATUS_CODES[status];
  res.status(status).json({ error: { status, code, message } });
}

export function createApp(config = loadConfig()) {
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

  api.use('/users', usersRouter);
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

// Start the server only when this file is run directly (not when imported by tests).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = loadConfig();

  await connectDB(config.mongoUri);

  createApp(config).listen(config.port, () => {
    console.log(`LaPrizza API listening on http://localhost:${config.port}${API_PREFIX}`);
  });
}