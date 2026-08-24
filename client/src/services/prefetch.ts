import { queryClient, QUERY_KEYS } from './queryClient.js';
import { songService } from './song.service.js';
import { artistService } from './artist.service.js';
import { albumService } from './album.service.js';
import { adminService } from './admin.service.js';
import { favoriteService } from './favorite.service.js';
import { historyService } from './history.service.js';
import { playlistService } from './playlist.service.js';
import { searchService } from './search.service.js';

import {
  INITIAL_GENRES,
  INITIAL_TRENDING_SONGS,
  INITIAL_RECOMMENDED_SONGS,
  INITIAL_TOP_CHARTS,
  INITIAL_ARTISTS,
  INITIAL_ALBUMS,
} from '../data/initialCatalog';

// Local storage cache key for instant hydration across reloads
const LOCAL_STORAGE_QUERY_CACHE_KEY = 'musicwave_hot_query_cache_v1';

/**
 * Hydrates queryClient from bundled catalog seed + localStorage immediately upon script execution (0ms)
 */
export const hydrateQueryCacheFromStorage = () => {
  try {
    // 1. Instant Initial Seed (Zero Millisecond First Paint)
    if (!queryClient.getQueryData(QUERY_KEYS.trendingSongs)) {
      queryClient.setQueryData(QUERY_KEYS.trendingSongs, INITIAL_TRENDING_SONGS);
    }
    if (!queryClient.getQueryData(QUERY_KEYS.recommendedSongs)) {
      queryClient.setQueryData(QUERY_KEYS.recommendedSongs, INITIAL_RECOMMENDED_SONGS);
    }
    if (!queryClient.getQueryData(QUERY_KEYS.topCharts)) {
      queryClient.setQueryData(QUERY_KEYS.topCharts, INITIAL_TOP_CHARTS);
    }
    if (!queryClient.getQueryData(QUERY_KEYS.popularArtists)) {
      queryClient.setQueryData(QUERY_KEYS.popularArtists, INITIAL_ARTISTS);
    }
    if (!queryClient.getQueryData(QUERY_KEYS.popularAlbums)) {
      queryClient.setQueryData(QUERY_KEYS.popularAlbums, INITIAL_ALBUMS);
    }
    if (!queryClient.getQueryData(QUERY_KEYS.genres)) {
      queryClient.setQueryData(QUERY_KEYS.genres, INITIAL_GENRES);
    }
    if (!queryClient.getQueryData(QUERY_KEYS.allAlbums({ page: 1, limit: 18 }))) {
      queryClient.setQueryData(QUERY_KEYS.allAlbums({ page: 1, limit: 18 }), {
        items: INITIAL_ALBUMS,
        pagination: { page: 1, limit: 18, total: INITIAL_ALBUMS.length, totalPages: 1 },
      });
    }
    if (!queryClient.getQueryData(QUERY_KEYS.allArtists({ page: 1, limit: 18 }))) {
      queryClient.setQueryData(QUERY_KEYS.allArtists({ page: 1, limit: 18 }), {
        items: INITIAL_ARTISTS,
        pagination: { page: 1, limit: 18, total: INITIAL_ARTISTS.length, totalPages: 1 },
      });
    }
    if (!queryClient.getQueryData(QUERY_KEYS.allSongs({ page: 1, limit: 16 }))) {
      queryClient.setQueryData(QUERY_KEYS.allSongs({ page: 1, limit: 16 }), {
        items: INITIAL_TRENDING_SONGS,
        pagination: { page: 1, limit: 16, total: INITIAL_TRENDING_SONGS.length, totalPages: 1 },
      });
    }

    // 2. Overwrite with persistent user cache if available
    const raw = localStorage.getItem(LOCAL_STORAGE_QUERY_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      Object.entries(parsed).forEach(([keyStr, data]) => {
        try {
          const queryKey = JSON.parse(keyStr);
          queryClient.setQueryData(queryKey, data);
        } catch {
          // ignore
        }
      });
    }
  } catch (err) {
    console.warn('[MusicWave] Query cache hydration failed:', err);
  }
};

/**
 * Persists high-priority catalog queries into localStorage for instantaneous next-visit render
 */
export const persistCoreQueriesToStorage = () => {
  try {
    const cache = queryClient.getQueryCache();
    const toSave: Record<string, any> = {};

    const persistentKeys = [
      JSON.stringify(QUERY_KEYS.allAlbums({ page: 1, limit: 18 })),
      JSON.stringify(QUERY_KEYS.allArtists({ page: 1, limit: 18 })),
      JSON.stringify(QUERY_KEYS.allSongs({ page: 1, limit: 16 })),
      JSON.stringify(QUERY_KEYS.genres),
      JSON.stringify(QUERY_KEYS.trendingSongs),
      JSON.stringify(QUERY_KEYS.recommendedSongs),
      JSON.stringify(QUERY_KEYS.topCharts),
      JSON.stringify(QUERY_KEYS.popularArtists),
      JSON.stringify(QUERY_KEYS.popularAlbums),
    ];

    persistentKeys.forEach((keyStr) => {
      try {
        const queryKey = JSON.parse(keyStr);
        const data = queryClient.getQueryData(queryKey);
        if (data) {
          toSave[keyStr] = data;
        }
      } catch {
        // ignore
      }
    });

    if (Object.keys(toSave).length > 0) {
      localStorage.setItem(LOCAL_STORAGE_QUERY_CACHE_KEY, JSON.stringify(toSave));
    }
  } catch (err) {
    console.warn('[MusicWave] Query cache persistence failed:', err);
  }
};

