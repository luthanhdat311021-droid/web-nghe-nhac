import path from 'path';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { validateSafeUrl } from '../utils/ssrfGuard.js';
import { SecurityLogger } from '../utils/securityLogger.js';
import { appCache } from '../utils/cacheManager.js';
import { invalidateUserAuthCache } from '../middleware/auth.js';
import { analyticsWindow, buildDailyAnalytics, DailyMetric } from '../services/dashboardAnalytics.js';
import {
  uploadPublicMedia,
  uploadBuffer,
  deletePublicMedia,
  buildSafeAudioPath,
  sanitizeSlug,
  createSignedUpload,
  isOwnStorageUrl,
} from '../services/storage.js';
import { isAllowedMedia } from '../middleware/upload.js';
import { findLyrics } from '../services/lyricsLookup.js';

/** Fills in lyrics for a song that has none, from LRCLIB. Never fails the caller: returns whether lyrics were saved. */
const attachLyricsIfFound = async (songId: string, title: string, artistName: string, duration?: number | null) => {
  try {
    const match = await findLyrics({ title, artistName, duration });
    if (!match) return false;
    await prisma.lyrics.upsert({
      where: { songId },
      create: { songId, plainLyrics: match.plainLyrics, syncedLyrics: match.syncedLyrics, isSynced: !!match.syncedLyrics },
      update: { plainLyrics: match.plainLyrics, syncedLyrics: match.syncedLyrics, isSynced: !!match.syncedLyrics },
    });
    return true;
  } catch (err) {
    console.warn('[Lyrics] attach failed:', err);
    return false;
  }
};

/** Admin: preview lyrics for a title/artist without saving (the song form fills its fields with it). */
export const lookupLyrics = async (req: AuthenticatedRequest, res: Response) => {
  const title = String(req.query.title || '').trim().slice(0, 300);
  const artistName = String(req.query.artist || '').trim().slice(0, 300);
  if (!title) return sendError(res, 'Cần tên bài hát để tìm lời.', 400);
  const match = await findLyrics({ title, artistName, duration: Number(req.query.duration) || undefined });
  return match ? sendSuccess(res, match) : sendError(res, 'Không tìm thấy lời phù hợp cho bài này.', 404);
};

/** Admin: find and save lyrics for an existing song. */
export const autoLyricsForSong = async (req: AuthenticatedRequest, res: Response) => {
  const song = await prisma.song.findUnique({ where: { id: req.params.id }, include: { artist: { select: { name: true } } } });
  if (!song) return sendError(res, 'Không tìm thấy bài hát.', 404);
  const saved = await attachLyricsIfFound(song.id, song.title, song.artist?.name || '', song.duration);
  if (!saved) return sendError(res, 'Không tìm thấy lời phù hợp cho bài này.', 404);
  appCache.invalidatePrefix('songs:');
  const lyrics = await prisma.lyrics.findUnique({ where: { songId: song.id } });
  return sendSuccess(res, lyrics, 'Đã tìm và lưu lời bài hát.');
};

// Dashboard KPIs and analytics
export const getDashboardStats = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await appCache.getOrSet(
      'admin:dashboard:stats',
      async () => {
        const { start, end } = analyticsWindow();
        const [
          totalUsers,
          totalSongs,
          totalArtists,
          totalAlbums,
          totalPlaylists,
          totalPlays,
          topPlayCounts,
          recentUsers,
          genresDistribution,
          revenueTotal,
          dailyPlays,
          dailyUsers,
          dailyRevenue,
        ] = await Promise.all([
          prisma.user.count(),
          prisma.song.count(),
          prisma.artist.count(),
          prisma.album.count(),
          prisma.playlist.count(),
          prisma.playbackSession.count({ where: { consumedAt: { not: null, lte: end } } }),
          prisma.playbackSession.groupBy({
            by: ['songId'],
            where: { consumedAt: { not: null, lte: end } },
            take: 5,
            orderBy: { _count: { songId: 'desc' } },
            _count: { songId: true },
          }),
          prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, username: true, email: true, role: true, createdAt: true, isBlocked: true },
          }),
          prisma.genre.findMany({
            take: 6,
            include: {
              _count: { select: { songs: true } },
            },
          }),
          prisma.paymentOrder.aggregate({ where: { status: 'PAID', transactionId: { not: null }, paidAt: { not: null, lte: end } }, _sum: { amount: true } }),
          prisma.$queryRaw<DailyMetric[]>`SELECT to_char("consumedAt" + interval '7 hours', 'YYYY-MM-DD') AS day, count(*)::int AS value
            FROM playback_sessions WHERE "consumedAt" >= ${start} AND "consumedAt" <= ${end} GROUP BY 1`,
          prisma.$queryRaw<DailyMetric[]>`SELECT to_char("createdAt" + interval '7 hours', 'YYYY-MM-DD') AS day, count(*)::int AS value
            FROM users WHERE "createdAt" >= ${start} AND "createdAt" <= ${end} GROUP BY 1`,
          prisma.$queryRaw<DailyMetric[]>`SELECT to_char("paidAt" + interval '7 hours', 'YYYY-MM-DD') AS day, sum(amount)::float8 AS value
            FROM payment_orders WHERE status = 'PAID' AND "transactionId" IS NOT NULL AND "paidAt" >= ${start} AND "paidAt" <= ${end} GROUP BY 1`,
        ]);

        const chartData = buildDailyAnalytics(start, dailyPlays, dailyUsers, dailyRevenue);
        const rankedSongs = await prisma.song.findMany({
          where: { id: { in: topPlayCounts.map(row => row.songId) } },
          include: { artist: { select: { name: true } }, album: { select: { title: true } } },
        });
        const topSongs = topPlayCounts.flatMap(row => {
          const song = rankedSongs.find(song => song.id === row.songId);
          return song ? [{ ...song, playsCount: row._count.songId }] : [];
        });

        return {
          generatedAt: end.toISOString(),
          timezone: 'Asia/Ho_Chi_Minh',
          kpi: {
            totalUsers,
            totalSongs,
            totalArtists,
            totalAlbums,
            totalPlaylists,
            totalPlays,
            totalRevenue: revenueTotal._sum.amount || 0,
          },
          chartData,
          topSongs,
          recentUsers,
          genresDistribution: genresDistribution.map((g) => ({
            name: g.name,
            songsCount: g._count.songs,
            color: g.color,
          })),
        };
      },
      30 // Cache for 30s
    );

    res.setHeader('Cache-Control', 'private, no-store');
    return sendSuccess(res, stats);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch admin stats', 500);
  }
};


