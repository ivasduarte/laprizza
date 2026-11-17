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

const snapshotQuerySchema = Joi.object({
  scenarioId: Joi.string().pattern(/^[A-Z0-9-]{1,64}$/),
  stockMode: Joi.string().valid('live', 'scenario'),
}).and('scenarioId', 'stockMode');

export default function aiDataRouterFactory(deps) {
  const aiDataRepository =
    deps?.aiDataRepository ??
    createAiDataRepository({
      productModel: ProductModel,
      stockModel: StockModel,
      sizeModel: PizzaSizeModel,
      predefinedPizzaModel: PredefinedPizzaModel,
      forecastModel: ForecastModel,
      supplierScenarioModel: SupplierScenarioModel,
      aiScenarioRepository,
    });

  const router = Router();

  router.get('/snapshot', requirePermission(Permission.PLANNING_EXECUTE), (req, res, next) => {
    const { error, value } = snapshotQuerySchema.validate(req.query, {
      abortEarly: false,
      allowUnknown: true,
    });
    if (error) return next(new AppError('Validation failed.', 400, joiDetails(error)));
    return controller.getSnapshot(req, res, next, aiDataRepository, value);
  });

  return router;
}
