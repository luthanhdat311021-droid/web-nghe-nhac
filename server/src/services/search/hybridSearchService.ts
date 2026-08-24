/**
 * Core Hybrid Search Service
 * MusicWave AI Smart Search Engine
 *
 * Pipeline:
 * 1. Normalize Query (Vietnamese accents, lowercase, trim, tokens)
 * 2. Check LRU Cache
 * 3. Analyze Query Intent (Fast Rule-based or AI Provider)
 * 4. Multi-path Database Retrieval (Exact, Fuzzy, Lyrics, Semantic/Genre/Mood)
 * 5. Composite Ranking & Grounding (ZERO Hallucination)
 * 6. Cache & Return Structured Results
 */

import { prisma } from '../prisma.js';
import { normalizeQuery, removeVietnameseAccents } from './textNormalizer.js';
import { computeMatchScore } from './fuzzyMatcher.js';
import { aiSearchManager } from './ai/aiProvider.js';
import { AIAnalysisResult, SearchContext } from './ai/aiTypes.js';
import { RankingEngine } from './rankingEngine.js';
import { appCache } from '../../utils/cacheManager.js';

export interface HybridSearchParams {
  query: string;
  type?: 'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'genres';
  userId?: string;
  contextSongId?: string;
  limit?: number;
}

export interface HybridSearchResult {
  query: string;
  intent: string;
  explanation?: string;
  isRecommendation: boolean;
  songs: any[];
  artists: any[];
  albums: any[];
  playlists: any[];
  genres: any[];
  topMatch?: {
    type: 'song' | 'artist' | 'album' | 'playlist';
    item: any;
  };
  providerUsed: string;
}

