import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes default fresh cache time
      gcTime: 1000 * 60 * 60, // 60 minutes cache retention in RAM
      refetchOnWindowFocus: false, // Don't trigger refetches on tab focus/switch
      refetchOnReconnect: false,
      refetchOnMount: false, // Instant cache-first load without showing skeletons
      retry: 1, // Only retry once on failure
    },
  },
});

// Cache Keys Constants
export const QUERY_KEYS = {
  // Songs
  trendingSongs: ['songs', 'trending'] as const,
  recommendedSongs: ['songs', 'recommended'] as const,
  topCharts: ['songs', 'top-charts'] as const,
  songDetail: (id: string) => ['songs', 'detail', id] as const,
  allSongs: (params?: Record<string, any>) => ['songs', 'all', params] as const,
  mySongContributions: ['songs', 'my-contributions'] as const,

  // Artists
  allArtists: (params?: Record<string, any>) => ['artists', 'all', params] as const,
  popularArtists: ['artists', 'popular'] as const,
  artistDetail: (id: string) => ['artists', 'detail', id] as const,
  followedArtists: ['artists', 'following'] as const,
  myArtistContributions: ['artists', 'my-contributions'] as const,

  // Albums
  allAlbums: (params?: Record<string, any>) => ['albums', 'all', params] as const,
  popularAlbums: ['albums', 'popular'] as const,
  albumDetail: (id: string) => ['albums', 'detail', id] as const,

  // Playlists
  userPlaylists: ['playlists', 'user'] as const,
  playlistDetail: (id: string) => ['playlists', 'detail', id] as const,

  // Favorites & History
  favorites: ['favorites', 'list'] as const,
  history: (limit?: number) => ['history', 'list', limit] as const,

  // Genres
  genres: ['genres', 'all'] as const,

  // Search
  search: (query: string, type?: string) => ['search', query, type] as const,
  searchTrending: ['search', 'trending'] as const,
  searchSuggestions: (query: string) => ['search', 'suggestions', query] as const,
};
