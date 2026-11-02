import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';
import * as controller from './ai-data.controller.js';
import { createAiDataRepository } from '../../infrastructure/ai-data/ai-data.repository.js';
import ProductModel from '../../infrastructure/products/products.model.js';
import StockModel from '../../infrastructure/stock/stock.model.js';
import PizzaSizeModel from '../../infrastructure/pizza-size/pizza-size.model.js';
import PredefinedPizzaModel from '../../infrastructure/predefined-pizza/predefined-pizza.model.js';


export default function aiDataRouterFactory(deps) {
  const aiDataRepository =
    deps?.aiDataRepository ??
    createAiDataRepository({
      productModel: ProductModel,
      stockModel: StockModel,
      sizeModel: PizzaSizeModel,
      predefinedPizzaModel: PredefinedPizzaModel,
    });

  const router = Router();

  router.get('/snapshot', verifyToken, requireRole([Roles.MANAGER]), (req, res, next) =>
    controller.getSnapshot(req, res, next, aiDataRepository),
  );

  return router;
}
