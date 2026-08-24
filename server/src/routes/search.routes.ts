import { Router } from 'express';
import { searchAll, getSuggestions, getTrending } from '../controllers/search.controller.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/suggestions', optionalAuth, getSuggestions);
router.get('/trending', optionalAuth, getTrending);
router.get('/', optionalAuth, searchAll);

export default router;