export class HybridSearchService {
  /**
   * Main Search All function
   */
  public static async searchAll(params: HybridSearchParams): Promise<HybridSearchResult> {
    const rawQuery = String(params.query || '').trim();

    // 1. Empty Query -> Return Explore / Popular default state
    if (!rawQuery) {
      return this.getEmptyQueryFallback();
    }

    const norm = normalizeQuery(rawQuery);
    const cacheKey = `search:${norm.noAccents}:${params.type || 'all'}:${params.contextSongId || ''}:${params.userId || 'anon'}`;

    return appCache.getOrSet(
      cacheKey,
      async (): Promise<HybridSearchResult> => {
        const shouldSearch = (t: string) => !params.type || params.type === 'all' || params.type === t;
        const limit = params.limit || 12;

        // 2. AI Intent & Semantic Analysis
        const context: SearchContext = {
          userId: params.userId,
          currentSongId: params.contextSongId,
        };
        const aiAnalysis: AIAnalysisResult = await aiSearchManager.analyzeQuery(rawQuery, context);

        // 3. Retrieve Candidates from Database
        const [dbSongs, dbArtists, dbAlbums, dbPlaylists, dbGenres, lyricsMatches] = await Promise.all([
          shouldSearch('songs') ? this.findSongCandidates(norm, aiAnalysis, params.userId) : [],
          shouldSearch('artists') ? this.findArtistCandidates(norm, aiAnalysis) : [],
          shouldSearch('albums') ? this.findAlbumCandidates(norm, aiAnalysis) : [],
          shouldSearch('playlists') ? this.findPlaylistCandidates(norm, aiAnalysis) : [],
          shouldSearch('genres') ? this.findGenreCandidates(norm, aiAnalysis) : [],
          shouldSearch('songs') ? this.findLyricsMatches(norm) : new Set<string>(),
        ]);

        // 4. Build Semantic Boost Map for Songs
        const semanticBoostMap = new Map<string, number>();
        if (aiAnalysis.suggestedGenres.length > 0 || aiAnalysis.entities.moods.length > 0) {
          for (const s of dbSongs) {
            let boost = 0;
            const gSlug = s.genre?.slug?.toLowerCase() || '';
            const gName = s.genre?.name?.toLowerCase() || '';

            for (const hint of aiAnalysis.suggestedGenres) {
              const hintNoAcc = removeVietnameseAccents(hint.toLowerCase());
              if (gSlug.includes(hintNoAcc) || gName.includes(hintNoAcc)) {
                boost += 0.4;
              }
            }

            if (aiAnalysis.entities.activities.includes('study') && (gSlug.includes('lo-fi') || gSlug.includes('ambient'))) {
              boost += 0.3;
            }
            if (aiAnalysis.entities.moods.includes('chill') && (gSlug.includes('lo-fi') || gSlug.includes('ambient'))) {
              boost += 0.3;
            }
            if (aiAnalysis.entities.activities.includes('workout') && (gSlug.includes('electronic') || gSlug.includes('synthwave') || gSlug.includes('hip-hop'))) {
              boost += 0.3;
            }

            if (boost > 0) {
              semanticBoostMap.set(s.id, Math.min(1.0, boost));
            }
          }
        }

        // 5. Rank and Sort Results
        const rankedSongs = RankingEngine.rankSongs(rawQuery, dbSongs, semanticBoostMap, lyricsMatches)
          .slice(0, limit)
          .map((r) => ({
            ...r.item,
            _matchScore: r.score,
            _matchType: r.matchType,
          }));

        const rankedArtists = RankingEngine.rankArtists(rawQuery, dbArtists)
          .slice(0, 6)
          .map((r) => r.item);

        const rankedAlbums = RankingEngine.rankAlbums(rawQuery, dbAlbums)
          .slice(0, 6)
          .map((r) => r.item);

        const rankedPlaylists = dbPlaylists.slice(0, 6);
        const rankedGenres = dbGenres.slice(0, 6);

        // 6. Determine Top Match
        let topMatch: { type: 'song' | 'artist' | 'album' | 'playlist'; item: any } | undefined = undefined;

        if (rankedArtists.length > 0) {
          const topArtistScore = computeMatchScore(rawQuery, rankedArtists[0].name);
          if (topArtistScore.isExact) {
            topMatch = { type: 'artist', item: rankedArtists[0] };
          }
        }

        if (!topMatch && rankedSongs.length > 0) {
          const topSongScore = computeMatchScore(rawQuery, rankedSongs[0].title);
          if (topSongScore.isExact) {
            topMatch = { type: 'song', item: rankedSongs[0] };
          }
        }

        if (!topMatch && rankedAlbums.length > 0) {
          const topAlbumScore = computeMatchScore(rawQuery, rankedAlbums[0].title);
          if (topAlbumScore.isExact) {
            topMatch = { type: 'album', item: rankedAlbums[0] };
          }
        }

        return {
          query: rawQuery,
          intent: aiAnalysis.intent,
          explanation: aiAnalysis.explanation,
          isRecommendation: aiAnalysis.isRecommendation,
          songs: rankedSongs,
          artists: rankedArtists,
          albums: rankedAlbums,
          playlists: rankedPlaylists,
          genres: rankedGenres,
          topMatch,
          providerUsed: aiAnalysis.providerUsed,
        };
      },
      120 // Cache for 2 minutes with Single-Flight stampede protection
    );
  }

  /**
   * Fast Autocomplete Suggestions
   */
  public static async getSuggestions(query: string, limit = 8): Promise<any> {
    const rawQuery = String(query || '').trim();
    if (!rawQuery) {
      return this.getEmptyQueryFallback();
    }

    const norm = normalizeQuery(rawQuery);
    const cacheKey = `suggestions:${norm.noAccents}:${limit}`;

    return appCache.getOrSet(
      cacheKey,
      async () => {
        // Run parallel lightweight search
        const [songs, artists, albums, playlists, genres] = await Promise.all([
          prisma.song.findMany({
            where: {
              OR: [
                { title: { contains: norm.clean, mode: 'insensitive' } },
                { artist: { name: { contains: norm.clean, mode: 'insensitive' } } },
              ],
            },
            take: limit,
            include: {
              artist: { select: { id: true, name: true, avatarUrl: true } },
              album: { select: { id: true, title: true, coverUrl: true } },
            },
            orderBy: { playsCount: 'desc' },
          }),
          prisma.artist.findMany({
            where: { name: { contains: norm.clean, mode: 'insensitive' } },
            take: 4,
            select: { id: true, name: true, avatarUrl: true, verified: true, monthlyListeners: true },
            orderBy: { monthlyListeners: 'desc' },
          }),
          prisma.album.findMany({
            where: {
              OR: [
                { title: { contains: norm.clean, mode: 'insensitive' } },
                { artist: { name: { contains: norm.clean, mode: 'insensitive' } } },
              ],
            },
            take: 3,
            include: { artist: { select: { id: true, name: true } } },
          }),
          prisma.playlist.findMany({
            where: { title: { contains: norm.clean, mode: 'insensitive' }, isPublic: true },
            take: 3,
            select: { id: true, title: true, coverUrl: true },
          }),
          prisma.genre.findMany({
            where: { name: { contains: norm.clean, mode: 'insensitive' } },
            take: 3,
          }),
        ]);

        // Rank songs & artists
        const rankedSongs = RankingEngine.rankSongs(rawQuery, songs).slice(0, 5).map((r) => r.item);
        const rankedArtists = RankingEngine.rankArtists(rawQuery, artists).slice(0, 3).map((r) => r.item);

        // Check if query is mood/recommendation
        const aiAnalysis = await aiSearchManager.analyzeQuery(rawQuery);

        return {
          query: rawQuery,
          intent: aiAnalysis.intent,
          explanation: aiAnalysis.explanation,
          isRecommendation: aiAnalysis.isRecommendation,
          songs: rankedSongs,
          artists: rankedArtists,
          albums,
          playlists,
          genres,
        };
      },
      120
    );
  }

