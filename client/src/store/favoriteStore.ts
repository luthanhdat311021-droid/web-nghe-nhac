import { create } from 'zustand';
import { favoriteService } from '../services/favorite.service.js';
import { usePlayerStore } from './playerStore.js';
import { queryClient, QUERY_KEYS } from '../services/queryClient.js';

interface FavoriteState {
  likedMap: Record<string, boolean>; // songId -> isLiked
  isInitialized: boolean;

  // Actions
  isLiked: (songId: string, fallback?: boolean) => boolean;
  setLiked: (songId: string, liked: boolean) => void;
  syncLikedStatus: (songs: Array<{ id: string; isLiked?: boolean }>) => void;
  toggleFavoriteOptimistic: (
    songId: string,
    currentStatus?: boolean,
    onSuccess?: (newStatus: boolean) => void,
    onError?: (err: any) => void
  ) => Promise<boolean>;
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  likedMap: {},
  isInitialized: false,

  isLiked: (songId: string, fallback = false) => {
    const map = get().likedMap;
    if (map[songId] !== undefined) {
      return map[songId];
    }
    return fallback;
  },

  setLiked: (songId: string, liked: boolean) => {
    set((state) => ({
      likedMap: { ...state.likedMap, [songId]: liked },
    }));
    usePlayerStore.getState().setLikedStatus(songId, liked);
  },

  syncLikedStatus: (songs) => {
    if (!songs || songs.length === 0) return;
    set((state) => {
      const nextMap = { ...state.likedMap };
      let changed = false;
      for (const song of songs) {
        if (song.isLiked !== undefined && nextMap[song.id] === undefined) {
          nextMap[song.id] = song.isLiked;
          changed = true;
        }
      }
      return changed ? { likedMap: nextMap } : state;
    });
  },

  toggleFavoriteOptimistic: async (songId, currentStatus, onSuccess, onError) => {
    const current = currentStatus !== undefined ? currentStatus : get().isLiked(songId, false);
    const nextStatus = !current;

    // 1. INSTANT OPTIMISTIC FEEDBACK (< 1ms)
    // Update favoriteStore
    set((state) => ({
      likedMap: { ...state.likedMap, [songId]: nextStatus },
    }));

    // Synchronize player store immediately
    usePlayerStore.getState().setLikedStatus(songId, nextStatus);

    try {
      // 2. BACKGROUND API CALL
      const res = await favoriteService.toggleFavorite(songId);
      const serverStatus = res.isLiked;

      if (serverStatus !== nextStatus) {
        set((state) => ({
          likedMap: { ...state.likedMap, [songId]: serverStatus },
        }));
        usePlayerStore.getState().setLikedStatus(songId, serverStatus);
      }

      // Invalidate favorites query in background
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.favorites });
      onSuccess?.(serverStatus);
      return serverStatus;
    } catch (err) {
      // 3. ROLLBACK ON FAILURE
      console.warn('[MusicWave] Favorite toggle failed, rolling back state:', err);
      set((state) => ({
        likedMap: { ...state.likedMap, [songId]: current },
      }));
      usePlayerStore.getState().setLikedStatus(songId, current);
      onError?.(err);
      return current;
    }
  },
}));
