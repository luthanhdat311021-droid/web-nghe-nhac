import api from './api.js';
import { ApiResponse, Playlist } from '../types/index.js';

export const playlistService = {
  async getUserPlaylists() {
    const res = await api.get<ApiResponse<Playlist[]>>('/playlists');
    return res.data.data;
  },

  async getPlaylistById(id: string) {
    const res = await api.get<ApiResponse<Playlist>>(`/playlists/${id}`);
    return res.data.data;
  },

  async createPlaylist(data: { title: string; description?: string; isPublic?: boolean; coverUrl?: string }) {
    const res = await api.post<ApiResponse<Playlist>>('/playlists', data);
    return res.data.data;
  },

  async updatePlaylist(id: string, data: { title?: string; description?: string; isPublic?: boolean; coverUrl?: string }) {
    const res = await api.put<ApiResponse<Playlist>>(`/playlists/${id}`, data);
    return res.data.data;
  },

  async deletePlaylist(id: string) {
    const res = await api.delete<ApiResponse<null>>(`/playlists/${id}`);
    return res.data;
  },

  async addSong(playlistId: string, songId: string) {
    const res = await api.post<ApiResponse<any>>(`/playlists/${playlistId}/songs`, { songId });
    return res.data.data;
  },

  async removeSong(playlistId: string, songId: string) {
    const res = await api.delete<ApiResponse<null>>(`/playlists/${playlistId}/songs/${songId}`);
    return res.data;
  },

  async reorder(playlistId: string, songIds: string[]) {
    const res = await api.put<ApiResponse<null>>(`/playlists/${playlistId}/reorder`, { songIds });
    return res.data;
  },
};
