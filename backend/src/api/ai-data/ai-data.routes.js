import { Router } from 'express';
import Joi from 'joi';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { Permission } from '../../domain/auth/permissions.domain.js';
import * as controller from './ai-data.controller.js';
import { createAiDataRepository } from '../../infrastructure/ai-data/ai-data.repository.js';
import ProductModel from '../../infrastructure/products/products.model.js';
import StockModel from '../../infrastructure/stock/stock.model.js';
import PizzaSizeModel from '../../infrastructure/pizza-size/pizza-size.model.js';
import PredefinedPizzaModel from '../../infrastructure/predefined-pizza/predefined-pizza.model.js';
import ForecastModel from '../../infrastructure/forecast/forecast.model.js';
import SupplierScenarioModel from '../../infrastructure/supplier-scenario/supplier-scenario.model.js';
import * as aiScenarioRepository from '../../infrastructure/ai-scenario/ai-scenario.repository.js';

const objectId = Joi.string().hex().length(24);

const snapshotQuerySchema = Joi.object({
  scenarioId: Joi.string().pattern(/^[A-Z0-9-]{1,64}$/),
  stockMode: Joi.string().valid('live', 'scenario'),
  // WEB07: a saved forecast / supplier scenario; without them the active ones are used.
  forecastId: objectId,
  supplierScenarioId: objectId,
}).and('scenarioId', 'stockMode');

/** Repository wired to the Mongoose models (also used by the planning routes, AI05). */
export function createDefaultAiDataRepository() {
  return createAiDataRepository({
    productModel: ProductModel,
    stockModel: StockModel,
    sizeModel: PizzaSizeModel,
    predefinedPizzaModel: PredefinedPizzaModel,
    forecastModel: ForecastModel,
    supplierScenarioModel: SupplierScenarioModel,
    aiScenarioRepository,
  });
}

export default function aiDataRouterFactory(deps) {
  const aiDataRepository = deps?.aiDataRepository ?? createDefaultAiDataRepository();

  const router = Router();

  router.get('/snapshot', requirePermission(Permission.PLANNING_EXECUTE), (req, res, next) => {
    const { error, value } = snapshotQuerySchema.validate(req.query, {
      abortEarly: false,
      allowUnknown: true,
    });
    if (error) return next(new AppError('Validation failed.', 400, joiDetails(error)));
    return controller.getSnapshot(req, res, next, aiDataRepository, value);
  });

  // Products to export as JSON for the supplier file (WEB07).
  router.get('/products/export', requirePermission(Permission.PLANNING_EXECUTE), (req, res, next) =>
    controller.getProductsExport(req, res, next, aiDataRepository),
  );

  return router;
}
