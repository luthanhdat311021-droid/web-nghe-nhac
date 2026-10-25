// Automatic lyrics lookup from LRCLIB (https://lrclib.net), a free public lyrics database with time-synced LRC.
// Uploaded files usually carry YouTube-style titles ("Hngle - Tìm em ft. Bảo Anh | Official Music Video") and
// combined artists ("HNGLE / hưng lê"), so both are cleaned before searching and candidates are matched by
// normalized title, artist overlap and duration.

const LRCLIB = 'https://lrclib.net/api';
const USER_AGENT = 'MusicWave/1.0 (https://musicwave-app.vercel.app)';
const MAX_DURATION_GAP_SEC = 8;

export interface LyricsMatch {
  plainLyrics: string;
  syncedLyrics: string | null;
  source: { trackName: string; artistName: string; duration: number };
}

interface LrclibRecord {
  trackName: string;
  artistName: string;
  duration: number;
  instrumental?: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();

/** Individual artist names from "HNGLE / hưng lê", "A ft. B", "A & B", "A, B". */
export const splitArtists = (artist: string) =>
  artist.split(/\s*(?:\/|,|&|\bx\b|\bft\.?|\bfeat\.?|\bvs\.?)\s*/i).map((a) => a.trim()).filter(Boolean);

/** "Hngle - Tìm em ft. Bảo Anh | Official Music Video" by "HNGLE" → "Tìm em". */
export const cleanTitle = (title: string, artist = '') => {
  let t = title
    .replace(/\s*[|｜].*$/, '')
    .replace(/[([【][^)\]】]*(official|music video|mv|lyric|audio|video|visuali[sz]er|live|hd|4k|prod)[^)\]】]*[)\]】]/gi, '')
    .replace(/\s+(ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .trim();
  // Drop an "Artist - " prefix (or " - Artist" suffix) when that side names one of the song's artists.
  const parts = t.split(/\s+[-–—]\s+/);
  if (parts.length === 2) {
    const names = splitArtists(artist).map(normalize);
    const isArtist = (s: string) => names.some((n) => n && (normalize(s) === n || normalize(s).includes(n)));
    if (isArtist(parts[0])) t = parts[1];
    else if (isArtist(parts[1])) t = parts[0];
  }
  return t.trim() || title.trim();
};

const plainFromSynced = (synced: string) =>
  synced.split('\n').map((line) => line.replace(/^\s*(\[[^\]]*\])+\s*/, '')).join('\n').trim();

/** Best record for the song: same title, a shared artist, close duration, synced lyrics preferred. */
export const pickBest = (records: LrclibRecord[], title: string, artist: string, duration?: number) => {
  const wantTitle = normalize(title);
  const wantArtists = splitArtists(artist).map(normalize).filter(Boolean);
  const unknownArtist = wantArtists.length === 0 || wantArtists.every((a) => a === 'unknown artist' || a === 'various artists');
  let best: { record: LrclibRecord; score: number } | null = null;
  for (const r of records) {
    if (r.instrumental || (!r.plainLyrics && !r.syncedLyrics)) continue;
    if (normalize(r.trackName) !== wantTitle) continue;
    const gap = duration ? Math.abs(r.duration - duration) : 0;
    if (duration && gap > MAX_DURATION_GAP_SEC) continue;
    const theirArtist = normalize(r.artistName);
    const artistHit = wantArtists.some((a) => theirArtist.includes(a) || a.includes(theirArtist));
    // Many songs share a title; another singer's lyrics are worse than none. Only an unnamed artist is let through.
    if (!artistHit && !unknownArtist) continue;
    const score = (artistHit ? 100 : 0) + (r.syncedLyrics ? 20 : 0) - gap;
    if (!best || score > best.score) best = { record: r, score };
  }
  return best?.record ?? null;
};

const search = async (params: Record<string, string>): Promise<LrclibRecord[]> => {
  const response = await fetch(`${LRCLIB}/search?${new URLSearchParams(params)}`, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

/** Looks the song up; returns null when nothing matches confidently or the service is unreachable. */
export const findLyrics = async (song: { title: string; artistName: string; duration?: number | null }): Promise<LyricsMatch | null> => {
  const title = cleanTitle(song.title, song.artistName);
  const artists = splitArtists(song.artistName);
  const duration = song.duration && song.duration > 0 ? song.duration : undefined;
  const attempts = [
    ...artists.slice(0, 2).map((a) => ({ track_name: title, artist_name: a })),
    { track_name: title },
  ];
  try {
    for (const params of attempts) {
      const found = pickBest(await search(params), title, song.artistName, duration);
      if (found) {
        const synced = found.syncedLyrics?.trim() || null;
        return {
          plainLyrics: found.plainLyrics?.trim() || (synced ? plainFromSynced(synced) : ''),
          syncedLyrics: synced,
          source: { trackName: found.trackName, artistName: found.artistName, duration: found.duration },
        };
      }
    }
  } catch (err) {
    console.warn('[Lyrics] LRCLIB lookup failed:', err);
  }
  return null;
};
