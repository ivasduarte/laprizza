import { pathToFileURL } from 'node:url';
import { connectDB } from './infrastructure/database.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { seedInitialManager, seedInitialPizzaComponentTypes } from './infrastructure/seeder.js';
import { dummyPostalCodeValidator } from './infrastructure/external/postal-code.validator.js';
import { openApiSpec } from './api/openapi.js';
import { createAuthModule } from './api/auth/auth.module.js';
import { passwordHasher } from './infrastructure/security/password-hasher.js';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import pkg from '../package.json' with { type: 'json' };

import authRouterFactory from './api/auth/auth.routes.js';
import usersRouterFactory from './api/users/users.routes.js';
import productsRouterFactory from './api/products/products.routes.js';
import allergenRouterFactory from './api/allergen/allergen.routes.js';
import customersRouterFactory from './api/customers/customers.routes.js';
import pizzaComponentTypesRouterFactory from './api/pizza-component-type/pizza-component-type.routes.js';
import sizesRouterFactory from './api/pizza-size/pizza-size.routes.js';
import predefinedPizzaRouterFactory from './api/predefined-pizza/predefined-pizza.routes.js';
import productCategoriesRouterFactory from './api/product-categories/product-categories.routes.js';
import stockRouterFactory from './api/stock/stock.routes.js';
import componentSizeConfigurationRouterFactory from './api/component-size-configuration/component-size-configuration.routes.js';
import productCatalogueRouterFactory from './api/product-catalogue/product-catalogue.route.js';
import aiDataRouterFactory from './api/ai-data/ai-data.routes.js';

const API_PREFIX = '/api/v1';

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const toList = (value) =>
  String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function parseTrustProxy(value) {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  return /^\d+$/.test(value) ? Number(value) : value;
}

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

  const nodeEnv = env.NODE_ENV ?? 'development';
  const sameSite = (env.REFRESH_COOKIE_SAMESITE ?? 'strict').toLowerCase();
  const secureCookie = (env.REFRESH_COOKIE_SECURE ?? 'true') !== 'false';
  if (sameSite === 'none' && !secureCookie) {
    throw new Error('Fatal: REFRESH_COOKIE_SAMESITE=none requires REFRESH_COOKIE_SECURE=true.');
  }
  const appBaseUrl = (env.APP_BASE_URL ?? 'http://localhost:4200').replace(/\/+$/, '');

  return {
    nodeEnv,
    port: Number(env.PORT ?? 3000),
    corsOrigins: toList(env.CORS_ORIGIN ?? 'http://localhost:4200'),
    mongoUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET,
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    rateLimit: {
      enabled: (env.RATE_LIMIT_ENABLED ?? String(nodeEnv !== 'test')) === 'true',
      authWindowMs: toInt(env.AUTH_RATE_LIMIT_WINDOW_MINUTES, 15) * 60_000,
      authMax: toInt(env.AUTH_RATE_LIMIT_MAX, 10),
      forgotWindowMs: toInt(env.FORGOT_RATE_LIMIT_WINDOW_MINUTES, 60) * 60_000,
      forgotMax: toInt(env.FORGOT_RATE_LIMIT_MAX, 3),
    },
    cookie: {
      name: env.REFRESH_COOKIE_NAME ?? 'lp_rt',
      secure: secureCookie,
      sameSite,
      path: `${API_PREFIX}/auth`,
    },
    auth: {
      accessTokenTtlSeconds: toInt(env.ACCESS_TOKEN_TTL_MINUTES, 60) * 60,
      refreshTokenTtlMs: toInt(env.REFRESH_TOKEN_TTL_DAYS, 7) * 86_400_000,
      lockoutThreshold: toInt(env.LOGIN_LOCKOUT_THRESHOLD, 3),
      lockoutStepsMs: toList(env.LOGIN_LOCKOUT_STEPS_SECONDS ?? '60,300,1800').map(
        (s) => toInt(s, 60) * 1000,
      ),
      unknownAccountThrottleRetentionMs: toInt(env.LOGIN_THROTTLE_RETENTION_HOURS, 24) * 3_600_000,
      passwordResetTtlMs: toInt(env.PASSWORD_RESET_TTL_MINUTES, 30) * 60_000,
      passwordResetUrl: `${appBaseUrl}/reset-password`,
    },
    mail: {
      host: env.SMTP_HOST ?? 'localhost',
      port: toInt(env.SMTP_PORT, 1025),
      secure: env.SMTP_SECURE === 'true',
      user: env.SMTP_USER || undefined,
      pass: env.SMTP_PASSWORD || undefined,
      from: env.MAIL_FROM ?? 'LaPrizza <no-reply@laprizza.local>',
    },
  };
}

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
 * @param {Object} [config=loadConfig()] - The application configuration object.
 * @param {Object} [repos={}] - The repository dependencies to inject into the routes.
 * @param {Object} [repos.usersRepository] - The users repository instance (optional).
 * @param {Object} [repos.customersRepository] - The customers repository instance (optional).
 * @param {Object} [repos.sizeRepository] - The pizza size repository instance (optional).
 * @param {Object} [repos.productCategoriesRepository] - The product categories repository instance (optional).
 * @param {Object} [repos.productsRepository] - The products repository instance (optional).
 * @param {Object} [repos.allergenRepository] - The allergens repository instance (optional).
 * @param {Object} [repos.pizzaComponentTypesRepository] - The pizza component types repository instance (optional).
 * @param {Object} [repos.postalCodeValidator] - The postal code validator instance (optional).
 * @returns {import('express').Application} The configured Express application instance.
 */