// Helper to extract YouTube ID
const extractYoutubeId = (url?: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return match ? match[1] : null;
};

// Fetch YouTube Title & Info with SSRF Guard
export const getYoutubeInfo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url } = req.query;
    if (!url) {
      return sendError(res, 'URL is required', 400);
    }

    const rawUrl = String(url).trim();
    const ssrfCheck = validateSafeUrl(rawUrl, ['youtube.com', 'youtu.be', 'www.youtube.com', 'm.youtube.com']);
    if (!ssrfCheck.isValid) {
      SecurityLogger.log({
        type: 'SSRF_BLOCKED',
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        userId: req.user?.userId,
        resource: 'admin.getYoutubeInfo',
        details: { blockedUrl: rawUrl, reason: ssrfCheck.reason },
      });
      return sendError(res, ssrfCheck.reason || 'Invalid YouTube URL', 400);
    }

    const youtubeId = extractYoutubeId(rawUrl);
    if (!youtubeId) {
      return sendError(res, 'Invalid YouTube URL', 400);
    }

    let title = '';
    let authorName = '';
    let thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`;
      const response = await fetch(oembedUrl);
      if (response.ok) {
        const json: any = await response.json();
        title = json.title || '';
        authorName = json.author_name || '';
        thumbnailUrl = json.thumbnail_url || thumbnailUrl;
      }
    } catch (e) {
      // Fallback
    }

    // Clean common YouTube tags
    let cleanTitle = title
      .replace(/\[(Official\s*Music\s*Video|Official\s*MV|MV|Audio|Lyrics|Lyric\s*Video|HD|4K|Official)\]/gi, '')
      .replace(/\((Official\s*Music\s*Video|Official\s*MV|MV|Audio|Lyrics|Lyric\s*Video|HD|4K|Official|Prod\..*?)\)/gi, '')
      .replace(/\|\s*(Official\s*Music\s*Video|Official\s*MV|MV|Audio|Lyrics|Lyric\s*Video).*/gi, '')
      .trim();

    let parsedArtist = authorName;
    let parsedTitle = cleanTitle;

    if (cleanTitle.includes(' - ')) {
      const parts = cleanTitle.split(' - ');
      if (parts.length >= 2) {
        parsedArtist = parts[0].trim();
        parsedTitle = parts.slice(1).join(' - ').trim();
      }
    } else if (cleanTitle.includes(' | ')) {
      const parts = cleanTitle.split(' | ');
      if (parts.length >= 2) {
        parsedArtist = parts[0].trim();
        parsedTitle = parts.slice(1).join(' | ').trim();
      }
    }

    // Extract real YouTube duration from public video page
    let duration = 0;
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${youtubeId}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
          Cookie: 'SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AwGgJ2aRIA; PREF=tz=Asia.Ho_Chi_Minh',
        },
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const lenMatch = html.match(/"lengthSeconds":"(\d+)"/);
        const approxMatch = html.match(/"approxDurationMs":"(\d+)"/);
        const metaMatch = html.match(/itemprop="duration" content="PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/);
        if (lenMatch && lenMatch[1]) {
          duration = parseInt(lenMatch[1], 10);
        } else if (approxMatch && approxMatch[1]) {
          duration = Math.round(parseInt(approxMatch[1], 10) / 1000);
        } else if (metaMatch) {
          const h = parseInt(metaMatch[1] || '0', 10);
          const m = parseInt(metaMatch[2] || '0', 10);
          const s = parseInt(metaMatch[3] || '0', 10);
          duration = h * 3600 + m * 60 + s;
        }
      }
    } catch (e) {
      // Fallback
    }

    if (!duration || duration <= 0) {
      duration = 180;
    }

    const formatTime = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return sendSuccess(res, {
      youtubeId,
      rawTitle: title,
      title: parsedTitle || title || `YouTube Track ${youtubeId}`,
      artistName: parsedArtist || authorName,
      thumbnailUrl,
      duration: duration || 180,
      formattedDuration: formatTime(duration || 180),
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch YouTube info', 500);
  }
};

// ==================== SONG CRUD ====================

const formBoolean = z.preprocess((v) => (v === undefined ? undefined : v === true || v === 'true' || v === '1'), z.boolean().optional().default(false));

const songSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  artistId: z.string().min(1, 'Artist is required'),
  albumId: z.string().optional().nullable(),
  genreId: z.string().optional().nullable(),
  duration: z.coerce.number().int().min(1).default(180),
  sourceType: z.string().optional().default('url'),
  youtubeUrl: z.string().optional().nullable(),
  youtubeId: z.string().optional().nullable(),
  audioUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  // Multipart forms send "false" as a string, which z.coerce.boolean() would read as true.
  isTrending: formBoolean,
  isFeatured: formBoolean,
  lyrics: z.string().optional(),
  syncedLyrics: z.string().optional(),
});

export const createSong = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = { ...req.body };

    // Check uploaded files if available
    if (files?.audioFile && files.audioFile[0]) {
      body.audioUrl = await uploadPublicMedia(files.audioFile[0], 'audio');
      body.sourceType = 'upload';
    }
    if (files?.coverFile && files.coverFile[0]) {
      body.coverUrl = await uploadPublicMedia(files.coverFile[0], 'covers');
    }

    // If source is YouTube, extract YouTube ID
    if (body.sourceType === 'youtube' || body.youtubeUrl || (body.audioUrl && (body.audioUrl.includes('youtube.com') || body.audioUrl.includes('youtu.be')))) {
      body.sourceType = 'youtube';
      const ytUrl = body.youtubeUrl || body.audioUrl;
      const ytid = extractYoutubeId(ytUrl);
      if (ytid) {
        body.youtubeId = ytid;
        body.youtubeUrl = ytUrl;
        if (!body.audioUrl || body.audioUrl.includes('youtu')) {
          body.audioUrl = `https://www.youtube.com/watch?v=${ytid}`;
        }
        if (!body.coverUrl) {
          body.coverUrl = `https://img.youtube.com/vi/${ytid}/hqdefault.jpg`;
        }
      }
    }

    if (!body.audioUrl && !body.youtubeUrl) {
      return sendError(res, 'Audio source (URL, YouTube URL, or MP3 File) is required', 400);
    }
    if (!body.coverUrl) {
      body.coverUrl = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80';
    }

    const validated = songSchema.parse(body);

    const song = await prisma.song.create({
      data: {
        title: validated.title,
        artistId: validated.artistId,
        albumId: validated.albumId || null,
        genreId: validated.genreId || null,
        duration: validated.duration,
        sourceType: validated.sourceType || 'url',
        youtubeUrl: validated.youtubeUrl || null,
        youtubeId: validated.youtubeId || null,
        audioUrl: validated.audioUrl || body.audioUrl,
        coverUrl: validated.coverUrl || body.coverUrl,
        isTrending: validated.isTrending,
        isFeatured: validated.isFeatured,
        createdBy: req.user?.userId,
        ...(validated.lyrics || validated.syncedLyrics
          ? {
              lyrics: {
                create: {
                  plainLyrics: validated.lyrics || '',
                  syncedLyrics: validated.syncedLyrics || null,
                  isSynced: !!validated.syncedLyrics,
                },
              },
            }
          : {}),
      },
      include: {
        artist: { select: { id: true, name: true } },
        album: { select: { id: true, title: true } },
        genre: { select: { id: true, name: true } },
        lyrics: true,
      },
    });

    if (!validated.lyrics && !validated.syncedLyrics) {
      await attachLyricsIfFound(song.id, song.title, song.artist?.name || '', song.duration);
    }

    appCache.invalidatePrefix('songs:');
    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('albums:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');

    return sendSuccess(res, song, 'Song created successfully', 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Validation error', 400);
    }
    return sendError(res, error.message || 'Failed to create song', 500);
  }
};

