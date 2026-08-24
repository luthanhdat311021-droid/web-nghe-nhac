import { Song } from '../types/index.js';

/**
 * Extracts a YouTube 11-character video ID from multiple URL variants or raw ID.
 */
export const extractYoutubeId = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();

  // If already an 11-char alphanumeric ID (with _ or -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Common YouTube URL formats (watch?v=, youtu.be/, embed/, shorts/, music.youtube.com)
  const regex =
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/i;
  const match = trimmed.match(regex);
  return match ? match[1] : null;
};

/**
 * Determines whether a song entity uses YouTube as its playback source.
 */
export const isYouTubeSource = (song?: Song | null): boolean => {
  if (!song) return false;
  if (song.sourceType === 'youtube') return true;
  if (song.youtubeId && song.youtubeId.trim().length > 0) return true;
  if (song.youtubeUrl && extractYoutubeId(song.youtubeUrl)) return true;
  if (song.audioUrl && extractYoutubeId(song.audioUrl)) return true;
  return false;
};

/**
 * Retrieves the YouTube Video ID from any available field in the song object.
 */
export const getSongYoutubeId = (song?: Song | null): string | null => {
  if (!song) return null;
  if (song.youtubeId && song.youtubeId.trim().length > 0) {
    return song.youtubeId.trim();
  }
  if (song.youtubeUrl) {
    const id = extractYoutubeId(song.youtubeUrl);
    if (id) return id;
  }
  if (song.audioUrl) {
    const id = extractYoutubeId(song.audioUrl);
    if (id) return id;
  }
  return null;
};
