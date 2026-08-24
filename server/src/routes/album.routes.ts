import { Router } from 'express';
import { getAllAlbums, getAlbumById } from '../controllers/album.controller.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, getAllAlbums);
router.get('/:id', optionalAuth, getAlbumById);

export default router;
