/**
 * Intelligent Rule-Based Semantic Analyzer (Vietnamese & English)
 * MusicWave AI Smart Search Engine
 */

import { IAIProvider, AIAnalysisResult, SearchContext, SearchIntent, QueryEntities } from './aiTypes.js';
import { normalizeQuery, removeVietnameseAccents } from '../textNormalizer.js';

// Mood vocabulary mappings
const MOOD_DICTIONARY: Record<string, { mood: string; genreHints: string[]; labelVi: string }> = {
  // Chill / Relax
  chill: { mood: 'chill', genreHints: ['lo-fi', 'ambient', 'acoustic'], labelVi: 'Chill' },
  lofi: { mood: 'chill', genreHints: ['lo-fi'], labelVi: 'Lo-Fi' },
  'lo-fi': { mood: 'chill', genreHints: ['lo-fi'], labelVi: 'Lo-Fi' },
  'thu gian': { mood: 'relax', genreHints: ['lo-fi', 'ambient', 'jazz'], labelVi: 'Thư giãn' },
  'nhe nhang': { mood: 'relax', genreHints: ['lo-fi', 'acoustic', 'ambient'], labelVi: 'Nhẹ nhàng' },
  'binh yen': { mood: 'relax', genreHints: ['ambient', 'lo-fi'], labelVi: 'Bình yên' },
  relax: { mood: 'relax', genreHints: ['lo-fi', 'ambient'], labelVi: 'Thư giãn' },
  peaceful: { mood: 'relax', genreHints: ['ambient', 'acoustic'], labelVi: 'Bình yên' },

  // Sad / Melancholy
  buon: { mood: 'sad', genreHints: ['ballad', 'indie-rock', 'lo-fi'], labelVi: 'Tâm trạng' },
  'that tinh': { mood: 'heartbreak', genreHints: ['ballad', 'pop', 'indie-rock'], labelVi: 'Thất tình' },
  'tam trang': { mood: 'sad', genreHints: ['ballad', 'lo-fi', 'indie-rock'], labelVi: 'Tâm trạng' },
  sad: { mood: 'sad', genreHints: ['ballad', 'lo-fi'], labelVi: 'Buồn' },
  heartbreak: { mood: 'heartbreak', genreHints: ['ballad'], labelVi: 'Thất tình' },
  lonely: { mood: 'lonely', genreHints: ['ambient', 'lo-fi'], labelVi: 'Cô đơn' },
  'co don': { mood: 'lonely', genreHints: ['ambient', 'lo-fi'], labelVi: 'Cô đơn' },

  // Happy / Upbeat / Energetic
  vui: { mood: 'happy', genreHints: ['pop', 'electronic', 'hip-hop'], labelVi: 'Vui tươi' },
  'vui ve': { mood: 'happy', genreHints: ['pop', 'electronic'], labelVi: 'Vui vẻ' },
  'soi dong': { mood: 'energetic', genreHints: ['electronic', 'synthwave', 'pop'], labelVi: 'Sôi động' },
  happy: { mood: 'happy', genreHints: ['pop', 'electronic'], labelVi: 'Vui vẻ' },
  energetic: { mood: 'energetic', genreHints: ['electronic', 'synthwave', 'hip-hop'], labelVi: 'Năng động' },
  hype: { mood: 'energetic', genreHints: ['hip-hop', 'electronic'], labelVi: 'Sôi động' },
  boc: { mood: 'energetic', genreHints: ['electronic', 'hip-hop'], labelVi: 'Cháy' },

  // Focus / Deep
  'tap trung': { mood: 'focus', genreHints: ['ambient', 'lo-fi', 'electronic'], labelVi: 'Tập trung' },
  focus: { mood: 'focus', genreHints: ['ambient', 'lo-fi'], labelVi: 'Tập trung' },
  'sau lang': { mood: 'deep', genreHints: ['ambient', 'jazz'], labelVi: 'Sâu lắng' },
  deep: { mood: 'deep', genreHints: ['ambient', 'electronic'], labelVi: 'Deep' },
  ambient: { mood: 'ambient', genreHints: ['ambient'], labelVi: 'Ambient' },

  // Romantic / Love
  'lang man': { mood: 'romantic', genreHints: ['jazz', 'pop', 'lo-fi'], labelVi: 'Lãng mạn' },
  love: { mood: 'romantic', genreHints: ['pop', 'jazz', 'lo-fi'], labelVi: 'Tình yêu' },
  romantic: { mood: 'romantic', genreHints: ['jazz', 'pop'], labelVi: 'Lãng mạn' },
  'tinh yeu': { mood: 'romantic', genreHints: ['pop', 'jazz'], labelVi: 'Tình yêu' },
};

