import { Router } from 'express';
import { clearHistory, getHistory } from '../controllers/history.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', getHistory);
router.delete('/', clearHistory);

export default router;