export function createApp(config = loadConfig(), repos = {}) {
    const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  if (config.nodeEnv !== 'test') {
    app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
  }
  app.use(cors({ origin: config.corsOrigins, credentials: true, exposedHeaders: ['Retry-After'] }));
  app.use(express.json());
  app.use(cookieParser());

  const auth = createAuthModule(config, repos);
  app.locals.authenticate = auth.authenticate; // used by verifyToken in every router
  app.locals.securityLogger = auth.securityLogger;

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: pkg.version, timestamp: new Date().toISOString() });
  });

  api.use('/auth', authRouterFactory(auth));
  api.use('/users', usersRouterFactory(repos.usersRepository));
  api.use(
    '/products/:productId/size-configurations',
    componentSizeConfigurationRouterFactory({
      productsRepository: repos.productsRepository,
      sizeRepository: repos.sizeRepository,
    }),
  );
  const isTesting = Object.keys(repos).length > 0;
  api.use(
    '/products',
    productsRouterFactory(
      isTesting
        ? {
            productsRepository: repos.productsRepository,
            categoriesRepository: repos.productCategoriesRepository || repos.categoriesRepository,
            allergensRepository: repos.allergenRepository || repos.allergensRepository,
            pizzaComponentTypesRepository:
              repos.pizzaComponentTypesRepository || repos.pizzaComponentTypeRepository,
            stockRepository: repos.stockRepository,
          }
        : undefined,
    ),
  );
  api.use(
    '/stock',
    stockRouterFactory(
      isTesting
        ? {
            stockRepository: repos.stockRepository,
            productsRepository: repos.productsRepository,
          }
        : undefined,
    ),
  );
  api.use('/allergens', allergenRouterFactory(repos.allergenRepository));
  api.use(
    '/pizza-component-type',
    pizzaComponentTypesRouterFactory(repos.pizzaComponentTypesRepository, repos.productsRepository),
  );
  api.use('/pizza-size', sizesRouterFactory(repos.sizeRepository, repos.productsRepository));
  api.use(
    '/predefined-pizzas',
    predefinedPizzaRouterFactory(
      isTesting
        ? {
            predefinedPizzaRepository: repos.predefinedPizzaRepository,
            productsRepository: repos.productsRepository,
          }
        : undefined,
    ),
  );
  api.use(
    '/product-categories',
    productCategoriesRouterFactory(repos.productCategoriesRepository, repos.productsRepository),
  );
  api.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  api.use(
    '/customers',
    customersRouterFactory(
      repos.customersRepository,
      repos.postalCodeValidator ?? dummyPostalCodeValidator,
    ),
  );
  api.use(
    '/catalogue',
    productCatalogueRouterFactory(
      isTesting ? { productsRepository: repos.productsRepository } : undefined,
    ),
  );
  api.use(
    '/ai-data',
    aiDataRouterFactory(isTesting ? { aiDataRepository: repos.aiDataRepository } : undefined),
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
    await passwordHasher.warmUp();
    await seedInitialManager();
    await seedInitialPizzaComponentTypes();

    createApp(config).listen(config.port, () => {
      console.log(`LaPrizza API listening on http://localhost:${config.port}${API_PREFIX}`);
    });
  } catch (err) {
    console.error('Failed to start server: ', err.message);
    process.exit(1); // Aborts immediately
  }
}
