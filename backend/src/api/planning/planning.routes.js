import { Router } from 'express';
import Joi from 'joi';
import { AppError } from '../../application/app-error.js';
import { joiDetails } from '../middleware/joi-details.js';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { createPlanningService } from '../../application/planning/planning.service.js';
import { getSnapshot } from '../../application/ai-data/ai-data.service.js';
import { createAiServiceClient } from '../../infrastructure/ai-service/ai-service.client.js';
import { createDefaultAiDataRepository } from '../ai-data/ai-data.routes.js';
import * as controller from './planning.controller.js';

/** Same permission as GET /ai-data/snapshot (granted to MANAGER in ROLE_PERMISSIONS). */
export const PLANNING_PERMISSION = Permission.PLANNING_EXECUTE;

const planningRequestSchema = Joi.object({
  scenarioId: Joi.string()
    .pattern(/^[A-Z0-9-]{1,64}$/)
    .required(),
  stockMode: Joi.string().valid('live', 'scenario').required(),
});

function validateBody(req, _res, next) {
  const { error, value } = planningRequestSchema.validate(req.body ?? {}, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true,
  });
  if (error) return next(new AppError('Validation failed.', 400, joiDetails(error), 'VALIDATION_ERROR'));
  req.planningParams = value;
  next();
}

/**
 * @param {{
 *   planningService?: ReturnType<typeof createPlanningService>,
 *   aiServiceClient?: object,
 *   aiDataRepository?: object,
 *   aiServiceConfig?: {url?: string, apiKey?: string, timeoutMs?: number},
 * }} [deps]
 */
export default function planningRouterFactory(deps = {}) {
  const aiDataRepository = deps.aiDataRepository ?? createDefaultAiDataRepository();
  const planningService =
    deps.planningService ??
    createPlanningService({
      loadSnapshot: (params) => getSnapshot(aiDataRepository, undefined, params),
      aiServiceClient:
        deps.aiServiceClient ??
        createAiServiceClient({
          baseUrl: deps.aiServiceConfig?.url ?? 'http://127.0.0.1:5000',
          apiKey: deps.aiServiceConfig?.apiKey,
          timeoutMs: deps.aiServiceConfig?.timeoutMs,
        }),
    });

  const router = Router();
  const guard = [requirePermission(PLANNING_PERMISSION), validateBody];

  router.post('/bom', ...guard, (req, res, next) =>
    controller.calculateBom(req, res, next, planningService, req.planningParams),
  );
  router.post('/requirements', ...guard, (req, res, next) =>
    controller.calculateRequirements(req, res, next, planningService, req.planningParams),
  );

  return router;
}
