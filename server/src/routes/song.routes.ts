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

import { requireAdmin } from '../middleware/admin.js';
const router = Router();

router.get('/', optionalAuth, getAllSongs);
router.get('/trending', optionalAuth, getTrendingSongs);
router.get('/top-charts', optionalAuth, getTopCharts);
router.get('/recommended', optionalAuth, getRecommendedSongs);
router.get('/my-contributions', requireAuth, requireAdmin, getMySongContributions);
router.get('/youtube-info', requireAuth, requireAdmin, getYoutubeInfo);
router.get('/:id', optionalAuth, getSongById);
router.post(
  '/',
  requireAuth,
  requireAdmin,
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
  requireAdmin,
  uploadRateLimiter,
  upload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
  ]),
  updateSong
);
router.delete('/:id', requireAuth, requireAdmin, deleteSong);
router.post('/:id/play', requireAuth, (_req, res) => res.status(410).json({ success: false, message: 'Use /music-pro/playback admission.' }));

export default router;
