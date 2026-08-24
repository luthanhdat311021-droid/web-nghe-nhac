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

const router = Router();

router.get('/', optionalAuth, getAllArtists);
router.get('/following', requireAuth, getFollowedArtists);
router.get('/my-contributions', requireAuth, getMyArtistContributions);
router.get('/:id', optionalAuth, getArtistById);
router.post(
  '/',
  requireAuth,
  upload.fields([
    { name: 'avatarFile', maxCount: 1 },
    { name: 'bannerFile', maxCount: 1 },
  ]),
  createArtist
);
router.put(
  '/:id',
  requireAuth,
  upload.fields([
    { name: 'avatarFile', maxCount: 1 },
    { name: 'bannerFile', maxCount: 1 },
  ]),
  updateArtist
);
router.delete('/:id', requireAuth, deleteArtist);
router.post('/:id/follow', requireAuth, toggleFollowArtist);

export default router;

