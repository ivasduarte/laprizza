import { Router } from 'express';
import * as controller from './product-categories.controller.js';

const router = Router();
router.get('/', controller.list);

export default router;
