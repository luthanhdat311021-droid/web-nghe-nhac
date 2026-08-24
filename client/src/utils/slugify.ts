/**
 * Sanitizes and converts strings into safe, URL-friendly and filesystem-safe slugs.
 * Removes Vietnamese diacritics and special characters, prevents path traversal (../, \, null bytes).
 */
export const slugify = (text: string): string => {
  if (!text) return 'untitled';

  let str = text.trim().toLowerCase();

  // Normalize Vietnamese diacritics
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/[đĐ]/g, 'd');

  // Replace invalid filesystem / URL characters with hyphen
  str = str.replace(/[^a-z0-9]+/g, '-');

  // Remove leading/trailing hyphens and multiple consecutive hyphens
  str = str.replace(/^-+|-+$/g, '').replace(/-+/g, '-');

  return str || 'untitled';
};

/**
 * Builds safe storage paths conforming to requirement:
 * music/{artist}/{album}/{song}.mp3
 */
export const buildSafeStoragePath = (
  artistName: string,
  albumTitle: string | null | undefined,
  songTitle: string,
  extension: string = 'mp3'
): string => {
  const safeArtist = slugify(artistName || 'unknown-artist');
  const safeAlbum = slugify(albumTitle || 'single');
  const safeSong = slugify(songTitle || 'track');
  const safeExt = extension.replace(/^\./, '').toLowerCase() || 'mp3';

  // Strict path sanitization to prevent path traversal
  const sanitizedPath = `music/${safeArtist}/${safeAlbum}/${safeSong}.${safeExt}`
    .replace(/\.\./g, '')
    .replace(/[\\:*?"<>|]/g, '');

  return sanitizedPath;
};
