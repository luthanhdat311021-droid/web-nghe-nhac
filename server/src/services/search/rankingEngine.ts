/**
 * Search Ranking & Scoring Engine
 * MusicWave AI Smart Search Engine
 *
 * Scoring Formula:
 * Score = 0.40 * ExactMatch + 0.25 * PrefixMatch + 0.20 * FuzzyScore
 *       + 0.15 * SemanticScore + 0.10 * PopularityScore + 0.05 * RecencyScore
 */

import { computeMatchScore } from './fuzzyMatcher.js';
import { removeVietnameseAccents } from './textNormalizer.js';

export interface ScoredItem<T> {
  item: T;
  score: number;
  matchType: 'exact' | 'prefix' | 'fuzzy' | 'semantic' | 'lyrics';
  reasons: string[];
}

export class RankingEngine {
  /**
   * Scores and ranks song items
   */
  public static rankSongs(
    query: string,
    songs: any[],
    semanticBoostMap: Map<string, number> = new Map(),
    lyricsMatches: Set<string> = new Set()
  ): ScoredItem<any>[] {
    const qClean = query.toLowerCase().trim();
    const qNoAcc = removeVietnameseAccents(qClean);
    const scored: ScoredItem<any>[] = [];

    // Find maximum plays count for normalization
    let maxPlays = 1;
    for (const s of songs) {
      if (s.playsCount && s.playsCount > maxPlays) {
        maxPlays = s.playsCount;
      }
    }

    for (const song of songs) {
      const titleMatch = computeMatchScore(query, song.title);
      const artistMatch = song.artist ? computeMatchScore(query, song.artist.name) : { score: 0, isExact: false, isPrefix: false, isSubstring: false, isFuzzy: false };
      const albumMatch = song.album ? computeMatchScore(query, song.album.title) : { score: 0, isExact: false, isPrefix: false, isSubstring: false, isFuzzy: false };
      const genreMatch = song.genre ? computeMatchScore(query, song.genre.name) : { score: 0, isExact: false, isPrefix: false, isSubstring: false, isFuzzy: false };

      const bestTextScore = Math.max(
        titleMatch.score * 1.0,
        artistMatch.score * 0.85,
        albumMatch.score * 0.70,
        genreMatch.score * 0.65
      );

      // Popularity normalization (log scale)
      const popularityRatio = Math.log10(1 + (song.playsCount || 0)) / Math.log10(1 + maxPlays);
      const popularityScore = Math.min(1, Math.max(0, popularityRatio));

      // Semantic boost
      const semanticScore = semanticBoostMap.get(song.id) || 0;

      // Lyrics bonus
      const isLyricMatch = lyricsMatches.has(song.id);
      const lyricsBonus = isLyricMatch ? 0.35 : 0;

      // Calculate composite score
      let totalScore = 0;
      let matchType: 'exact' | 'prefix' | 'fuzzy' | 'semantic' | 'lyrics' = 'fuzzy';
      const reasons: string[] = [];

      if (titleMatch.isExact) {
        totalScore = 0.95 + popularityScore * 0.05;
        matchType = 'exact';
        reasons.push('Khớp tiêu đề chính xác');
      } else if (artistMatch.isExact) {
        totalScore = 0.90 + popularityScore * 0.05;
        matchType = 'exact';
        reasons.push('Khớp nghệ sĩ chính xác');
      } else if (titleMatch.isPrefix || artistMatch.isPrefix) {
        totalScore = 0.80 + bestTextScore * 0.15 + popularityScore * 0.05;
        matchType = 'prefix';
        reasons.push('Khớp tiền tố');
      } else if (isLyricMatch) {
        totalScore = 0.70 + lyricsBonus * 0.2 + popularityScore * 0.05;
        matchType = 'lyrics';
        reasons.push('Khớp lời bài hát');
      } else if (semanticScore > 0) {
        totalScore = 0.60 + semanticScore * 0.30 + popularityScore * 0.05;
        matchType = 'semantic';
        reasons.push('Khớp ngữ nghĩa AI');
      } else {
        totalScore = bestTextScore * 0.75 + popularityScore * 0.15;
        matchType = 'fuzzy';
        if (titleMatch.isFuzzy || artistMatch.isFuzzy) {
          reasons.push('Gần đúng (Fuzzy/Typo)');
        }
      }

      scored.push({
        item: song,
        score: totalScore,
        matchType,
        reasons,
      });
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * Scores and ranks artists
   */
  public static rankArtists(query: string, artists: any[]): ScoredItem<any>[] {
    const scored: ScoredItem<any>[] = [];

    let maxListeners = 1;
    for (const a of artists) {
      if (a.monthlyListeners && a.monthlyListeners > maxListeners) {
        maxListeners = a.monthlyListeners;
      }
    }

    for (const artist of artists) {
      const match = computeMatchScore(query, artist.name);
      const popRatio = Math.log10(1 + (artist.monthlyListeners || 0)) / Math.log10(1 + maxListeners);

      let totalScore = 0;
      let matchType: 'exact' | 'prefix' | 'fuzzy' | 'semantic' | 'lyrics' = 'fuzzy';

      if (match.isExact) {
        totalScore = 0.96 + popRatio * 0.04;
        matchType = 'exact';
      } else if (match.isPrefix) {
        totalScore = 0.82 + match.score * 0.12 + popRatio * 0.04;
        matchType = 'prefix';
      } else {
        totalScore = match.score * 0.80 + popRatio * 0.15;
        matchType = 'fuzzy';
      }

      scored.push({
        item: artist,
        score: totalScore,
        matchType,
        reasons: [matchType],
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * Scores and ranks albums
   */
  public static rankAlbums(query: string, albums: any[]): ScoredItem<any>[] {
    const scored: ScoredItem<any>[] = [];

    for (const album of albums) {
      const titleMatch = computeMatchScore(query, album.title);
      const artistMatch = album.artist ? computeMatchScore(query, album.artist.name) : { score: 0, isExact: false, isPrefix: false, isSubstring: false, isFuzzy: false };

      const bestScore = Math.max(titleMatch.score, artistMatch.score * 0.8);
      let matchType: 'exact' | 'prefix' | 'fuzzy' | 'semantic' | 'lyrics' = 'fuzzy';

      if (titleMatch.isExact) {
        matchType = 'exact';
      } else if (titleMatch.isPrefix || artistMatch.isPrefix) {
        matchType = 'prefix';
      }

      scored.push({
        item: album,
        score: bestScore,
        matchType,
        reasons: [matchType],
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }
}