export const updateSong = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = { ...req.body };

    if (files?.audioFile && files.audioFile[0]) {
      body.audioUrl = await uploadPublicMedia(files.audioFile[0], 'audio');
      body.sourceType = 'upload';
    }
    if (files?.coverFile && files.coverFile[0]) {
      body.coverUrl = await uploadPublicMedia(files.coverFile[0], 'covers');
    }

    if (body.sourceType === 'youtube' || body.youtubeUrl || (body.audioUrl && (body.audioUrl.includes('youtube.com') || body.audioUrl.includes('youtu.be')))) {
      body.sourceType = 'youtube';
      const ytUrl = body.youtubeUrl || body.audioUrl;
      const ytid = extractYoutubeId(ytUrl);
      if (ytid) {
        body.youtubeId = ytid;
        body.youtubeUrl = ytUrl;
        if (!body.audioUrl || body.audioUrl.includes('youtu')) {
          body.audioUrl = `https://www.youtube.com/watch?v=${ytid}`;
        }
        if (!body.coverUrl) {
          body.coverUrl = `https://img.youtube.com/vi/${ytid}/hqdefault.jpg`;
        }
      }
    }

    const validated = songSchema.partial().parse(body);

    const song = await prisma.song.update({
      where: { id },
      data: {
        ...(validated.title ? { title: validated.title } : {}),
        ...(validated.artistId ? { artistId: validated.artistId } : {}),
        ...(validated.albumId !== undefined ? { albumId: validated.albumId || null } : {}),
        ...(validated.genreId !== undefined ? { genreId: validated.genreId || null } : {}),
        ...(validated.duration ? { duration: validated.duration } : {}),
        ...(validated.sourceType ? { sourceType: validated.sourceType } : {}),
        ...(validated.youtubeUrl !== undefined ? { youtubeUrl: validated.youtubeUrl || null } : {}),
        ...(validated.youtubeId !== undefined ? { youtubeId: validated.youtubeId || null } : {}),
        ...(body.audioUrl ? { audioUrl: body.audioUrl } : {}),
        ...(body.coverUrl ? { coverUrl: body.coverUrl } : {}),
        ...(validated.isTrending !== undefined ? { isTrending: validated.isTrending } : {}),
        ...(validated.isFeatured !== undefined ? { isFeatured: validated.isFeatured } : {}),
      },
    });

    if (validated.lyrics !== undefined || validated.syncedLyrics !== undefined) {
      await prisma.lyrics.upsert({
        where: { songId: id },
        create: {
          songId: id,
          plainLyrics: validated.lyrics || '',
          syncedLyrics: validated.syncedLyrics || null,
          isSynced: !!validated.syncedLyrics,
        },
        update: {
          ...(validated.lyrics !== undefined ? { plainLyrics: validated.lyrics } : {}),
          ...(validated.syncedLyrics !== undefined ? { syncedLyrics: validated.syncedLyrics, isSynced: !!validated.syncedLyrics } : {}),
        },
      });
    }

    appCache.invalidatePrefix('songs:');
    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('albums:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');

    return sendSuccess(res, song, 'Song updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Validation error', 400);
    }
    return sendError(res, error.message || 'Failed to update song', 500);
  }
};