// Activity vocabulary mappings
const ACTIVITY_DICTIONARY: Record<string, { activity: string; genreHints: string[]; labelVi: string }> = {
  // Study
  'hoc bai': { activity: 'study', genreHints: ['lo-fi', 'ambient'], labelVi: 'Học tập' },
  'de hoc': { activity: 'study', genreHints: ['lo-fi', 'ambient'], labelVi: 'Học bài' },
  study: { activity: 'study', genreHints: ['lo-fi', 'ambient'], labelVi: 'Học bài' },
  'doc sach': { activity: 'reading', genreHints: ['lo-fi', 'ambient', 'jazz'], labelVi: 'Đọc sách' },
  reading: { activity: 'reading', genreHints: ['lo-fi', 'ambient'], labelVi: 'Đọc sách' },

  // Work / Coding
  'lam viec': { activity: 'work', genreHints: ['lo-fi', 'synthwave', 'ambient'], labelVi: 'Làm việc' },
  work: { activity: 'work', genreHints: ['lo-fi', 'synthwave'], labelVi: 'Làm việc' },
  code: { activity: 'work', genreHints: ['synthwave', 'lo-fi', 'electronic'], labelVi: 'Coding' },
  coding: { activity: 'work', genreHints: ['synthwave', 'electronic', 'lo-fi'], labelVi: 'Lập trình' },

  // Sleep
  'de ngu': { activity: 'sleep', genreHints: ['ambient', 'lo-fi'], labelVi: 'Ngủ ngon' },
  'di ngu': { activity: 'sleep', genreHints: ['ambient', 'lo-fi'], labelVi: 'Đi ngủ' },
  sleep: { activity: 'sleep', genreHints: ['ambient', 'lo-fi'], labelVi: 'Giấc ngủ' },

  // Workout / Gym
  'tap gym': { activity: 'workout', genreHints: ['electronic', 'hip-hop', 'synthwave'], labelVi: 'Tập Gym' },
  gym: { activity: 'workout', genreHints: ['electronic', 'hip-hop'], labelVi: 'Gym' },
  'tap the duc': { activity: 'workout', genreHints: ['electronic', 'pop'], labelVi: 'Thể thao' },
  'chay bo': { activity: 'running', genreHints: ['electronic', 'synthwave', 'pop'], labelVi: 'Chạy bộ' },
  workout: { activity: 'workout', genreHints: ['electronic', 'hip-hop'], labelVi: 'Workout' },
  running: { activity: 'running', genreHints: ['electronic', 'synthwave'], labelVi: 'Chạy bộ' },

  // Driving
  'lai xe': { activity: 'drive', genreHints: ['synthwave', 'indie-rock', 'electronic'], labelVi: 'Lái xe' },
  drive: { activity: 'drive', genreHints: ['synthwave', 'indie-rock'], labelVi: 'Lái xe' },
  'di phuot': { activity: 'travel', genreHints: ['indie-rock', 'pop', 'synthwave'], labelVi: 'Phượt' },
  travel: { activity: 'travel', genreHints: ['indie-rock', 'pop'], labelVi: 'Du lịch' },

  // Party / Cafe
  'party': { activity: 'party', genreHints: ['electronic', 'hip-hop', 'pop'], labelVi: 'Party' },
  'tiec tung': { activity: 'party', genreHints: ['electronic', 'pop'], labelVi: 'Tiệc tùng' },
  'ca phe': { activity: 'cafe', genreHints: ['lo-fi', 'jazz', 'acoustic'], labelVi: 'Cà phê' },
  'cafe': { activity: 'cafe', genreHints: ['lo-fi', 'jazz', 'acoustic'], labelVi: 'Quán Cafe' },
};