/**
 * Pre-fetches all main tabs in background so clicking any tab is 100% instant with NO skeleton delay
 */
export const prefetchAllCoreData = async (isAuthenticated = false) => {
  // 1. Initial storage hydration for instant 0ms data display
  hydrateQueryCacheFromStorage();

  // 2. Prefetch all public catalog tabs in parallel
  const prefetchPromises = [
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.allAlbums({ page: 1, limit: 18 }),
      queryFn: () => albumService.getAllAlbums({ page: 1, limit: 18 }),
      staleTime: 1000 * 60 * 10,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.allArtists({ page: 1, limit: 18 }),
      queryFn: () => artistService.getAllArtists({ page: 1, limit: 18 }),
      staleTime: 1000 * 60 * 10,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.allSongs({ page: 1, limit: 16 }),
      queryFn: () => songService.getAllSongs({ page: 1, limit: 16 }),
      staleTime: 1000 * 60 * 10,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.genres,
      queryFn: () => adminService.getAllGenres(),
      staleTime: 1000 * 60 * 30,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.trendingSongs,
      queryFn: () => songService.getTrendingSongs(),
      staleTime: 1000 * 60 * 10,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.recommendedSongs,
      queryFn: () => songService.getRecommendedSongs(),
      staleTime: 1000 * 60 * 10,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.topCharts,
      queryFn: () => songService.getTopCharts(),
      staleTime: 1000 * 60 * 10,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.popularArtists,
      queryFn: async () => {
        const res = await artistService.getAllArtists({ limit: 6 });
        return res.items;
      },
      staleTime: 1000 * 60 * 15,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.popularAlbums,
      queryFn: async () => {
        const res = await albumService.getAllAlbums({ limit: 6 });
        return res.items;
      },
      staleTime: 1000 * 60 * 15,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.searchTrending,
      queryFn: () => searchService.getTrending(),
      staleTime: 1000 * 60 * 15,
    }),
  ];

  if (isAuthenticated) {
    prefetchPromises.push(
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.favorites,
        queryFn: () => favoriteService.getFavorites(),
        staleTime: 1000 * 60 * 10,
      }),
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.history(15),
        queryFn: () => historyService.getHistory(15),
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.history(50),
        queryFn: () => historyService.getHistory(50),
        staleTime: 1000 * 60 * 5,
      }),
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.userPlaylists,
        queryFn: () => playlistService.getUserPlaylists(),
        staleTime: 1000 * 60 * 10,
      })
    );
  }

  // Await and snapshot to storage
  await Promise.allSettled(prefetchPromises);
  persistCoreQueriesToStorage();
};

/**
 * On-demand prefetch when user hovers over or touches a link
 */
export const prefetchRoute = (route: string, isAuthenticated = false) => {
  switch (route) {
    case 'albums':
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.allAlbums({ page: 1, limit: 18 }),
        queryFn: () => albumService.getAllAlbums({ page: 1, limit: 18 }),
        staleTime: 1000 * 60 * 10,
      });
      break;
    case 'artists':
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.allArtists({ page: 1, limit: 18 }),
        queryFn: () => artistService.getAllArtists({ page: 1, limit: 18 }),
        staleTime: 1000 * 60 * 10,
      });
      break;
    case 'explore':
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.allSongs({ page: 1, limit: 16 }),
        queryFn: () => songService.getAllSongs({ page: 1, limit: 16 }),
        staleTime: 1000 * 60 * 10,
      });
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.genres,
        queryFn: () => adminService.getAllGenres(),
        staleTime: 1000 * 60 * 30,
      });
      break;
    case 'favorites':
      if (isAuthenticated) {
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.favorites,
          queryFn: () => favoriteService.getFavorites(),
          staleTime: 1000 * 60 * 10,
        });
      }
      break;
    case 'history':
      if (isAuthenticated) {
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.history(50),
          queryFn: () => historyService.getHistory(50),
          staleTime: 1000 * 60 * 5,
        });
      }
      break;
    case 'library':
      if (isAuthenticated) {
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.userPlaylists,
          queryFn: () => playlistService.getUserPlaylists(),
          staleTime: 1000 * 60 * 10,
        });
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.favorites,
          queryFn: () => favoriteService.getFavorites(),
          staleTime: 1000 * 60 * 10,
        });
      }
      break;
  }
};