export const deleteSong = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const song = await prisma.song.findUnique({ where: { id } });
    if (song) {
      if (song.audioUrl) {
        await deletePublicMedia(song.audioUrl);
      }
      if (
        song.coverUrl &&
        !song.coverUrl.includes('images.unsplash.com') &&
        !song.coverUrl.includes('youtube.com') &&
        !song.coverUrl.includes('img.youtube.com')
      ) {
        await deletePublicMedia(song.coverUrl);
      }
      await prisma.song.delete({ where: { id } });
      appCache.invalidatePrefix('songs:');
      appCache.invalidatePrefix('artists:');
      appCache.invalidatePrefix('albums:');
      appCache.invalidatePrefix('search:');
      appCache.invalidatePrefix('admin:dashboard');
    }
    return sendSuccess(res, null, 'Song deleted successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to delete song', 500);
  }
};

// ==================== ARTIST CRUD ====================

const artistSchema = z.object({
  name: z.string().min(1, 'Artist name is required'),
  avatarUrl: z.string().optional(),
  bannerUrl: z.string().optional().nullable(),
  biography: z.string().optional().nullable(),
  verified: z.coerce.boolean().optional().default(false),
  country: z.string().optional().nullable(),
  monthlyListeners: z.coerce.number().int().optional().default(0),
});

export const createArtist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = { ...req.body };

    if (files?.avatarFile && files.avatarFile[0]) {
      body.avatarUrl = await uploadPublicMedia(files.avatarFile[0], 'artists');
    }
    if (files?.bannerFile && files.bannerFile[0]) {
      body.bannerUrl = await uploadPublicMedia(files.bannerFile[0], 'artists');
    }

    if (!body.avatarUrl) {
      body.avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
    }

    const validated = artistSchema.parse(body);

    const existing = await prisma.artist.findFirst({
      where: {
        name: { equals: validated.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      return sendError(res, `Nghệ sĩ "${existing.name}" đã tồn tại trong hệ thống.`, 409, {
        existingArtist: existing,
      });
    }

    const artist = await prisma.artist.create({
      data: {
        name: validated.name.trim(),
        avatarUrl: body.avatarUrl,
        bannerUrl: body.bannerUrl || null,
        biography: validated.biography || null,
        verified: validated.verified,
        country: validated.country || null,
        monthlyListeners: validated.monthlyListeners || Math.floor(Math.random() * 50000) + 10000,
        createdBy: req.user?.userId,
      },
    });

    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');

    return sendSuccess(res, artist, 'Artist created successfully', 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Validation error', 400);
    }
    return sendError(res, error.message || 'Failed to create artist', 500);
  }
};

export const updateArtist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = { ...req.body };

    if (files?.avatarFile && files.avatarFile[0]) {
      body.avatarUrl = await uploadPublicMedia(files.avatarFile[0], 'artists');
    }
    if (files?.bannerFile && files.bannerFile[0]) {
      body.bannerUrl = await uploadPublicMedia(files.bannerFile[0], 'artists');
    }

    const validated = artistSchema.partial().parse(body);

    const artist = await prisma.artist.update({
      where: { id },
      data: {
        ...(validated.name ? { name: validated.name } : {}),
        ...(body.avatarUrl ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.bannerUrl !== undefined ? { bannerUrl: body.bannerUrl || null } : {}),
        ...(validated.biography !== undefined ? { biography: validated.biography || null } : {}),
        ...(validated.verified !== undefined ? { verified: validated.verified } : {}),
        ...(validated.country !== undefined ? { country: validated.country || null } : {}),
        ...(validated.monthlyListeners !== undefined ? { monthlyListeners: validated.monthlyListeners } : {}),
      },
    });

    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');

    return sendSuccess(res, artist, 'Artist updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Validation error', 400);
    }
    return sendError(res, error.message || 'Failed to update artist', 500);
  }
};

export const deleteArtist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.artist.delete({ where: { id } });
    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('songs:');
    appCache.invalidatePrefix('albums:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');
    return sendSuccess(res, null, 'Artist deleted successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to delete artist', 500);
  }
};

