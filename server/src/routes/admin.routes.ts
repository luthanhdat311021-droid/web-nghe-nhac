import { Router } from 'express';
import {
  checkSongDuplicates,
  createAlbum,
  createArtist,
  createSong,
  deleteAlbum,
  deleteArtist,
  deleteSong,
  deleteUser,
  getAllGenres,
  getAllUsers,
  getDashboardStats,
  getImportHistory,
  getYoutubeInfo,
  importSingleSong,
  recordImportBatch,
  replaceSongAudio,
  replaceSongCover,
  toggleBlockUser,
  updateAlbum,
  updateArtist,
  updateSong,
  updateUserRole,
} from '../controllers/admin.controller.js';
import { requireAdmin } from '../middleware/admin.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { uploadRateLimiter } from '../middleware/apiRateLimiter.js';

const router = Router();

// Protect all admin endpoints with Auth and Admin role checks
router.use(requireAuth);
router.use(requireAdmin);

// Dashboard & Tools
router.get('/stats', getDashboardStats);
router.get('/youtube-info', getYoutubeInfo);

// ==================== MUSIC LIBRARY & BULK IMPORT ====================
router.post('/songs/check-duplicates', checkSongDuplicates);
router.post(
  '/songs/import-song',
  upload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
  ]),
  importSingleSong
);
router.put(
  '/songs/:id/replace-audio',
  upload.fields([{ name: 'audioFile', maxCount: 1 }]),
  replaceSongAudio
);
router.put(
  '/songs/:id/replace-cover',
  upload.fields([{ name: 'coverFile', maxCount: 1 }]),
  replaceSongCover
);
router.post('/songs/import-batch', recordImportBatch);
router.get('/songs/import-history', getImportHistory);

// Songs CRUD
router.post(
  '/songs',
  uploadRateLimiter,
  upload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
  ]),
  createSong
);
router.put(
  '/songs/:id',
  uploadRateLimiter,
  upload.fields([
    { name: 'audioFile', maxCount: 1 },
    { name: 'coverFile', maxCount: 1 },
  ]),
  updateSong
);
router.delete('/songs/:id', deleteSong);

// Artists
router.post(
  '/artists',
  uploadRateLimiter,
  upload.fields([
    { name: 'avatarFile', maxCount: 1 },
    { name: 'bannerFile', maxCount: 1 },
  ]),
  createArtist
);
router.put(
  '/artists/:id',
  uploadRateLimiter,
  upload.fields([
    { name: 'avatarFile', maxCount: 1 },
    { name: 'bannerFile', maxCount: 1 },
  ]),
  updateArtist
);
router.delete('/artists/:id', deleteArtist);

// Albums
router.post(
  '/albums',
  uploadRateLimiter,
  upload.fields([{ name: 'coverFile', maxCount: 1 }]),
  createAlbum
);
router.put(
  '/albums/:id',
  uploadRateLimiter,
  upload.fields([{ name: 'coverFile', maxCount: 1 }]),
  updateAlbum
);
router.delete('/albums/:id', deleteAlbum);

// Genres
router.get('/genres', getAllGenres);

// Users
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/block', toggleBlockUser);
router.delete('/users/:id', deleteUser);

export default router;
