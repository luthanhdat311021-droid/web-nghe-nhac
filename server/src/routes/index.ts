import musicProRoutes from './musicPro.routes.js';
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import songRoutes from './song.routes.js';
import artistRoutes from './artist.routes.js';
import albumRoutes from './album.routes.js';
import playlistRoutes from './playlist.routes.js';
import favoriteRoutes from './favorite.routes.js';
import historyRoutes from './history.routes.js';
import searchRoutes from './search.routes.js';
import adminRoutes from './admin.routes.js';
import mediaRoutes from './media.routes.js';

const router = Router();

router.use('/music-pro', musicProRoutes);
router.use('/auth', authRoutes);
router.use('/songs', songRoutes);
router.use('/artists', artistRoutes);
router.use('/albums', albumRoutes);
router.use('/playlists', playlistRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/history', historyRoutes);
router.use('/search', searchRoutes);
router.use('/admin', adminRoutes);
router.use('/media', mediaRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
