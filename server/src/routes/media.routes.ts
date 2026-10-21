import { requireMediaTicket } from '../middleware/playbackAccess.js';
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../services/prisma.js';
import { decodeDataUri, INLINE_MEDIA_FIELDS, INLINE_MEDIA_MODELS, InlineMediaField } from '../utils/inlineMedia.js';

const router = Router();

type DecodedMedia = { mime: string; buffer: Buffer; etag: string };

// Small in-memory cache so warm serverless instances don't re-read multi-MB rows for every Range request.
const CACHE_LIMIT_BYTES = 40 * 1024 * 1024;
const cache = new Map<string, DecodedMedia>();
let cacheBytes = 0;

const cacheSet = (key: string, value: DecodedMedia) => {
  if (value.buffer.length > CACHE_LIMIT_BYTES) return;
  while (cacheBytes + value.buffer.length > CACHE_LIMIT_BYTES && cache.size > 0) {
    const oldestKey = cache.keys().next().value as string;
    cacheBytes -= cache.get(oldestKey)!.buffer.length;
    cache.delete(oldestKey);
  }
  cache.set(key, value);
  cacheBytes += value.buffer.length;
};

const loadInlineMedia = async (id: string, field: InlineMediaField): Promise<DecodedMedia | null> => {
  const cacheKey = `${id}:${field}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  for (const model of INLINE_MEDIA_MODELS[field]) {
    const row = await (prisma as any)[model].findUnique({ where: { id }, select: { [field]: true } });
    const value: unknown = row?.[field];
    if (typeof value !== 'string') continue;
    if (!value.startsWith('data:')) return null;

    const decoded = decodeDataUri(value);
    if (!decoded) return null;
    const etag = `"${crypto.createHash('md5').update(decoded.buffer).digest('hex')}"`;
    const media = { ...decoded, etag };
    cacheSet(cacheKey, media);
    return media;
  }
  return null;
};

/** Streams a media file that was stored inline as a data URI, with HTTP Range support for audio seeking. */
router.get('/inline/:id/:field', (req, res, next) => req.params.field === 'audioUrl' ? requireMediaTicket(req, res, next) : next(), async (req: Request, res: Response) => {
  const { id, field } = req.params;
  if (!(INLINE_MEDIA_FIELDS as readonly string[]).includes(field) || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(404).end();
  }

  try {
    const media = await loadInlineMedia(id, field as InlineMediaField);
    if (!media) return res.status(404).end();

    const { buffer, mime, etag } = media;
    res.setHeader('Content-Type', mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', field === 'audioUrl' ? 'private, no-store' : 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (req.headers['if-none-match'] === etag) return res.status(304).end();

    const range = req.headers.range;
    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (match && (match[1] || match[2])) {
      const size = buffer.length;
      let start: number;
      let end: number;
      if (match[1]) {
        start = parseInt(match[1], 10);
        end = match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
      } else {
        start = Math.max(size - parseInt(match[2], 10), 0);
        end = size - 1;
      }
      if (start >= size || start > end) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      return res.end(buffer.subarray(start, end + 1));
    }

    res.setHeader('Content-Length', String(buffer.length));
    return res.end(buffer);
  } catch (err) {
    console.error('[Media] inline media stream error:', err);
    return res.status(500).end();
  }
});

export default router;
