import api from './api.js';
import { ApiResponse, PaginatedResult, Song } from '../types/index.js';

export const songService = {
  async getAllSongs(params?: {
    page?: number;
    limit?: number;
    genre?: string;
    search?: string;
    trending?: boolean;
    featured?: boolean;
    sort?: string;
  }) {
    const res = await api.get<ApiResponse<PaginatedResult<Song>>>('/songs', { params });
    return res.data.data;
  },

  async getTrendingSongs() {
    const res = await api.get<ApiResponse<Song[]>>('/songs/trending');
    return res.data.data;
  },

  async getTopCharts() {
    const res = await api.get<ApiResponse<Song[]>>('/songs/top-charts');
    return res.data.data;
  },

  async getRecommendedSongs() {
    const res = await api.get<ApiResponse<Song[]>>('/songs/recommended');
    return res.data.data;
  },

  async getSongById(id: string) {
    const res = await api.get<
      ApiResponse<
        Song & {
          moreFromArtist: Song[];
          recommended: Song[];
        }
      >
    >(`/songs/${id}`);
    return res.data.data;
  },

  async recordPlay(id: string, durationPlayed: number = 0) {
    const res = await api.post<ApiResponse<{ playsCount: number }>>(`/songs/${id}/play`, {
      durationPlayed,
    });
    return res.data.data;
  },

  async createSong(formData: FormData) {
    const res = await api.post<ApiResponse<Song>>('/songs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async updateSong(id: string, formData: FormData) {
    const res = await api.put<ApiResponse<Song>>(`/songs/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async deleteSong(id: string) {
    const res = await api.delete<ApiResponse<null>>(`/songs/${id}`);
    return res.data;
  },

  async getMyContributions() {
    const res = await api.get<ApiResponse<Song[]>>('/songs/my-contributions');
    return res.data.data;
  },

  async getYoutubeInfo(url: string) {
    const res = await api.get<
      ApiResponse<{
        youtubeId: string;
        rawTitle: string;
        title: string;
        artistName: string;
        thumbnailUrl: string;
        duration?: number;
        formattedDuration?: string;
      }>
    >('/songs/youtube-info', {
      params: { url },
    });
    return res.data.data;
  },
};