// ==================== ALBUM CRUD ====================

const albumSchema = z.object({
  title: z.string().min(1, 'Album title is required'),
  artistId: z.string().min(1, 'Artist is required'),
  genreId: z.string().optional().nullable(),
  coverUrl: z.string().optional(),
  description: z.string().optional().nullable(),
});

export const createAlbum = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = { ...req.body };

    if (files?.coverFile && files.coverFile[0]) {
      body.coverUrl = await uploadPublicMedia(files.coverFile[0], 'covers');
    }
    if (!body.coverUrl) {
      body.coverUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80';
    }

    const validated = albumSchema.parse(body);

    const album = await prisma.album.create({
      data: {
        title: validated.title,
        artistId: validated.artistId,
        genreId: validated.genreId || null,
        coverUrl: body.coverUrl,
        description: validated.description || null,
      },
      include: {
        artist: { select: { id: true, name: true } },
        genre: { select: { id: true, name: true } },
      },
    });

    appCache.invalidatePrefix('albums:');
    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');

    return sendSuccess(res, album, 'Album created successfully', 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Validation error', 400);
    }
    return sendError(res, error.message || 'Failed to create album', 500);
  }
};

export const updateAlbum = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = { ...req.body };

    if (files?.coverFile && files.coverFile[0]) {
      body.coverUrl = await uploadPublicMedia(files.coverFile[0], 'covers');
    }

    const validated = albumSchema.partial().parse(body);

    const album = await prisma.album.update({
      where: { id },
      data: {
        ...(validated.title ? { title: validated.title } : {}),
        ...(validated.artistId ? { artistId: validated.artistId } : {}),
        ...(validated.genreId !== undefined ? { genreId: validated.genreId || null } : {}),
        ...(body.coverUrl ? { coverUrl: body.coverUrl } : {}),
        ...(validated.description !== undefined ? { description: validated.description || null } : {}),
      },
    });

    appCache.invalidatePrefix('albums:');
    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');

    return sendSuccess(res, album, 'Album updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Validation error', 400);
    }
    return sendError(res, error.message || 'Failed to update album', 500);
  }
};

export const deleteAlbum = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.album.delete({ where: { id } });
    appCache.invalidatePrefix('albums:');
    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');
    return sendSuccess(res, null, 'Album deleted successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to delete album', 500);
  }
};

// ==================== USER MANAGEMENT ====================

export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = '100', page = '1' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const users = await prisma.user.findMany({
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        bio: true,
        role: true,
        isBlocked: true,
        createdAt: true,
        _count: {
          select: {
            favorites: true,
            playlists: true,
            recentlyPlayed: true,
          },
        },
      },
    });

    return sendSuccess(res, users);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch users', 500);
  }
};

export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['USER', 'ADMIN'].includes(role)) {
      return sendError(res, 'Role must be USER or ADMIN', 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, username: true, email: true, role: true },
    });

    invalidateUserAuthCache(id);

    SecurityLogger.log({
      type: 'ADMIN_ACTION',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userId: req.user?.userId,
      action: 'UPDATE_USER_ROLE',
      resource: `user:${id}`,
      details: { newRole: role, targetUser: user.username },
    });

    return sendSuccess(res, user, 'User role updated successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to update user role', 500);
  }
};

export const toggleBlockUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.user!.userId) {
      return sendError(res, 'You cannot block your own admin account', 400);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isBlocked: !user.isBlocked },
      select: { id: true, username: true, isBlocked: true },
    });

    invalidateUserAuthCache(id);

    SecurityLogger.log({
      type: 'ADMIN_ACTION',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userId: req.user?.userId,
      action: updated.isBlocked ? 'SUSPEND_USER' : 'UNBLOCK_USER',
      resource: `user:${id}`,
      details: { targetUser: user.username, isBlocked: updated.isBlocked },
    });

    return sendSuccess(
      res,
      updated,
      updated.isBlocked ? 'User account suspended' : 'User account unblocked'
    );
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to toggle user block status', 500);
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.user!.userId) {
      return sendError(res, 'You cannot delete your own admin account', 400);
    }

    await prisma.user.delete({ where: { id } });

    invalidateUserAuthCache(id);

    SecurityLogger.log({
      type: 'ADMIN_ACTION',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userId: req.user?.userId,
      action: 'DELETE_USER',
      resource: `user:${id}`,
    });

    return sendSuccess(res, null, 'User deleted successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to delete user', 500);
  }
};

// ==================== GENRES ====================

export const getAllGenres = async (_req: Request, res: Response) => {
  try {
    const genres = await appCache.getOrSet(
      'genres:all',
      async () => {
        return prisma.genre.findMany({
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { songs: true, albums: true } },
          },
        });
      },
      300 // Cache for 5 minutes
    );

    return sendSuccess(res, genres);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch genres', 500);
  }
};

// ==================== MUSIC LIBRARY & BULK IMPORT ====================

/**
 * Checks for existing songs in DB to detect duplicates before uploading
 */
