import api from './api.js';
import { Album, ApiResponse, PaginatedResult } from '../types/index.js';

export const albumService = {
  async getAllAlbums(params?: { search?: string; genre?: string; page?: number; limit?: number }) {
    const res = await api.get<ApiResponse<PaginatedResult<Album>>>('/albums', { params });
    return res.data.data;
  },

  async getAlbumById(id: string) {
    const res = await api.get<ApiResponse<Album>>(`/albums/${id}`);
    return res.data.data;
  },
};
