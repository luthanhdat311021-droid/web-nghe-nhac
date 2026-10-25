import api from './api.js';
import { ApiResponse, Playlist } from '../types/index.js';
import { QUERY_KEYS, queryClient } from './queryClient.js';

// Mirrors FREE_PLAYLIST_LIMIT on the server; the server is what enforces it.
export const FREE_PLAYLIST_LIMIT = 3;

// Songs are added from many screens (modal, song page, player); refetch so the playlist page and counts are never stale.
const refreshPlaylist = (playlistId: string) => {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playlistDetail(playlistId) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userPlaylists });
};

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
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userPlaylists });
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
    refreshPlaylist(playlistId);
    return res.data.data;
  },

  async removeSong(playlistId: string, songId: string) {
    const res = await api.delete<ApiResponse<null>>(`/playlists/${playlistId}/songs/${songId}`);
    refreshPlaylist(playlistId);
    return res.data;
  },

  async reorder(playlistId: string, songIds: string[]) {
    const res = await api.put<ApiResponse<null>>(`/playlists/${playlistId}/reorder`, { songIds });
    return res.data;
  },
};
