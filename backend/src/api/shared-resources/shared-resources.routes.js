import express, { Router } from 'express';
import * as controller from './shared-resources.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { Roles } from '../../domain/users/users.domain.js';
import { MAX_FILE_SIZE_BYTES } from '../../domain/shared-resources/shared-resources.domain.js';

export default function sharedResourcesRouterFactory(sharedResourcesStorage) {
  const router = Router();

  const writeRoles = [Roles.MANAGER];

  const rawFile = express.raw({ type: 'application/octet-stream', limit: MAX_FILE_SIZE_BYTES });

  router.get('/', verifyToken, (req, res, next) =>
    controller.list(req, res, next, sharedResourcesStorage),
  );

  router.get('/:name', verifyToken, (req, res, next) =>
    controller.download(req, res, next, sharedResourcesStorage),
  );

  router.put('/:name', verifyToken, requireRole(writeRoles), rawFile, (req, res, next) =>
    controller.upload(req, res, next, sharedResourcesStorage),
  );

  router.delete('/:name', verifyToken, requireRole(writeRoles), (req, res, next) =>
    controller.remove(req, res, next, sharedResourcesStorage),
  );

  return router;
}
