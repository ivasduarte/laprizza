import { Router } from 'express';
import * as controller from './system.controller.js';

/**
 * Public operational endpoints, used by the deploy script to validate a release after a restart.
 * 
 * @returns The system router.
 */
export default function systemRouterFactory({ databaseHealthProbe, appVersion, versionInfo }) {
  const router = Router();

  router.get('/health', (req, res, next) =>
    controller.health(req, res, next, databaseHealthProbe, appVersion),
  );

  router.get('/version', (req, res, next) => controller.version(req, res, next, versionInfo));

  return router;
}
