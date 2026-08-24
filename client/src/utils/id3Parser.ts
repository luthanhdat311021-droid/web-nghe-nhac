/**
 * Client-Side MP3 ID3v1 & ID3v2 Tag Reader & Audio Duration Probe
 * Pure TypeScript, zero external runtime dependencies.
 * Extracts: Title, Artist, Album, Track, Year, Genre, Duration, Embedded Artwork (APIC).
 */

export interface ParsedAudioMetadata {
  file: File;
  id: string; // Unique client-side ID for UI keying
  title: string;
  artist: string;
  album: string;
  trackNumber: number;
  releaseYear: number | null;
  genre: string;
  duration: number; // in seconds
  coverFile: File | null;
  coverPreviewUrl: string | null;
  duplicateStatus?: 'NEW' | 'DUPLICATE' | 'CHECKING';
  duplicateAction?: 'skip' | 'replace' | 'keep';
  existingSongId?: string;
  error?: string;
}

/**
 * Strips common junk tokens from filenames or titles like [Official MV], (Audio), etc.
 */
export const cleanSongTitle = (raw: string): string => {
  if (!raw) return '';
  return raw
    .replace(/\[(Official\s*(?:Music\s*Video|MV|Audio|Video|Lyric\s*Video)|320kbps|FLAC|1080p|4K|HD|Audio|Lossless)\]/gi, '')
    .replace(/\((Official\s*(?:Music\s*Video|MV|Audio|Video|Lyric\s*Video)|Prod\..*?|Audio|Lyrics|Lyric\s*Video)\)/gi, '')
    .replace(/\|\s*(Official\s*MV|MV|Audio|Lyrics).*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/**
 * Smart filename parsing when metadata is missing or empty.
 * e.g. "Dangrangto - The Gioi Khong Anh.mp3" -> Artist: "Dangrangto", Title: "The Gioi Khong Anh"
 * e.g. "01 - Son Tung M-TP - Lac Troi.mp3" -> Artist: "Son Tung M-TP", Title: "Lac Troi", Track: 1
 */
export const parseFromFilename = (filename: string): { title: string; artist: string; trackNumber: number } => {
  // Strip extension
  let base = filename.replace(/\.[^/.]+$/, '').trim();
  let trackNumber = 1;

  // 1. Check leading track number: "01. Artist - Title" or "01 - Artist - Title" or "01 Artist - Title"
  const trackMatch = base.match(/^(\d{1,3})[\s.\-_]+(.+)$/);
  if (trackMatch) {
    trackNumber = parseInt(trackMatch[1], 10) || 1;
    base = trackMatch[2].trim();
  }

  // 2. Check "Artist - Title" separator
  if (base.includes(' - ')) {
    const parts = base.split(' - ');
    if (parts.length >= 2) {
      const artist = cleanSongTitle(parts[0].trim());
      const title = cleanSongTitle(parts.slice(1).join(' - ').trim());
      if (artist && title) {
        return { artist, title, trackNumber };
      }
    }
  }

  // 3. Check "Artist _ Title" separator
  if (base.includes(' _ ')) {
    const parts = base.split(' _ ');
    if (parts.length >= 2) {
      const artist = cleanSongTitle(parts[0].trim());
      const title = cleanSongTitle(parts.slice(1).join(' _ ').trim());
      if (artist && title) {
        return { artist, title, trackNumber };
      }
    }
  }

  // 4. If no clear delimiter, do not guess artist randomly:
  return {
    title: cleanSongTitle(base) || 'Unknown Track',
    artist: 'Unknown Artist',
    trackNumber,
  };
};

/**
 * Probes accurate audio duration in seconds using HTML5 Audio element.
 */
export const probeAudioDuration = async (file: File): Promise<number> => {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const audio = document.createElement('audio');
      audio.preload = 'metadata';

      const cleanup = () => {
        audio.onloadedmetadata = null;
        audio.onerror = null;
        URL.revokeObjectURL(url);
      };

      const timer = setTimeout(() => {
        cleanup();
        resolve(180); // 3m fallback if metadata load hangs
      }, 4000);

      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        const dur = Math.round(audio.duration || 0);
        cleanup();
        resolve(dur > 0 && !isNaN(dur) ? dur : 180);
      };

      audio.onerror = () => {
        clearTimeout(timer);
        cleanup();
        resolve(180);
      };

      audio.src = url;
    } catch {
      resolve(180);
    }
  });
};