// Time of day mappings
const TIME_DICTIONARY: Record<string, { time: 'morning' | 'afternoon' | 'evening' | 'night'; genreHints: string[]; labelVi: string }> = {
  'ban dem': { time: 'night', genreHints: ['synthwave', 'lo-fi', 'ambient'], labelVi: 'Đêm khuya' },
  'dem': { time: 'night', genreHints: ['synthwave', 'lo-fi', 'ambient'], labelVi: 'Ban đêm' },
  've dem': { time: 'night', genreHints: ['lo-fi', 'ambient', 'synthwave'], labelVi: 'Về đêm' },
  'buoi toi': { time: 'evening', genreHints: ['lo-fi', 'jazz', 'pop'], labelVi: 'Buổi tối' },
  'toi': { time: 'evening', genreHints: ['lo-fi', 'jazz'], labelVi: 'Buổi tối' },
  night: { time: 'night', genreHints: ['synthwave', 'lo-fi', 'ambient'], labelVi: 'Night' },
  'buoi sang': { time: 'morning', genreHints: ['pop', 'acoustic', 'lo-fi'], labelVi: 'Buổi sáng' },
  'sang': { time: 'morning', genreHints: ['acoustic', 'pop'], labelVi: 'Buổi sáng' },
  morning: { time: 'morning', genreHints: ['acoustic', 'pop'], labelVi: 'Buổi sáng' },
  'hoang hon': { time: 'evening', genreHints: ['synthwave', 'lo-fi', 'pop'], labelVi: 'Hoàng hôn' },
  sunset: { time: 'evening', genreHints: ['synthwave', 'pop'], labelVi: 'Sunset' },
};

export class RuleBasedSemanticProvider implements IAIProvider {
  public name = 'RuleBasedSemanticProvider';

  public isAvailable(): boolean {
    return true;
  }

  public async analyzeQuery(query: string, context?: SearchContext): Promise<AIAnalysisResult> {
    const norm = normalizeQuery(query);
    const textNoAcc = norm.noAccents;

    const entities: QueryEntities = {
      moods: [],
      activities: [],
      keywords: [],
      language: norm.hasVietnameseChars ? 'vi' : 'all',
    };

    const suggestedGenres = new Set<string>();
    const explanationParts: string[] = [];

    // 1. Check for Similar Song / Similar Artist Intent
    const isSimilarSongQuery =
      /giong bai|nhu bai|tuong tu bai|similar to|song like|same as/i.test(textNoAcc);

    if (isSimilarSongQuery) {
      return {
        query,
        intent: 'SIMILAR_SONG',
        confidence: 0.9,
        entities,
        isRecommendation: true,
        explanation: 'Nhạc tương tự bài hát đang nghe',
        suggestedGenres: context?.currentGenreId ? [context.currentGenreId] : [],
        suggestedKeywords: [],
        providerUsed: 'rule_based',
      };
    }

    // 2. Check for Artist/Song explicit patterns (e.g. "nhac cua son tung", "bai hat cua taylor swift", "album cua...")
    const artistOfMatch = textNoAcc.match(/(?:nhac cua|bai hat cua|ca si|ca khuc cua|songs by|by artist)\s+(.+)/i);
    if (artistOfMatch && artistOfMatch[1]) {
      const extractedArtist = artistOfMatch[1].trim();
      entities.artistName = extractedArtist;
      return {
        query,
        intent: 'ARTIST_SONG_SEARCH',
        confidence: 0.88,
        entities,
        isRecommendation: false,
        explanation: `Nghệ sĩ: ${extractedArtist}`,
        suggestedGenres: [],
        suggestedKeywords: [extractedArtist],
        providerUsed: 'rule_based',
      };
    }

    const albumOfMatch = textNoAcc.match(/(?:album cua|album)\s+(.+)/i);
    if (albumOfMatch && albumOfMatch[1]) {
      const extractedAlbum = albumOfMatch[1].trim();
      entities.albumTitle = extractedAlbum;
      return {
        query,
        intent: 'ALBUM_SEARCH',
        confidence: 0.85,
        entities,
        isRecommendation: false,
        explanation: `Album: ${extractedAlbum}`,
        suggestedGenres: [],
        suggestedKeywords: [extractedAlbum],
        providerUsed: 'rule_based',
      };
    }

    // 3. Scan for Mood keywords
    for (const [key, val] of Object.entries(MOOD_DICTIONARY)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(textNoAcc) || textNoAcc.includes(key)) {
        if (!entities.moods.includes(val.mood)) {
          entities.moods.push(val.mood);
          val.genreHints.forEach((g) => suggestedGenres.add(g));
          if (!explanationParts.includes(val.labelVi)) {
            explanationParts.push(val.labelVi);
          }
        }
      }
    }

