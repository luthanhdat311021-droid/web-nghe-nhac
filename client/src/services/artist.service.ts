import api from './api.js';
import { ApiResponse, Artist, PaginatedResult } from '../types/index.js';

export const artistService = {
  async getAllArtists(params?: { search?: string; page?: number; limit?: number }, signal?: AbortSignal) {
    const res = await api.get<ApiResponse<PaginatedResult<Artist>>>('/artists', { params, signal });
    return res.data.data;
  },

  async getArtistById(id: string) {
    const res = await api.get<ApiResponse<Artist>>(`/artists/${id}`);
    return res.data.data;
  },

  async toggleFollow(id: string) {
    const res = await api.post<ApiResponse<{ isFollowed: boolean }>>(`/artists/${id}/follow`);
    return res.data.data;
  },

  async getFollowedArtists() {
    const res = await api.get<ApiResponse<Artist[]>>('/artists/following');
    return res.data.data;
  },

  async createArtist(formData: FormData) {
    const res = await api.post<ApiResponse<Artist>>('/artists', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async updateArtist(id: string, formData: FormData) {
    const res = await api.put<ApiResponse<Artist>>(`/artists/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async deleteArtist(id: string) {
    const res = await api.delete<ApiResponse<null>>(`/artists/${id}`);
    return res.data;
  },

  async getMyContributions() {
    const res = await api.get<ApiResponse<Artist[]>>('/artists/my-contributions');
    return res.data.data;
  },
};

