import { Router } from 'express';
import {
  addSongToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserPlaylists,
  removeSongFromPlaylist,
  reorderPlaylist,
  updatePlaylist,
} from '../controllers/playlist.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, getUserPlaylists);
router.post('/', requireAuth, createPlaylist);
router.get('/:id', optionalAuth, getPlaylistById);
router.put('/:id', requireAuth, updatePlaylist);
router.delete('/:id', requireAuth, deletePlaylist);
router.post('/:id/songs', requireAuth, addSongToPlaylist);
router.delete('/:id/songs/:songId', requireAuth, removeSongFromPlaylist);
router.put('/:id/reorder', requireAuth, reorderPlaylist);

export default router;
