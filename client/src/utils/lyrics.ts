import { SyncedLyricLine } from '../types/index.js';

export const parseSyncedLyrics = (lyricsRaw?: string | null): SyncedLyricLine[] => {
  if (!lyricsRaw) return [];

  // Try parsing JSON format first
  try {
    const parsed = JSON.parse(lyricsRaw);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].time === 'number') {
      return parsed.sort((a, b) => a.time - b.time);
    }
  } catch (e) {
    // If not JSON, parse standard LRC format: [mm:ss.xx] Lyrics text
  }

  const lines = lyricsRaw.split('\n');
  const result: SyncedLyricLine[] = [];
  const lrcRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;

  for (const line of lines) {
    const match = line.trim().match(lrcRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      const totalTime = minutes * 60 + seconds + milliseconds;
      const text = match[4].trim();
      if (text) {
        result.push({ time: totalTime, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
};