export const checkSongDuplicates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return sendError(res, 'Items array is required', 400);
    }

    const results = await Promise.all(
      items.map(async (item: { title: string; artist: string; album?: string }) => {
        const cleanTitle = (item.title || '').trim();
        const cleanArtist = (item.artist || '').trim();

        if (!cleanTitle || !cleanArtist) {
          return {
            title: cleanTitle,
            artist: cleanArtist,
            isDuplicate: false,
          };
        }

        // Search artist by case-insensitive name
        const existingArtist = await prisma.artist.findFirst({
          where: {
            name: { equals: cleanArtist, mode: 'insensitive' },
          },
          select: { id: true, name: true },
        });

        if (!existingArtist) {
          return {
            title: cleanTitle,
            artist: cleanArtist,
            isDuplicate: false,
          };
        }

        // Search song by artist ID and title
        const existingSong = await prisma.song.findFirst({
          where: {
            artistId: existingArtist.id,
            title: { equals: cleanTitle, mode: 'insensitive' },
          },
          select: {
            id: true,
            title: true,
            audioUrl: true,
            coverUrl: true,
            duration: true,
            album: { select: { id: true, title: true } },
          },
        });

        return {
          title: cleanTitle,
          artist: cleanArtist,
          isDuplicate: !!existingSong,
          existingSongId: existingSong?.id,
          existingArtistId: existingArtist.id,
          existingSong,
        };
      })
    );

    return sendSuccess(res, results);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to check duplicates', 500);
  }
};

/**
 * Imports a single MP3 song with automatic Artist & Album deduplication,
 * file storage upload, duplicate resolution (skip, replace, keep), and DB save.
 */
const uploadUrlSchema = z.object({
  kind: z.enum(['audio', 'cover']),
  fileName: z.string().min(1).max(300),
  contentType: z.string().max(100).default(''),
  title: z.string().max(300).optional(),
  artistName: z.string().max(300).optional(),
  albumTitle: z.string().max(300).optional(),
});

/** One-time URL for the browser to put a file straight into Supabase Storage (bypasses Vercel's 4.5 MB limit). */
export const createMediaUploadUrl = async (req: AuthenticatedRequest, res: Response) => {
  const parsed = uploadUrlSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Thông tin tệp không hợp lệ.', 400);
  const { kind, fileName, contentType, title, artistName, albumTitle } = parsed.data;
  const ext = isAllowedMedia(fileName, contentType, kind);
  if (!ext) {
    return sendError(res, kind === 'audio'
      ? 'Chỉ chấp nhận tệp âm thanh MP3, WAV, OGG, M4A.'
      : 'Chỉ chấp nhận ảnh JPG, PNG, WEBP.', 400);
  }
  const songTitle = title || fileName.replace(/\.[^/.]+$/, '');
  const objectPath = kind === 'audio'
    ? buildSafeAudioPath(artistName || 'unknown-artist', albumTitle, songTitle, ext)
    : `covers/${sanitizeSlug(artistName || 'unknown-artist')}/${sanitizeSlug(songTitle)}-${Date.now()}${ext}`;
  const signed = await createSignedUpload(objectPath).catch(() => null);
  if (!signed) return sendError(res, 'Kho lưu trữ Supabase chưa sẵn sàng (kiểm tra SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY).', 503);
  return sendSuccess(res, signed);
};

