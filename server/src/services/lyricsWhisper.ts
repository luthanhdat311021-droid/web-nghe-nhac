import { normalize } from './lyricsLookup.js';

// Whisper (via Groq) transcribes speech with per-word timestamps, which time lines far more precisely than
// a general multimodal model. When the lyrics text is known, each line is anchored on the words Whisper heard,
// so the wording comes from the reference and only the timing from the audio.
const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const MAX_BYTES = 25 * 1024 * 1024;

interface Word { word: string; start: number }
interface Segment { start: number; text: string }
export interface TimedLine { time: number; text: string }

export const whisperAvailable = () => !!process.env.GROQ_API_KEY?.trim();

export async function whisperTranscribe(data: Buffer, mimeType: string, language?: string) {
  if (data.length > MAX_BYTES) throw new Error('Tệp nhạc quá lớn cho Whisper (tối đa 25 MB).');
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(data)],{ type: mimeType }), 'audio.' + (mimeType.split('/')[1] || 'mp3'));
  form.append('model', process.env.GROQ_WHISPER_MODEL?.trim() || 'whisper-large-v3');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');
  form.append('temperature', '0');
  if (language) form.append('language', language);
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.GROQ_API_KEY!.trim()}` },
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`Whisper lỗi (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json() as { words?: Word[]; segments?: Segment[] };
  return { words: json.words || [], segments: json.segments || [] };
}

// Seconds a syllable usually takes; used to step back from the first recognised word to the line start.
const SYLLABLE_SECONDS = 0.28;

/** 2 = same word, 1 = one letter off (Whisper's "giot"/"rot", "ki"/"ky"), 0 = different. */
const similarity = (a: string, b: string) => {
  if (a === b) return 2;
  if (Math.min(a.length, b.length) < 3 || Math.abs(a.length - b.length) > 1) return 0;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  let ja = a.length - 1;
  let jb = b.length - 1;
  while (ja >= i && jb >= i && a[ja] === b[jb]) { ja--; jb--; }
  return Math.max(ja, jb) - i < 1 ? 1 : 0;
};

/**
 * Times each reference line from Whisper's words. The whole lyric is aligned to the whole word stream in
 * one pass (edit-distance alignment), so a few misheard or skipped words cannot pull a line onto the next
 * line's audio, which a per-line search of the opening words did. Null if too little of the lyric was heard.
 */
export function alignLines(lines: string[], words: Word[]): TimedLine[] | null {
  const heard = words
    .flatMap((w) => normalize(w.word).split(' ').filter(Boolean).map((token) => ({ token, start: w.start })));
  const ref = lines.flatMap((line, li) =>
    normalize(line).split(' ').filter(Boolean).map((token, pos) => ({ token, line: li, pos })));
  const n = ref.length;
  const m = heard.length;
  if (!n || !m) return null;

  // score[i][j]: best alignment of ref[0..i) with heard[0..j). Skipping a lyric word (unheard) costs more
  // than skipping a heard word (Whisper fillers, ad-libs, repeated hooks); unrelated words never pair up.
  const SKIP_REF = -1;
  const SKIP_HEARD = -0.4;
  const W = m + 1;
  const score = new Float32Array((n + 1) * W);
  const move = new Uint8Array((n + 1) * W); // 1 = pair, 2 = skip lyric word, 3 = skip heard word
  for (let i = 1; i <= n; i++) { score[i * W] = i * SKIP_REF; move[i * W] = 2; }
  for (let j = 1; j <= m; j++) { score[j] = j * SKIP_HEARD; move[j] = 3; }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = similarity(ref[i - 1].token, heard[j - 1].token);
      let best = score[(i - 1) * W + j] + SKIP_REF;
      let how = 2;
      const skipHeard = score[i * W + j - 1] + SKIP_HEARD;
      if (skipHeard > best) { best = skipHeard; how = 3; }
      if (sim) {
        const pair = score[(i - 1) * W + j - 1] + sim;
        if (pair >= best) { best = pair; how = 1; }
      }
      score[i * W + j] = best;
      move[i * W + j] = how;
    }
  }
  const pairedWith = new Array<number>(n).fill(-1);
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const how = move[i * W + j];
    if (how === 1) { pairedWith[i - 1] = j - 1; i--; j--; }
    else if (how === 2) i--;
    else j--;
  }

  // A line is anchored at its first paired word, stepped back by the words sung before it, once enough
  // of the line was heard to trust it.
  const times: (number | null)[] = lines.map((_, li) => {
    const own = ref.filter((r) => r.line === li);
    const pairedIdx = own.map((r) => pairedWith[ref.indexOf(r)]);
    const pairedCount = pairedIdx.filter((p) => p >= 0).length;
    if (!own.length || pairedCount < Math.min(2, own.length)) return null;
    const first = pairedIdx.findIndex((p) => p >= 0);
    return Math.max(0, heard[pairedIdx[first]].start - own[first].pos * SYLLABLE_SECONDS);
  });
  // Keep times strictly increasing; a line stepped back past its predecessor keeps the predecessor's order.
  let last = -Infinity;
  for (let i = 0; i < times.length; i++) {
    if (times[i] === null) continue;
    if (times[i]! <= last) times[i] = last + 0.1;
    last = times[i]!;
  }
  const matched = times.filter((t) => t !== null).length;
  if (matched < Math.max(2, lines.length * 0.5)) return null;

  // Unmatched lines are spread evenly between their matched neighbours.
  for (let i = 0; i < times.length; i++) {
    if (times[i] !== null) continue;
    let k = i;
    while (k < times.length && times[k] === null) k++;
    const prev = i > 0 ? times[i - 1]! : Math.max(0, (times[k] ?? 0) - 3 * (k - i));
    const next = k < times.length ? times[k]! : prev + 3 * (k - i + 1);
    for (let n = i; n < k; n++) times[n] = prev + ((next - prev) * (n - i + 1)) / (k - i + 1);
    i = k - 1;
  }
  return lines.map((text, i) => ({ time: Math.round(times[i]! * 100) / 100, text }));
}

/** Whisper's own segments as lines, for songs with no reference lyrics. */
export const segmentLines = (segments: Segment[]): TimedLine[] =>
  segments.map((s) => ({ time: Math.round(s.start * 100) / 100, text: s.text.trim() })).filter((l) => l.text);
