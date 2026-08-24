import { Router } from 'express';
import {
  getAllSongs,
  getSongById,
  getTrendingSongs,
  getTopCharts,
  getRecommendedSongs,
  recordPlay,
  createSong,
  updateSong,
  deleteSong,
  getMySongContributions,
  getYoutubeInfo,
} from '../controllers/song.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { uploadRateLimiter } from '../middleware/apiRateLimiter.js';

const router = Router();

router.get('/', optionalAuth, getAllSongs);
router.get('/trending', optionalAuth, getTrendingSongs);
router.get('/top-charts', optionalAuth, getTopCharts);
router.get('/recommended', optionalAuth, getRecommendedSongs);
router.get('/my-contributions', requireAuth, getMySongContributions);
router.get('/youtube-info', requireAuth, getYoutubeInfo);
router.get('/:id', optionalAuth, getSongById);
router.post(
  '/',
  requireAuth,
  uploadRateLimiter,
  upload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
  ]),
  createSong
);
router.put(
  '/:id',
  requireAuth,
  uploadRateLimiter,
  upload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
  ]),
  updateSong
);
router.delete('/:id', requireAuth, deleteSong);
router.post('/:id/play', optionalAuth, recordPlay);

export default router;