  /**
   * Returns dynamically computed trending queries & genres from DB
   */
  public static async getTrending(): Promise<any> {
    const cacheKey = 'trending:queries';
    return appCache.getOrSet(
      cacheKey,
      async () => {
        const [topArtists, topSongs, genres] = await Promise.all([
          prisma.artist.findMany({
            take: 6,
            orderBy: { monthlyListeners: 'desc' },
            select: { id: true, name: true, avatarUrl: true },
          }),
          prisma.song.findMany({
            take: 6,
            orderBy: { playsCount: 'desc' },
            select: { id: true, title: true },
          }),
          prisma.genre.findMany({
            take: 8,
            select: { id: true, name: true, slug: true, color: true },
          }),
        ]);

        const trendingQueries = [
          ...topArtists.map((a) => a.name),
          ...topSongs.map((s) => s.title),
          'nhạc chill',
          'nhạc acoustic nhẹ nhàng',
          'nhạc tập trung học bài',
        ].slice(0, 8);

        return {
          trendingQueries,
          topArtists,
          topSongs,
          genres,
        };
      },
      300 // Cache for 5 minutes
    );
  }

  // ==========================================
  // CANDIDATE RETRIEVAL HELPERS
  // ==========================================

  private static async findSongCandidates(
    norm: ReturnType<typeof normalizeQuery>,
    ai: AIAnalysisResult,
    userId?: string
  ): Promise<any[]> {
    const orConditions: any[] = [
      { title: { contains: norm.clean, mode: 'insensitive' } },
      { artist: { name: { contains: norm.clean, mode: 'insensitive' } } },
    ];

    // If query has multiple tokens, search individual key tokens
    if (norm.tokens.length > 1) {
      for (const token of norm.tokens.slice(0, 3)) {
        if (token.length >= 2) {
          orConditions.push({ title: { contains: token, mode: 'insensitive' } });
        }
      }
    }

    // Genre-based expansion if AI detected mood or genre
    if (ai.suggestedGenres.length > 0) {
      orConditions.push({
        genre: {
          slug: { in: ai.suggestedGenres },
        },
      });
    }

    // If user asked for artist specific songs
    if (ai.entities.artistName) {
      orConditions.push({
        artist: { name: { contains: ai.entities.artistName, mode: 'insensitive' } },
      });
    }

    const songs = await prisma.song.findMany({
      where: { OR: orConditions },
      take: 25,
      include: {
        artist: { select: { id: true, name: true, avatarUrl: true, verified: true } },
        album: { select: { id: true, title: true, coverUrl: true } },
        genre: { select: { id: true, name: true, slug: true, color: true } },
        ...(userId
          ? {
              favorites: {
                where: { userId },
                select: { id: true },
              },
            }
          : {}),
      },
    });

    return songs.map((s: any) => ({
      ...s,
      isLiked: userId ? Boolean(s.favorites && s.favorites.length > 0) : false,
      favorites: undefined,
    }));
  }