/**
 * Helper to decode text bytes with encoding byte (0 = ISO-8859-1, 1 = UTF-16 with BOM, 2 = UTF-16BE, 3 = UTF-8)
 */
const decodeTextFrame = (bytes: Uint8Array): string => {
  if (bytes.length === 0) return '';
  const encoding = bytes[0];
  const content = bytes.subarray(1);

  try {
    if (encoding === 0) {
      // ISO-8859-1 / ASCII
      let str = '';
      for (let i = 0; i < content.length; i++) {
        if (content[i] === 0) break;
        str += String.fromCharCode(content[i]);
      }
      return str.trim();
    } else if (encoding === 1 || encoding === 2) {
      // UTF-16
      const decoder = new TextDecoder('utf-16');
      return decoder.decode(content).replace(/\0/g, '').trim();
    } else if (encoding === 3) {
      // UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(content).replace(/\0/g, '').trim();
    } else {
      // Fallback UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes).replace(/\0/g, '').trim();
    }
  } catch {
    return '';
  }
};

/**
 * Parses APIC (Attached Picture) frame to extract embedded album artwork.
 */
const parseApicFrame = (bytes: Uint8Array, filenamePrefix: string): { file: File; url: string } | null => {
  try {
    if (bytes.length < 10) return null;
    const encoding = bytes[0];
    let offset = 1;

    // MIME type (null-terminated ISO-8859-1 string)
    let mimeType = '';
    while (offset < bytes.length && bytes[offset] !== 0) {
      mimeType += String.fromCharCode(bytes[offset]);
      offset++;
    }
    offset++; // Skip null terminator

    if (!mimeType) mimeType = 'image/jpeg';
    if (mimeType.toLowerCase() === 'image/jpg') mimeType = 'image/jpeg';

    // Picture type (1 byte, e.g. 3 = Cover front)
    if (offset >= bytes.length) return null;
    const _picType = bytes[offset];
    offset++;

    // Description (null-terminated string according to encoding)
    if (encoding === 0 || encoding === 3) {
      while (offset < bytes.length && bytes[offset] !== 0) {
        offset++;
      }
      offset++; // skip null
    } else {
      // UTF-16 double null
      while (offset < bytes.length - 1 && !(bytes[offset] === 0 && bytes[offset + 1] === 0)) {
        offset += 2;
      }
      offset += 2;
    }

    if (offset >= bytes.length) return null;

    const imageData = bytes.subarray(offset);
    if (imageData.length === 0) return null;

    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const imageCopy = new Uint8Array(imageData);
    const blob = new Blob([imageCopy], { type: mimeType });
    const coverFile = new File([blob], `${filenamePrefix}-cover.${ext}`, { type: mimeType });
    const coverUrl = URL.createObjectURL(blob);

    return { file: coverFile, url: coverUrl };
  } catch (err) {
    console.warn('[ID3 Parser] APIC parsing error:', err);
    return null;
  }
};

/**
 * Full ID3v2 & ID3v1 parser from MP3 File.
 */
