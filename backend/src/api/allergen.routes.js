import { Router } from 'express';
import * as controller from './allergen.controller.js';

const router = Router();
router.get('/', controller.list);

export default router;
