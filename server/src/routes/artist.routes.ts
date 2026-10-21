import { Router } from 'express';
import {
  getAllArtists,
  getArtistById,
  getFollowedArtists,
  toggleFollowArtist,
  createArtist,
  updateArtist,
  deleteArtist,
  getMyArtistContributions,
} from '../controllers/artist.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

import { requireAdmin } from '../middleware/admin.js';
const router = Router();

router.get('/', optionalAuth, getAllArtists);
router.get('/following', requireAuth, getFollowedArtists);
router.get('/my-contributions', requireAuth, requireAdmin, getMyArtistContributions);
router.get('/:id', optionalAuth, getArtistById);
router.post(
  '/',
  requireAuth,
  requireAdmin,
  upload.fields([
    { name: 'avatarFile', maxCount: 1 },
    { name: 'bannerFile', maxCount: 1 },
  ]),
  createArtist
);
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  upload.fields([
    { name: 'avatarFile', maxCount: 1 },
    { name: 'bannerFile', maxCount: 1 },
  ]),
  updateArtist
);
router.delete('/:id', requireAuth, requireAdmin, deleteArtist);
router.post('/:id/follow', requireAuth, toggleFollowArtist);

export default router;