export const parseMp3Metadata = async (file: File): Promise<ParsedAudioMetadata> => {
  const parsedId = `song_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Default initial values from smart filename fallback
  const filenameFallback = parseFromFilename(file.name);

  let title = filenameFallback.title;
  let artist = filenameFallback.artist;
  let album = 'Unknown Album';
  let trackNumber = filenameFallback.trackNumber;
  let releaseYear: number | null = null;
  let genre = 'V-Pop';
  let coverFile: File | null = null;
  let coverPreviewUrl: string | null = null;

  try {
    // Read first 512KB for ID3v2 header and frames
    const headerChunkSize = Math.min(file.size, 512 * 1024);
    const buffer = await file.slice(0, headerChunkSize).arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Check "ID3" tag at offset 0
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      const majorVersion = bytes[3]; // 2, 3, or 4
      const _flags = bytes[5];
      // Size is synchsafe integer (7 bits per byte)
      const tagSize =
        ((bytes[6] & 0x7f) << 21) |
        ((bytes[7] & 0x7f) << 14) |
        ((bytes[8] & 0x7f) << 7) |
        (bytes[9] & 0x7f);

      let offset = 10;
      const maxOffset = Math.min(tagSize + 10, bytes.length);

      while (offset < maxOffset - 10) {
        // Frame ID (4 ASCII chars for v2.3/v2.4, 3 for v2.2)
        if (bytes[offset] === 0) break; // Padding reached

        let frameId = '';
        let frameSize = 0;
        let headerSize = 10;

        if (majorVersion === 2) {
          // ID3v2.2 (3 char ID, 3 bytes size)
          frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
          frameSize = (bytes[offset + 3] << 16) | (bytes[offset + 4] << 8) | bytes[offset + 5];
          headerSize = 6;
        } else if (majorVersion === 3) {
          // ID3v2.3 (4 char ID, 4 bytes standard int)
          frameId = String.fromCharCode(
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3]
          );
          frameSize = view.getUint32(offset + 4);
          headerSize = 10;
        } else if (majorVersion === 4) {
          // ID3v2.4 (4 char ID, 4 bytes synchsafe int)
          frameId = String.fromCharCode(
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3]
          );
          frameSize =
            ((bytes[offset + 4] & 0x7f) << 21) |
            ((bytes[offset + 5] & 0x7f) << 14) |
            ((bytes[offset + 6] & 0x7f) << 7) |
            (bytes[offset + 7] & 0x7f);
          headerSize = 10;
        }

        if (frameSize <= 0 || offset + headerSize + frameSize > bytes.length) {
          break;
        }

        const frameData = bytes.subarray(offset + headerSize, offset + headerSize + frameSize);

        // Map Frame ID to fields
        if (frameId === 'TIT2' || frameId === 'TT2') {
          const val = cleanSongTitle(decodeTextFrame(frameData));
          if (val) title = val;
        } else if (frameId === 'TPE1' || frameId === 'TP1') {
          const val = cleanSongTitle(decodeTextFrame(frameData));
          if (val) artist = val;
        } else if (frameId === 'TALB' || frameId === 'TAL') {
          const val = cleanSongTitle(decodeTextFrame(frameData));
          if (val) album = val;
        } else if (frameId === 'TRCK' || frameId === 'TRK') {
          const val = decodeTextFrame(frameData);
          const trkMatch = val.match(/^(\d+)/);
          if (trkMatch) trackNumber = parseInt(trkMatch[1], 10);
        } else if (frameId === 'TYER' || frameId === 'TDRC' || frameId === 'TYE') {
          const val = decodeTextFrame(frameData);
          const yearMatch = val.match(/(\d{4})/);
          if (yearMatch) releaseYear = parseInt(yearMatch[1], 10);
        } else if (frameId === 'TCON' || frameId === 'TCO') {
          const val = cleanSongTitle(decodeTextFrame(frameData));
          if (val) genre = val;
        } else if (frameId === 'APIC' || frameId === 'PIC') {
          if (!coverFile) {
            const parsedCover = parseApicFrame(frameData, parsedId);
            if (parsedCover) {
              coverFile = parsedCover.file;
              coverPreviewUrl = parsedCover.url;
            }
          }
        }

        offset += headerSize + frameSize;
      }
    }
  } catch (err) {
    console.warn('[ID3 Parser] Error reading ID3v2 tags, using filename parser:', err);
  }

  // Probe accurate duration
  const duration = await probeAudioDuration(file);

  return {
    file,
    id: parsedId,
    title: title || filenameFallback.title || 'Untitled Song',
    artist: artist || filenameFallback.artist || 'Unknown Artist',
    album: album && album !== 'Unknown Album' ? album : 'Single',
    trackNumber: trackNumber || 1,
    releaseYear: releaseYear || new Date().getFullYear(),
    genre: genre || 'V-Pop',
    duration,
    coverFile,
    coverPreviewUrl,
    duplicateStatus: 'CHECKING',
    duplicateAction: 'skip',
  };
};