export const importSingleSong = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const audioFile = files?.audioFile?.[0];
    const coverFile = files?.coverFile?.[0];

    const body = { ...req.body };
    // Files uploaded by the browser arrive as URLs; only accept ones inside our own bucket.
    if (body.audioUrl && !isOwnStorageUrl(body.audioUrl)) return sendError(res, 'Audio URL không hợp lệ.', 400);
    if (body.coverUrl && !isOwnStorageUrl(body.coverUrl)) return sendError(res, 'Cover URL không hợp lệ.', 400);
    const rawTitle = (body.title || '').trim();
    const rawArtistName = (body.artistName || body.artist || 'Unknown Artist').trim().replace(/\s+/g, ' ');
    const rawAlbumTitle = (body.albumTitle || body.album || '').trim().replace(/\s+/g, ' ');
    const genreName = (body.genreName || body.genre || '').trim();
    const duration = parseInt(body.duration, 10) || 180;
    const duplicateAction = (body.duplicateAction || 'skip').toLowerCase(); // 'skip' | 'replace' | 'keep'

    // A duplicate the client expects to skip may arrive without audio; the requirement is checked once we know.
    const requireAudio = () => (!audioFile && !body.audioUrl ? sendError(res, 'File MP3 hoặc Audio URL là bắt buộc.', 400) : null);
    if (duplicateAction !== 'skip' && requireAudio()) return;

    const title = rawTitle || (audioFile ? audioFile.originalname.replace(/\.[^/.]+$/, '') : 'Untitled Song');
    const artistName = rawArtistName || 'Unknown Artist';

    // 1. Artist Deduplication: Search case-insensitive, normalized
    let artist = await prisma.artist.findFirst({
      where: {
        name: { equals: artistName, mode: 'insensitive' },
      },
    });

    if (!artist) {
      // Create new artist
      const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
      let avatarUrl = defaultAvatar;

      if (coverFile) {
        avatarUrl = await uploadPublicMedia(
          coverFile,
          'artists',
          `artists/${sanitizeSlug(artistName)}/avatar-${Date.now()}.${path.extname(coverFile.originalname).replace(/^\./, '') || 'jpg'}`
        );
      }

      artist = await prisma.artist.create({
        data: {
          name: artistName,
          avatarUrl,
          monthlyListeners: Math.floor(Math.random() * 30000) + 5000,
          createdBy: userId,
        },
      });
    }

    // 2. Album Deduplication (if album title specified and not "Single" / "Unknown Album")
    let albumId: string | null = null;
    if (rawAlbumTitle && rawAlbumTitle.toLowerCase() !== 'single' && rawAlbumTitle.toLowerCase() !== 'unknown album') {
      let album = await prisma.album.findFirst({
        where: {
          artistId: artist.id,
          title: { equals: rawAlbumTitle, mode: 'insensitive' },
        },
      });

      if (!album) {
        let albumCoverUrl = artist.avatarUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80';
        if (coverFile) {
          albumCoverUrl = await uploadPublicMedia(
            coverFile,
            'covers',
            `covers/${sanitizeSlug(artistName)}/${sanitizeSlug(rawAlbumTitle)}-${Date.now()}.jpg`
          );
        }
        album = await prisma.album.create({
          data: {
            title: rawAlbumTitle,
            artistId: artist.id,
            coverUrl: albumCoverUrl,
          },
        });
      }
      albumId = album.id;
    }

    // 3. Genre resolution (match existing or create)
    let genreId: string | null = null;
    if (genreName) {
      const genre = await prisma.genre.findFirst({
        where: {
          OR: [
            { name: { equals: genreName, mode: 'insensitive' } },
            { slug: { equals: sanitizeSlug(genreName), mode: 'insensitive' } },
          ],
        },
      });
      if (genre) {
        genreId = genre.id;
      }
    }

    // 4. Duplicate Song Check
    const existingSong = await prisma.song.findFirst({
      where: {
        artistId: artist.id,
        title: { equals: title, mode: 'insensitive' },
      },
      include: {
        artist: { select: { id: true, name: true } },
        album: { select: { id: true, title: true } },
      },
    });

    if (existingSong) {
      if (duplicateAction === 'skip') {
        return sendSuccess(
          res,
          {
            status: 'SKIPPED',
            message: `Bài hát "${title}" của "${artist.name}" đã tồn tại và đã được bỏ qua.`,
            song: existingSong,
          },
          'Skipped duplicate song',
          200
        );
      } else if (duplicateAction === 'replace') {
        // Upload new audio file with standard structure
        let newAudioUrl = existingSong.audioUrl;
        if (body.audioUrl) {
          newAudioUrl = body.audioUrl;
          await deletePublicMedia(existingSong.audioUrl);
        } else if (audioFile) {
          const audioStoragePath = buildSafeAudioPath(
            artist.name,
            rawAlbumTitle || existingSong.album?.title,
            title,
            path.extname(audioFile.originalname) || 'mp3'
          );
          newAudioUrl = await uploadPublicMedia(audioFile, 'audio', audioStoragePath);
          // Clean up old audio file safely
          await deletePublicMedia(existingSong.audioUrl);
        }

        let newCoverUrl = existingSong.coverUrl;
        if (body.coverUrl) {
          newCoverUrl = body.coverUrl;
        } else if (coverFile) {
          const coverStoragePath = `covers/${sanitizeSlug(artist.name)}/${sanitizeSlug(title)}-${Date.now()}.jpg`;
          newCoverUrl = await uploadPublicMedia(coverFile, 'covers', coverStoragePath);
          if (!existingSong.coverUrl.includes('images.unsplash.com')) {
            await deletePublicMedia(existingSong.coverUrl);
          }
        }

        const updated = await prisma.song.update({
          where: { id: existingSong.id },
          data: {
            duration: duration || existingSong.duration,
            audioUrl: newAudioUrl,
            coverUrl: newCoverUrl,
            sourceType: 'upload',
            albumId: albumId || existingSong.albumId,
            genreId: genreId || existingSong.genreId,
          },
          include: {
            artist: { select: { id: true, name: true, avatarUrl: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
            genre: { select: { id: true, name: true, slug: true } },
          },
        });

        appCache.invalidatePrefix('songs:');
        appCache.invalidatePrefix('artists:');
        appCache.invalidatePrefix('albums:');
        appCache.invalidatePrefix('search:');
        appCache.invalidatePrefix('admin:dashboard');
        return sendSuccess(
          res,
          {
            status: 'REPLACED',
            message: `Bài hát "${title}" đã được ghi đè thành công.`,
            song: updated,
          },
          'Replaced existing song',
          200
        );
      }
      // If duplicateAction === 'keep', proceed to create a separate song record below
    }

    // 5. New Song Upload & Creation
    if (requireAudio()) return;
    let audioUrl = body.audioUrl;
    if (audioFile) {
      const audioStoragePath = buildSafeAudioPath(
        artist.name,
        rawAlbumTitle,
        title,
        path.extname(audioFile.originalname) || 'mp3'
      );
      audioUrl = await uploadPublicMedia(audioFile, 'audio', audioStoragePath);
    }

    let coverUrl = body.coverUrl;
    if (coverFile) {
      const coverStoragePath = `covers/${sanitizeSlug(artist.name)}/${sanitizeSlug(title)}-${Date.now()}.jpg`;
      coverUrl = await uploadPublicMedia(coverFile, 'covers', coverStoragePath);
    } else if (!coverUrl) {
      coverUrl = artist.avatarUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80';
    }

    const createdSong = await prisma.song.create({
      data: {
        title,
        artistId: artist.id,
        albumId: albumId || null,
        genreId: genreId || null,
        duration: duration || 180,
        audioUrl,
        coverUrl,
        sourceType: 'upload',
        createdBy: userId,
      },
      include: {
        artist: { select: { id: true, name: true, avatarUrl: true } },
        album: { select: { id: true, title: true, coverUrl: true } },
        genre: { select: { id: true, name: true, slug: true } },
      },
    });

    const lyricsFound = await attachLyricsIfFound(createdSong.id, createdSong.title, createdSong.artist?.name || artistName, createdSong.duration);

    appCache.invalidatePrefix('songs:');
    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('albums:');
    appCache.invalidatePrefix('genres:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');

    return sendSuccess(
      res,
      {
        status: 'SUCCESS',
        message: `Đã thêm bài hát "${title}" thành công.`,
        song: createdSong,
        lyricsFound,
      },
      'Song imported successfully',
      201
    );
  } catch (error: any) {
    console.error('[Admin importSingleSong Error]:', error);
    return sendError(res, error.message || 'Không thể lưu bài hát vào cơ sở dữ liệu.', 500);
  }
};

