/**
 * Inline media (data: URI) protection.
 *
 * On Vercel, when Supabase Storage upload fails, storage.ts falls back to saving the
 * whole file as a base64 data URI in the database. A single 4 MB MP3 then inflates every
 * list endpoint that includes that song to 5+ MB, making page switches take 10+ seconds.
 *
 * This module rewrites such values in API responses to a lightweight URL
 * (/api/media/inline/:id/:field) that streams the decoded file on demand.
 */

export const INLINE_MEDIA_FIELDS = ['audioUrl', 'coverUrl', 'avatarUrl', 'bannerUrl'] as const;
export type InlineMediaField = (typeof INLINE_MEDIA_FIELDS)[number];

const FIELD_SET = new Set<string>(INLINE_MEDIA_FIELDS);

/** Prisma models that can hold each media field, in lookup order. */
export const INLINE_MEDIA_MODELS: Record<InlineMediaField, Array<'song' | 'album' | 'playlist' | 'genre' | 'artist' | 'user'>> = {
  audioUrl: ['song'],
  coverUrl: ['song', 'album', 'playlist', 'genre'],
  avatarUrl: ['artist', 'user'],
  bannerUrl: ['artist'],
};

export const buildInlineMediaUrl = (id: string, field: string, origin = '') =>
  `${origin}/api/media/inline/${encodeURIComponent(id)}/${field}`;

const INLINE_URL_PATTERN = /\/api\/media\/inline\/([0-9a-f-]{36})\/(audioUrl|coverUrl|avatarUrl|bannerUrl)$/i;

/** If `value` is a streaming URL produced by stripInlineMedia, returns the record id and field it points to. */
export const parseInlineMediaUrl = (value: unknown): { id: string; field: InlineMediaField } | null => {
  if (typeof value !== 'string') return null;
  const match = INLINE_URL_PATTERN.exec(value);
  return match ? { id: match[1], field: match[2] as InlineMediaField } : null;
};

/**
 * Recursively replaces data: URIs in media fields with streaming URLs.
 * Never mutates the input (it may be a shared cached object); only copies the branches it changes.
 */
export const stripInlineMedia = <T>(value: T, origin = '', depth = 0): T => {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;

  if (Array.isArray(value)) {
    let copy: any[] | null = null;
    value.forEach((item, i) => {
      const next = stripInlineMedia(item, origin, depth + 1);
      if (next !== item) {
        copy ??= value.slice();
        copy[i] = next;
      }
    });
    return (copy ?? value) as T;
  }

  const obj = value as Record<string, any>;
  const id = typeof obj.id === 'string' ? obj.id : null;
  let copy: Record<string, any> | null = null;

  for (const key of Object.keys(obj)) {
    const v = obj[key];
    let next = v;
    if (typeof v === 'string') {
      if (FIELD_SET.has(key) && v.startsWith('data:')) {
        next = id ? buildInlineMediaUrl(id, key, origin) : '';
      }
    } else if (v && typeof v === 'object') {
      next = stripInlineMedia(v, origin, depth + 1);
    }
    if (next !== v) {
      copy ??= { ...obj };
      copy[key] = next;
    }
  }
  return (copy ?? value) as T;
};

/** Parses a data URI into mime type and binary buffer. */
export const decodeDataUri = (uri: string): { mime: string; buffer: Buffer } | null => {
  const comma = uri.indexOf(',');
  if (!uri.startsWith('data:') || comma === -1) return null;
  const meta = uri.slice(5, comma);
  const isBase64 = meta.endsWith(';base64');
  const mime = (isBase64 ? meta.slice(0, -7) : meta).split(';')[0] || 'application/octet-stream';
  const payload = uri.slice(comma + 1);
  const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8');
  return { mime, buffer };
};