    // 4. Scan for Activity keywords
    for (const [key, val] of Object.entries(ACTIVITY_DICTIONARY)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(textNoAcc) || textNoAcc.includes(key)) {
        if (!entities.activities.includes(val.activity)) {
          entities.activities.push(val.activity);
          val.genreHints.forEach((g) => suggestedGenres.add(g));
          if (!explanationParts.includes(val.labelVi)) {
            explanationParts.push(val.labelVi);
          }
        }
      }
    }

    // 5. Scan for Time of day keywords
    for (const [key, val] of Object.entries(TIME_DICTIONARY)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(textNoAcc) || textNoAcc.includes(key)) {
        if (!entities.timeOfDay) {
          entities.timeOfDay = val.time;
          val.genreHints.forEach((g) => suggestedGenres.add(g));
          if (!explanationParts.includes(val.labelVi)) {
            explanationParts.push(val.labelVi);
          }
        }
      }
    }

    // 6. Determine intent
    let intent: SearchIntent = 'GENERAL_MUSIC_SEARCH';
    let isRecommendation = false;

    if (entities.moods.length > 0 && entities.activities.length > 0) {
      intent = 'RECOMMENDATION';
      isRecommendation = true;
    } else if (entities.moods.length > 0) {
      intent = 'MOOD_SEARCH';
      isRecommendation = true;
    } else if (entities.activities.length > 0 || entities.timeOfDay) {
      intent = 'RECOMMENDATION';
      isRecommendation = true;
    } else if (/^album\s+/i.test(textNoAcc)) {
      intent = 'ALBUM_SEARCH';
    } else if (/^playlist\s+/i.test(textNoAcc) || /^danh sach phat/i.test(textNoAcc)) {
      intent = 'PLAYLIST_SEARCH';
    } else if (/^ca si\s+/i.test(textNoAcc) || /^nghe si\s+/i.test(textNoAcc) || /^artist\s+/i.test(textNoAcc)) {
      intent = 'ARTIST_SEARCH';
    } else if (/^bai hat\s+/i.test(textNoAcc) || /^song\s+/i.test(textNoAcc)) {
      intent = 'SONG_SEARCH';
    } else {
      intent = 'GENERAL_MUSIC_SEARCH';
    }

    let explanation: string | undefined = undefined;
    if (explanationParts.length > 0) {
      explanation = `Đề xuất dựa trên: ${explanationParts.slice(0, 3).join(' · ')}`;
    }

    return {
      query,
      intent,
      confidence: isRecommendation ? 0.85 : 0.7,
      entities,
      isRecommendation,
      explanation,
      suggestedGenres: Array.from(suggestedGenres),
      suggestedKeywords: norm.noAccentTokens,
      providerUsed: 'rule_based',
    };
  }
}
