/**
 * Text Normalization & Vietnamese Accent Removal Utilities
 * MusicWave AI Smart Search Engine
 */

// Vietnamese character conversion map
const VIETNAMESE_ACCENTS_MAP: Record<string, string> = {
  à: 'a', á: 'a', ả: 'a', ã: 'a', ạ: 'a',
  â: 'a', ầ: 'a', ấ: 'a', ẩ: 'a', ẫ: 'a', ậ: 'a',
  ă: 'a', ằ: 'a', ắ: 'a', ẳ: 'a', ẵ: 'a', ặ: 'a',
  è: 'e', é: 'e', ẻ: 'e', ẽ: 'e', ẹ: 'e',
  ê: 'e', ề: 'e', ế: 'e', ể: 'e', ễ: 'e', ệ: 'e',
  ì: 'i', í: 'i', ỉ: 'i', ĩ: 'i', ị: 'i',
  ò: 'o', ó: 'o', ỏ: 'o', õ: 'o', ọ: 'o',
  ô: 'o', ồ: 'o', ố: 'o', ổ: 'o', ỗ: 'o', ộ: 'o',
  ơ: 'o', ờ: 'o', ớ: 'o', ở: 'o', ỡ: 'o', ợ: 'o',
  ù: 'u', ú: 'u', ủ: 'u', ũ: 'u', ụ: 'u',
  ư: 'u', ừ: 'u', ứ: 'u', ử: 'u', ữ: 'u', ự: 'u',
  ỳ: 'y', ý: 'y', ỷ: 'y', ỹ: 'y', ỵ: 'y',
  đ: 'd',
  // Uppercase
  À: 'A', Á: 'A', Ả: 'A', Ã: 'A', Ạ: 'A',
  Â: 'A', Ầ: 'A', Ấ: 'A', Ẩ: 'A', Ẫ: 'A', Ậ: 'A',
  Ă: 'A', Ằ: 'A', Ắ: 'A', Ẳ: 'A', Ẵ: 'A', Ặ: 'A',
  È: 'E', É: 'E', Ẻ: 'E', Ẽ: 'E', Ẹ: 'E',
  Ê: 'E', Ề: 'E', Ế: 'E', Ể: 'E', Ễ: 'E', Ệ: 'E',
  Ì: 'I', Í: 'I', Ỉ: 'I', Ĩ: 'I', Ị: 'I',
  Ò: 'O', Ó: 'O', Ỏ: 'O', Õ: 'O', Ọ: 'O',
  Ô: 'O', Ồ: 'O', Ố: 'O', Ổ: 'O', Ỗ: 'O', Ộ: 'O',
  Ơ: 'O', Ờ: 'O', Ớ: 'O', Ở: 'O', Ỡ: 'O', Ợ: 'O',
  Ù: 'U', Ú: 'U', Ủ: 'U', Ũ: 'U', Ụ: 'U',
  Ư: 'U', Ừ: 'U', Ứ: 'U', Sử: 'U', Ữ: 'U', Ự: 'U',
  Ỳ: 'Y', Ý: 'Y', Ỷ: 'Y', Ỹ: 'Y', Ỵ: 'Y',
  Đ: 'D',
};

/**
 * Strips all Vietnamese diacritics / accents from text.
 * e.g. "Sơn Tùng M-TP" -> "Son Tung M-TP"
 *      "Em Của Ngày Hôm Qua" -> "Em Cua Ngay Hom Qua"
 */
export function removeVietnameseAccents(text: string): string {
  if (!text) return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    result += VIETNAMESE_ACCENTS_MAP[char] || char;
  }
  // Normalize decomposed unicode characters
  return result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface NormalizedQueryInfo {
  raw: string;
  clean: string;              // lowercased, trimmed, single-spaced
  noAccents: string;          // lowercased, no Vietnamese accents
  compact: string;            // stripped spaces & punctuation (for compact fuzzy matching: "sontung")
  tokens: string[];           // word tokens
  noAccentTokens: string[];   // no accent word tokens
  isNaturalLanguage: boolean; // likely natural sentence / recommendation query
  hasVietnameseChars: boolean;
}

/**
 * Checks whether text contains Vietnamese accented characters
 */
export function containsVietnamese(text: string): boolean {
  return /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text);
}

/**
 * Thoroughly normalizes a query string for indexing & matching
 */
export function normalizeQuery(query: string): NormalizedQueryInfo {
  const raw = String(query || '');
  const clean = raw.toLowerCase().trim().replace(/\s+/g, ' ');
  const noAccents = removeVietnameseAccents(clean);
  const compact = noAccents.replace(/[^a-z0-9]/g, '');

  const tokens = clean
    .split(/[\s,.\-_/\\|]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const noAccentTokens = noAccents
    .split(/[\s,.\-_/\\|]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  // Natural language query heuristic indicators
  const naturalSentenceKeywords = [
    'nhac', 'bai hat', 'ca khuc', 'album cua', 'ca si', 'nghe khi', 'nghe luc',
    'de hoc', 'de ngu', 'tap gym', 'buon', 'chill', 'vui', 'thu gian', 'lai xe',
    'ban dem', 'buoi toi', 'buoi sang', 'giong bai', 'nhu bai', 'hay nhat',
    'moi nhat', 'song like', 'songs by', 'music for', 'chill music', 'study music',
  ];

  const lowerNoAccents = noAccents.toLowerCase();
  const isLongNaturalSentence = tokens.length >= 3;
  const containsNaturalKeyword = naturalSentenceKeywords.some((kw) =>
    lowerNoAccents.includes(removeVietnameseAccents(kw))
  );

  const isNaturalLanguage = isLongNaturalSentence || containsNaturalKeyword;

  return {
    raw,
    clean,
    noAccents,
    compact,
    tokens,
    noAccentTokens,
    isNaturalLanguage,
    hasVietnameseChars: containsVietnamese(raw),
  };
}
