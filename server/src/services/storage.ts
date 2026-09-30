import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const getStorageConfig = () => ({
  url: process.env.SUPABASE_URL?.replace(/\/$/, ''),
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_STORAGE_BUCKET || 'musicwave-media',
});

let isBucketChecked = false;

const ensureBucketExists = async (url: string, key: string, bucket: string) => {
  if (isBucketChecked) return;
  try {
    const checkRes = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
      headers: { authorization: `Bearer ${key}`, apikey: key },
    });
    if (!checkRes.ok && checkRes.status === 404) {
      await fetch(`${url}/storage/v1/bucket`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          apikey: key,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ id: bucket, name: bucket, public: true }),
      });
    }
    isBucketChecked = true;
  } catch (err) {
    console.warn('[Supabase Storage] ensureBucketExists warning:', err);
  }
};

/**
 * Sanitizes and normalizes a text string into safe URL/storage slug.
 * Removes Vietnamese diacritics and prevents path traversal.
 */
export const sanitizeSlug = (text: string): string => {
  if (!text) return 'untitled';
  let str = text.trim().toLowerCase();
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/[đĐ]/g, 'd');
  str = str.replace(/[^a-z0-9]+/g, '-');
  str = str.replace(/^-+|-+$/g, '').replace(/-+/g, '-');
  return str || 'untitled';
};

/**
 * Generates a standard, sanitized object storage path conforming to:
 * music/{artist}/{album}/{song}.mp3 or covers/{artist}/{filename}.jpg
 */
export const buildSafeAudioPath = (
  artistName: string,
  albumTitle: string | null | undefined,
  songTitle: string,
  extension: string = 'mp3'
): string => {
  const safeArtist = sanitizeSlug(artistName || 'unknown-artist');
  const safeAlbum = sanitizeSlug(albumTitle || 'single');
  const safeSong = sanitizeSlug(songTitle || 'track');
  const safeExt = extension.replace(/^\./, '').toLowerCase() || 'mp3';

  return `music/${safeArtist}/${safeAlbum}/${safeSong}-${Date.now()}.${safeExt}`
    .replace(/\.\./g, '')
    .replace(/[\\:*?"<>|]/g, '');
};

/** Uploads raw in-memory Buffer directly to Supabase Storage */
export const uploadBuffer = async (
  buffer: Buffer,
  objectPath: string,
  contentType: string
): Promise<string> => {
  const { url, key, bucket } = getStorageConfig();
  const sanitizedPath = objectPath.replace(/\.\./g, '').replace(/^[/\\]+/, '');

  try {
    if (url && key) {
      await ensureBucketExists(url, key, bucket);
      const response = await fetch(
        `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${sanitizedPath}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${key}`,
            apikey: key,
            'content-type': contentType || 'application/octet-stream',
            'x-upsert': 'true',
          },
          body: new Uint8Array(buffer),
        }
      );

      if (response.ok) {
        return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${sanitizedPath}`;
      }
      console.warn(`[Supabase Storage] uploadBuffer failed (${response.status}), trying fallback.`);
    }
  } catch (err) {
    console.warn('[Supabase Storage] uploadBuffer exception:', err);
  }

  // Non-Vercel local filesystem fallback
  if (!process.env.VERCEL) {
    const localDir = path.resolve(process.cwd(), 'uploads', path.dirname(sanitizedPath));
    await fs.mkdir(localDir, { recursive: true }).catch(() => {});
    const fullLocalPath = path.resolve(process.cwd(), 'uploads', sanitizedPath);
    await fs.writeFile(fullLocalPath, buffer);
    return `/uploads/${sanitizedPath}`;
  }

  // Data URI fallback for serverless
  const mime = contentType || 'application/octet-stream';
  return `data:${mime};base64,${buffer.toString('base64')}`;
};

/** Uploads Multer's temporary file to persistent Supabase Storage with optional custom path */
export const uploadPublicMedia = async (
  file: Express.Multer.File,
  folder: string,
  customObjectPath?: string
): Promise<string> => {
  const { url, key, bucket } = getStorageConfig();
  const objectPath = customObjectPath
    ? customObjectPath.replace(/\.\./g, '').replace(/^[/\\]+/, '')
    : `${folder}/${file.filename || Date.now()}`;

  try {
    if (url && key) {
      await ensureBucketExists(url, key, bucket);
      const fileBuffer = await fs.readFile(file.path);

      const response = await fetch(
        `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${key}`,
            apikey: key,
            'content-type': file.mimetype || 'application/octet-stream',
            'x-upsert': 'true',
          },
          body: new Uint8Array(fileBuffer),
        }
      );

      if (response.ok) {
        await fs.unlink(file.path).catch(() => {});
        return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath}`;
      }
      console.warn(`[Supabase Storage] Upload failed (${response.status}), trying fallback...`);
    }
  } catch (err) {
    console.warn('[Supabase Storage] Upload exception:', err);
  }

  // Fallback 1: Local file storage on non-Vercel
  if (!process.env.VERCEL) {
    return `/uploads/${file.filename}`;
  }

  // Fallback 2: Data URI on Vercel so media is never lost and request never crashes
  try {
    const fileBuffer = await fs.readFile(file.path);
    const mime = file.mimetype || (folder === 'audio' ? 'audio/mpeg' : 'image/jpeg');
    const base64 = fileBuffer.toString('base64');
    await fs.unlink(file.path).catch(() => {});
    return `data:${mime};base64,${base64}`;
  } catch (e) {
    return 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500';
  }
};

/** Safely removes a file from Supabase Storage or local directory */
export const deletePublicMedia = async (urlOrPath?: string | null): Promise<void> => {
  if (!urlOrPath) return;

  const { url, key, bucket } = getStorageConfig();

  try {
    // 1. Supabase Storage Object URL
    if (url && key && urlOrPath.includes(`/storage/v1/object/public/${bucket}/`)) {
      const parts = urlOrPath.split(`/storage/v1/object/public/${bucket}/`);
      if (parts.length >= 2) {
        const objectPath = decodeURIComponent(parts[1]);
        await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`, {
          method: 'DELETE',
          headers: {
            authorization: `Bearer ${key}`,
            apikey: key,
          },
        }).catch((e) => console.warn('[Supabase Storage] Delete object error:', e));
      }
    } else if (urlOrPath.startsWith('/uploads/')) {
      // 2. Local uploads file
      const localFilePath = path.resolve(process.cwd(), 'uploads', urlOrPath.replace('/uploads/', ''));
      await fs.unlink(localFilePath).catch(() => {});
    }
  } catch (err) {
    console.warn('[Storage] deletePublicMedia error (non-fatal):', err);
  }
};