  private static async findArtistCandidates(
    norm: ReturnType<typeof normalizeQuery>,
    ai: AIAnalysisResult
  ): Promise<any[]> {
    const artistConditions: any[] = [{ name: { contains: norm.clean, mode: 'insensitive' } }];

    if (ai.entities.artistName) {
      artistConditions.push({ name: { contains: ai.entities.artistName, mode: 'insensitive' } });
    }

    // Individual tokens
    for (const token of norm.tokens.slice(0, 2)) {
      if (token.length >= 3) {
        artistConditions.push({ name: { contains: token, mode: 'insensitive' } });
      }
    }

    return prisma.artist.findMany({
      where: { OR: artistConditions },
      take: 10,
      include: {
        _count: { select: { songs: true, followers: true } },
      },
    });
  }

  private static async findAlbumCandidates(
    norm: ReturnType<typeof normalizeQuery>,
    ai: AIAnalysisResult
  ): Promise<any[]> {
    const orConditions: any[] = [
      { title: { contains: norm.clean, mode: 'insensitive' } },
      { artist: { name: { contains: norm.clean, mode: 'insensitive' } } },
    ];

    if (ai.entities.albumTitle) {
      orConditions.push({ title: { contains: ai.entities.albumTitle, mode: 'insensitive' } });
    }

    return prisma.album.findMany({
      where: { OR: orConditions },
      take: 8,
      include: {
        artist: { select: { id: true, name: true } },
        _count: { select: { songs: true } },
      },
    });
  }

  private static async findPlaylistCandidates(
    norm: ReturnType<typeof normalizeQuery>,
    ai: AIAnalysisResult
  ): Promise<any[]> {
    const orConditions: any[] = [{ title: { contains: norm.clean, mode: 'insensitive' } }];

    // If mood / activity detected, match against playlist description/title
    if (ai.entities.moods.length > 0 || ai.entities.activities.length > 0) {
      for (const m of ai.entities.moods) {
        orConditions.push({ title: { contains: m, mode: 'insensitive' } });
        orConditions.push({ description: { contains: m, mode: 'insensitive' } });
      }
      for (const a of ai.entities.activities) {
        orConditions.push({ title: { contains: a, mode: 'insensitive' } });
        orConditions.push({ description: { contains: a, mode: 'insensitive' } });
      }
    }

    return prisma.playlist.findMany({
      where: {
        OR: orConditions,
        isPublic: true,
      },
      take: 8,
      include: {
        user: { select: { id: true, username: true } },
        _count: { select: { songs: true } },
      },
    });
  }

  private static async findGenreCandidates(
    norm: ReturnType<typeof normalizeQuery>,
    ai: AIAnalysisResult
  ): Promise<any[]> {
    const conditions: any[] = [{ name: { contains: norm.clean, mode: 'insensitive' } }];

    if (ai.suggestedGenres.length > 0) {
      conditions.push({ slug: { in: ai.suggestedGenres } });
    }

    return prisma.genre.findMany({
      where: { OR: conditions },
      take: 6,
    });
  }

  private static async findLyricsMatches(norm: ReturnType<typeof normalizeQuery>): Promise<Set<string>> {
    const matchedSongIds = new Set<string>();

    if (norm.clean.length < 5) return matchedSongIds;

    try {
      const lyrics = await prisma.lyrics.findMany({
        where: {
          plainLyrics: { contains: norm.clean, mode: 'insensitive' },
        },
        select: { songId: true },
        take: 10,
      });

      lyrics.forEach((l) => matchedSongIds.add(l.songId));
    } catch {
      // Graceful fallback if lyrics table search fails
    }

    return matchedSongIds;
  }

  private static async getEmptyQueryFallback(): Promise<HybridSearchResult> {
    const [genres, topArtists] = await Promise.all([
      prisma.genre.findMany({
        take: 12,
        include: { _count: { select: { songs: true } } },
      }),
      prisma.artist.findMany({
        take: 6,
        orderBy: { monthlyListeners: 'desc' },
        select: { id: true, name: true, avatarUrl: true, verified: true },
      }),
    ]);

    return {
      query: '',
      intent: 'GENERAL_MUSIC_SEARCH',
      isRecommendation: false,
      songs: [],
      artists: topArtists,
      albums: [],
      playlists: [],
      genres,
      providerUsed: 'fallback',
    };
  }
}
