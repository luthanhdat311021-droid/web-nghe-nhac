import { Router } from 'express';
import { getFavorites, toggleFavorite } from '../controllers/favorite.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', getFavorites);
router.post('/:songId', toggleFavorite);

export default router;
