/**
 * AI Search Engine Interfaces & Intent Classifications
 * MusicWave AI Smart Search Engine
 */

export type SearchIntent =
  | 'SONG_SEARCH'
  | 'ARTIST_SEARCH'
  | 'ALBUM_SEARCH'
  | 'PLAYLIST_SEARCH'
  | 'GENRE_SEARCH'
  | 'MOOD_SEARCH'
  | 'RECOMMENDATION'
  | 'ARTIST_SONG_SEARCH'
  | 'ALBUM_SONG_SEARCH'
  | 'SIMILAR_SONG'
  | 'SIMILAR_ARTIST'
  | 'GENERAL_MUSIC_SEARCH'
  | 'UNKNOWN';

export interface QueryEntities {
  songTitle?: string;
  artistName?: string;
  albumTitle?: string;
  genreName?: string;
  moods: string[];
  activities: string[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  keywords: string[];
  lyricsQuote?: string;
  country?: string;
  language?: 'vi' | 'en' | 'all';
}

export interface AIAnalysisResult {
  query: string;
  intent: SearchIntent;
  confidence: number;
  entities: QueryEntities;
  isRecommendation: boolean;
  explanation?: string;       // e.g. "Chill · Học tập" or "Nghệ sĩ Sơn Tùng M-TP"
  suggestedGenres: string[];
  suggestedKeywords: string[];
  providerUsed: 'rule_based' | 'gemini' | 'openai' | 'fallback';
}

export interface SearchContext {
  userId?: string;
  currentSongId?: string;
  currentArtistId?: string;
  currentGenreId?: string;
}

export interface IAIProvider {
  name: string;
  isAvailable(): boolean;
  analyzeQuery(query: string, context?: SearchContext): Promise<AIAnalysisResult>;
}
