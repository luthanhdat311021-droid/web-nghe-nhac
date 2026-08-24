import api from './api.js';
import {
  Album,
  ApiResponse,
  Artist,
  DashboardStats,
  DuplicateCheckResult,
  Genre,
  ImportBatch,
  Song,
  User,
} from '../types/index.js';

export const adminService = {
  async getStats() {
    const res = await api.get<ApiResponse<DashboardStats>>('/admin/stats');
    return res.data.data;
  },

  // Songs & Music Library
  async checkSongDuplicates(items: Array<{ title: string; artist: string; album?: string }>) {
    const res = await api.post<ApiResponse<DuplicateCheckResult[]>>('/admin/songs/check-duplicates', { items });
    return res.data.data;
  },

  async importSingleSong(formData: FormData) {
    const res = await api.post<ApiResponse<{ status: 'SUCCESS' | 'SKIPPED' | 'REPLACED'; message: string; song: Song }>>(
      '/admin/songs/import-song',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return res.data;
  },

  async replaceSongAudio(id: string, formData: FormData) {
    const res = await api.put<ApiResponse<Song>>(`/admin/songs/${id}/replace-audio`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async replaceSongCover(id: string, formData: FormData) {
    const res = await api.put<ApiResponse<Song>>(`/admin/songs/${id}/replace-cover`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async recordImportBatch(data: {
    totalFiles: number;
    successCount: number;
    failedCount: number;
    logs: Array<{
      filename: string;
      songTitle?: string | null;
      artistName?: string | null;
      status: string;
      errorMessage?: string | null;
      songId?: string | null;
    }>;
  }) {
    const res = await api.post<ApiResponse<ImportBatch>>('/admin/songs/import-batch', data);
    return res.data.data;
  },

  async getImportHistory(page: number = 1, limit: number = 20) {
    const res = await api.get<ApiResponse<{ items: ImportBatch[]; pagination: any }>>('/admin/songs/import-history', {
      params: { page, limit },
    });
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
    >('/admin/youtube-info', {
      params: { url },
    });
    return res.data.data;
  },

  async createSong(formData: FormData) {
    const res = await api.post<ApiResponse<Song>>('/admin/songs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async updateSong(id: string, formData: FormData) {
    const res = await api.put<ApiResponse<Song>>(`/admin/songs/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async deleteSong(id: string) {
    const res = await api.delete<ApiResponse<null>>(`/admin/songs/${id}`);
    return res.data;
  },

  // Artists
  async createArtist(formData: FormData) {
    const res = await api.post<ApiResponse<Artist>>('/admin/artists', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async updateArtist(id: string, formData: FormData) {
    const res = await api.put<ApiResponse<Artist>>(`/admin/artists/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async deleteArtist(id: string) {
    const res = await api.delete<ApiResponse<null>>(`/admin/artists/${id}`);
    return res.data;
  },

  // Albums
  async createAlbum(formData: FormData) {
    const res = await api.post<ApiResponse<Album>>('/admin/albums', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async updateAlbum(id: string, formData: FormData) {
    const res = await api.put<ApiResponse<Album>>(`/admin/albums/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },

  async deleteAlbum(id: string) {
    const res = await api.delete<ApiResponse<null>>(`/admin/albums/${id}`);
    return res.data;
  },

  // Genres
  async getAllGenres() {
    const res = await api.get<ApiResponse<Genre[]>>('/admin/genres');
    return res.data.data;
  },

  // Users
  async getAllUsers() {
    const res = await api.get<ApiResponse<User[]>>('/admin/users');
    return res.data.data;
  },

  async updateUserRole(id: string, role: 'USER' | 'ADMIN') {
    const res = await api.put<ApiResponse<User>>(`/admin/users/${id}/role`, { role });
    return res.data.data;
  },

  async toggleBlockUser(id: string) {
    const res = await api.put<ApiResponse<User>>(`/admin/users/${id}/block`);
    return res.data.data;
  },

  async deleteUser(id: string) {
    const res = await api.delete<ApiResponse<null>>(`/admin/users/${id}`);
    return res.data;
  },
};