/**
 * Replace MP3 file for an existing song
 */
export const replaceSongAudio = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const audioFile = files?.audioFile?.[0];
    const uploadedUrl = req.body?.audioUrl;

    if (uploadedUrl && !isOwnStorageUrl(uploadedUrl)) {
      return sendError(res, 'Audio URL không hợp lệ.', 400);
    }
    if (!audioFile && !uploadedUrl) {
      return sendError(res, 'Vui lòng chọn file MP3 mới.', 400);
    }

    const song = await prisma.song.findUnique({
      where: { id },
      include: { artist: true, album: true },
    });

    if (!song) {
      return sendError(res, 'Không tìm thấy bài hát.', 404);
    }

    const newAudioUrl = uploadedUrl || await uploadPublicMedia(audioFile!, 'audio', buildSafeAudioPath(
      song.artist?.name || 'artist',
      song.album?.title,
      song.title,
      path.extname(audioFile!.originalname) || 'mp3'
    ));

    // Delete old audio file
    if (song.audioUrl) {
      await deletePublicMedia(song.audioUrl);
    }

    const duration = req.body.duration ? parseInt(req.body.duration, 10) : song.duration;

    const updated = await prisma.song.update({
      where: { id },
      data: {
        audioUrl: newAudioUrl,
        sourceType: 'upload',
        duration: duration || song.duration,
      },
      include: {
        artist: { select: { id: true, name: true, avatarUrl: true } },
        album: { select: { id: true, title: true, coverUrl: true } },
      },
    });

    appCache.invalidatePrefix('songs:');
    return sendSuccess(res, updated, 'Đã thay thế file MP3 thành công.');
  } catch (error: any) {
    return sendError(res, error.message || 'Không thể thay thế file MP3.', 500);
  }
};

/**
 * Replace Cover artwork for an existing song
 */
export const replaceSongCover = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const coverFile = files?.coverFile?.[0];

    if (!coverFile) {
      return sendError(res, 'Vui lòng chọn file ảnh bìa mới.', 400);
    }

    const song = await prisma.song.findUnique({
      where: { id },
      include: { artist: true },
    });

    if (!song) {
      return sendError(res, 'Không tìm thấy bài hát.', 404);
    }

    const newPath = `covers/${sanitizeSlug(song.artist?.name || 'artist')}/${sanitizeSlug(song.title)}-${Date.now()}.jpg`;
    const newCoverUrl = await uploadPublicMedia(coverFile, 'covers', newPath);

    // Delete old cover file if custom
    if (song.coverUrl && !song.coverUrl.includes('images.unsplash.com')) {
      await deletePublicMedia(song.coverUrl);
    }

    const updated = await prisma.song.update({
      where: { id },
      data: { coverUrl: newCoverUrl },
      include: {
        artist: { select: { id: true, name: true, avatarUrl: true } },
        album: { select: { id: true, title: true, coverUrl: true } },
      },
    });

    appCache.invalidatePrefix('songs:');
    return sendSuccess(res, updated, 'Đã thay thế ảnh bìa thành công.');
  } catch (error: any) {
    return sendError(res, error.message || 'Không thể thay thế ảnh bìa.', 500);
  }
};

/**
 * Records a completed batch import summary and item logs into DB
 */
export const recordImportBatch = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { totalFiles, successCount, failedCount, logs = [] } = req.body;

    const batch = await prisma.importBatch.create({
      data: {
        totalFiles: Number(totalFiles) || 0,
        successCount: Number(successCount) || 0,
        failedCount: Number(failedCount) || 0,
        createdBy: userId,
        logs: {
          create: logs.map((log: any) => ({
            filename: String(log.filename || 'unknown.mp3'),
            songTitle: log.songTitle ? String(log.songTitle) : null,
            artistName: log.artistName ? String(log.artistName) : null,
            status: String(log.status || 'SUCCESS'),
            errorMessage: log.errorMessage ? String(log.errorMessage) : null,
            songId: log.songId ? String(log.songId) : null,
          })),
        },
      },
      include: {
        logs: true,
      },
    });

    return sendSuccess(res, batch, 'Batch import recorded successfully', 201);
  } catch (error: any) {
    console.error('[recordImportBatch Error]:', error);
    return sendError(res, error.message || 'Failed to record import batch', 500);
  }
};

/**
 * Fetches paginated batch import history
 */
export const getImportHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, batches] = await Promise.all([
      prisma.importBatch.count(),
      prisma.importBatch.findMany({
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          logs: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);

    return sendSuccess(res, {
      items: batches,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch import history', 500);
  }
};
