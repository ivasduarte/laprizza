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
import * as defaultPlanningRunRepository from '../../infrastructure/planning-run/planning-run.repository.js';
import * as controller from './planning.controller.js';

/** Same permission as GET /ai-data/snapshot (granted to MANAGER in ROLE_PERMISSIONS). */
export const PLANNING_PERMISSION = Permission.PLANNING_EXECUTE;

const planningRequestSchema = Joi.object({
  scenarioId: Joi.string()
    .pattern(/^[A-Z0-9-]{1,64}$/)
    .required(),
  stockMode: Joi.string().valid('live', 'scenario').required(),
  // WEB07: optional saved forecast / supplier scenario; without them the active ones are used.
  forecastId: Joi.string().hex().length(24),
  supplierScenarioId: Joi.string().hex().length(24),
});

const objectId = Joi.string().hex().length(24);

const runsQuerySchema = Joi.object({
  kind: Joi.string().valid('bom', 'requirements'),
  forecastId: objectId,
  supplierScenarioId: objectId,
});

function validateRunsQuery(req, _res, next) {
  const { error, value } = runsQuerySchema.validate(req.query, { abortEarly: false });
  if (error)
    return next(new AppError('Validation failed.', 400, joiDetails(error), 'VALIDATION_ERROR'));
  req.runsFilters = { ...value }; // plain object (req.query has a null prototype in Express 5)
  next();
}

function validateRunId(req, _res, next) {
  if (objectId.validate(req.params.id).error) return next(new AppError('Invalid ID format', 400));
  next();
}

function validateBody(req, _res, next) {
  const { error, value } = planningRequestSchema.validate(req.body ?? {}, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true,
  });
  if (error)
    return next(new AppError('Validation failed.', 400, joiDetails(error), 'VALIDATION_ERROR'));
  req.planningParams = value;
  next();
}

/**
 * @param {{
 *   planningService?: ReturnType<typeof createPlanningService>,
 *   aiServiceClient?: object,
 *   aiDataRepository?: object,
 *   planningRunRepository?: object,
 *   aiServiceConfig?: {url?: string, apiKey?: string, timeoutMs?: number},
 * }} [deps]
 */
export default function planningRouterFactory(deps = {}) {
  const aiDataRepository = deps.aiDataRepository ?? createDefaultAiDataRepository();
  const planningService =
    deps.planningService ??
    createPlanningService({
      loadSnapshot: (params) => getSnapshot(aiDataRepository, undefined, params),
      planningRunRepository: deps.planningRunRepository ?? defaultPlanningRunRepository,
      aiServiceClient:
        deps.aiServiceClient ??
        createAiServiceClient({
          baseUrl: deps.aiServiceConfig?.url ?? 'http://127.0.0.1:5000',
          apiKey: deps.aiServiceConfig?.apiKey,
          timeoutMs: deps.aiServiceConfig?.timeoutMs,
        }),
    });

  const router = Router();
  const canPlan = requirePermission(PLANNING_PERMISSION);
  const guard = [canPlan, validateBody];

  router.post('/bom', ...guard, (req, res, next) =>
    controller.calculateBom(req, res, next, planningService, req.planningParams),
  );
  router.post('/requirements', ...guard, (req, res, next) =>
    controller.calculateRequirements(req, res, next, planningService, req.planningParams),
  );

  // WEB07: results already calculated, with the inputs they used (most recent first).
  router.get('/runs', canPlan, validateRunsQuery, (req, res, next) =>
    controller.listRuns(req, res, next, planningService, req.runsFilters),
  );
  router.get('/runs/:id', canPlan, validateRunId, (req, res, next) =>
    controller.getRun(req, res, next, planningService),
  );

  return router;
}
