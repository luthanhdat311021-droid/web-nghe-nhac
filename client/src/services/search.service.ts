import api from './api.js';
import { Album, ApiResponse, Artist, Genre, Playlist, Song } from '../types/index.js';

export interface SearchResults {
  query?: string;
  intent?: string;
  explanation?: string;
  isRecommendation?: boolean;
  providerUsed?: string;
  topMatch?: {
    type: 'song' | 'artist' | 'album' | 'playlist';
    item: any;
  };
  songs: Song[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
  genres: Genre[];
}

export interface TrendingResponse {
  trendingQueries: string[];
  topArtists: Artist[];
  topSongs: Song[];
  genres: Genre[];
}

export const searchService = {
  async search(
    query: string,
    type?: 'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'genres',
    contextSongId?: string,
    signal?: AbortSignal
  ): Promise<SearchResults> {
    const res = await api.get<ApiResponse<SearchResults>>('/search', {
      params: { q: query, type, contextSongId },
      signal,
    });
    return res.data.data;
  },

  async getSuggestions(query: string, limit = 8, signal?: AbortSignal): Promise<SearchResults> {
    const res = await api.get<ApiResponse<SearchResults>>('/search/suggestions', {
      params: { q: query, limit },
      signal,
    });
    return res.data.data;
  },


  async getTrending(): Promise<TrendingResponse> {
    const res = await api.get<ApiResponse<TrendingResponse>>('/search/trending');
    return res.data.data;
  },
};
