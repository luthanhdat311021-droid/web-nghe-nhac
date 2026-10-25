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

// Vercel rejects request bodies over 4.5 MB (HTTP 413), so files go from the browser straight to Supabase Storage.
const SERVER_UPLOAD_LIMIT = 4 * 1024 * 1024;

/**
 * Puts a file into Supabase Storage through a one-time signed URL and returns its public URL.
 * Returns null when storage is unavailable and the file is small enough to send through the server instead.
 */
export const uploadToStorage = async (
  file: File,
  kind: 'audio' | 'cover',
  meta: { title?: string; artistName?: string; albumTitle?: string } = {}
): Promise<string | null> => {
  let signed: { uploadUrl: string; publicUrl: string };
  try {
    const res = await api.post<ApiResponse<{ uploadUrl: string; publicUrl: string }>>('/admin/media/upload-url', {
      kind, fileName: file.name, contentType: file.type, ...meta,
    });
    signed = res.data.data;
  } catch (err: any) {
    if (err.response?.status === 503 && file.size <= SERVER_UPLOAD_LIMIT) return null;
    if (err.response?.status === 503) {
      throw new Error(`Tệp ${(file.size / 1048576).toFixed(1)} MB vượt giới hạn 4,5 MB của máy chủ và kho Supabase Storage chưa sẵn sàng.`);
    }
    throw err;
  }
  const put = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
    body: file,
  });
  if (!put.ok) throw new Error(`Tải tệp lên kho lưu trữ thất bại (${put.status}).`);
  return signed.publicUrl;
};

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
