import express, { Router } from 'express';
import * as controller from './shared-resources.controller.js';
import { requirePermission } from '../middleware/authorization.middleware.js';
import { Permission } from '../../domain/auth/permissions.domain.js';
import { MAX_FILE_SIZE_BYTES } from '../../domain/shared-resources/shared-resources.domain.js';

export default function sharedResourcesRouterFactory(sharedResourcesStorage) {
  const router = Router();

  const canRead = requirePermission(Permission.RESOURCES_READ);
  const canWrite = requirePermission(Permission.RESOURCES_WRITE);

  const rawFile = express.raw({ type: 'application/octet-stream', limit: MAX_FILE_SIZE_BYTES });

  router.get('/', canRead, (req, res, next) =>
    controller.list(req, res, next, sharedResourcesStorage),
  );

  router.get('/:name', canRead, (req, res, next) =>
    controller.download(req, res, next, sharedResourcesStorage),
  );

  router.put('/:name', canWrite, rawFile, (req, res, next) =>
    controller.upload(req, res, next, sharedResourcesStorage),
  );

  router.delete('/:name', canWrite, (req, res, next) =>
    controller.remove(req, res, next, sharedResourcesStorage),
  );

  return router;
}
