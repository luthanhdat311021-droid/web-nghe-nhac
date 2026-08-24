import api from './api.js';
import { ApiResponse, Song } from '../types/index.js';

export const favoriteService = {
  async getFavorites() {
    const res = await api.get<ApiResponse<Song[]>>('/favorites');
    return res.data.data;
  },

  async toggleFavorite(songId: string) {
    const res = await api.post<ApiResponse<{ isLiked: boolean }>>(`/favorites/${songId}`);
    return res.data.data;
  },
};
