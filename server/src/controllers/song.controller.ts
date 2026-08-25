import { Response } from 'express';
import { prisma } from '../services/prisma.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { validateSafeUrl } from '../utils/ssrfGuard.js';
import { SecurityLogger } from '../utils/securityLogger.js';
import { appCache } from '../utils/cacheManager.js';
import { playbackBuffer } from '../services/playbackBuffer.js';
import { uploadPublicMedia } from '../services/storage.js';

export const getAllSongs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { genre, search, trending, featured, sort = 'latest', page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `songs:list:${genre || 'all'}:${search || ''}:${trending || ''}:${featured || ''}:${sort}:${pageNum}:${limitNum}`;

    const { total, songs } = await appCache.getOrSet(
      cacheKey,
      async () => {
        const where: any = {};

        if (genre) {
          where.genre = { slug: String(genre) };
        }

        if (search) {
          where.OR = [
            { title: { contains: String(search), mode: 'insensitive' } },
            { artist: { name: { contains: String(search), mode: 'insensitive' } } },
          ];
        }

        if (trending === 'true') {
          where.isTrending = true;
        }

        if (featured === 'true') {
          where.isFeatured = true;
        }

        let orderBy: any = { createdAt: 'desc' };
        if (sort === 'popular' || sort === 'plays') {
          orderBy = { playsCount: 'desc' };
        } else if (sort === 'oldest') {
          orderBy = { createdAt: 'asc' };
        }

        const [t, s] = await Promise.all([
          prisma.song.count({ where }),
          prisma.song.findMany({
            where,
            skip,
            take: limitNum,
            orderBy,
            include: {
              artist: {
                select: { id: true, name: true, avatarUrl: true, verified: true },
              },
              album: {
                select: { id: true, title: true, coverUrl: true },
              },
              genre: {
                select: { id: true, name: true, slug: true, color: true },
              },
            },
          }),
        ]);

        return { total: t, songs: s };
      },
      60 // Cache for 60 seconds
    );

    let likedSet = new Set<string>();
    if (req.user && songs.length > 0) {
      const songIds = songs.map((s: any) => s.id);
      const userFavs = await prisma.favorite.findMany({
        where: { userId: req.user.userId, songId: { in: songIds } },
        select: { songId: true },
      });
      likedSet = new Set(userFavs.map((f) => f.songId));
    }

    const formattedSongs = songs.map((s: any) => ({
      ...s,
      isLiked: likedSet.has(s.id),
    }));

    return sendSuccess(res, {
      items: formattedSongs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch songs', 500);
  }
};

export const getSongById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const data = await appCache.getOrSet(
      `songs:detail:${id}`,
      async () => {
        const song = await prisma.song.findUnique({
          where: { id },
          include: {
            artist: {
              select: { id: true, name: true, avatarUrl: true, biography: true, verified: true, monthlyListeners: true },
            },
            album: {
              select: { id: true, title: true, coverUrl: true, releaseDate: true },
            },
            genre: {
              select: { id: true, name: true, slug: true, color: true },
            },
            lyrics: true,
          },
        });

        if (!song) return null;

        // Get more songs from this artist
        const moreFromArtist = await prisma.song.findMany({
          where: {
            artistId: song.artistId,
            NOT: { id: song.id },
          },
          take: 6,
          include: {
            artist: { select: { id: true, name: true, avatarUrl: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
          },
        });

        // Get recommended similar songs (by genre)
        const recommended = await prisma.song.findMany({
          where: {
            genreId: song.genreId,
            NOT: { id: song.id },
          },
          take: 6,
          orderBy: { playsCount: 'desc' },
          include: {
            artist: { select: { id: true, name: true, avatarUrl: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
          },
        });

        return { song, moreFromArtist, recommended };
      },
      120 // Cache for 2 minutes
    );

    if (!data || !data.song) {
      return sendError(res, 'Song not found', 404);
    }

    let isLiked = false;
    if (req.user) {
      const fav = await prisma.favorite.findUnique({
        where: { userId_songId: { userId: req.user.userId, songId: id } },
      });
      isLiked = Boolean(fav);
    }

    return sendSuccess(res, {
      ...data.song,
      isLiked,
      moreFromArtist: data.moreFromArtist,
      recommended: data.recommended,
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch song details', 500);
  }
};

export const getTrendingSongs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const baseSongs = await appCache.getOrSet(
      'songs:trending:base',
      async () => {
        return prisma.song.findMany({
          where: { isTrending: true },
          take: 12,
          orderBy: { playsCount: 'desc' },
          include: {
            artist: { select: { id: true, name: true, avatarUrl: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
            genre: { select: { id: true, name: true, color: true } },
          },
        });
      },
      90 // 90 seconds cache
    );

    let likedSet = new Set<string>();
    if (req.user && baseSongs.length > 0) {
      const songIds = baseSongs.map((s) => s.id);
      const userFavs = await prisma.favorite.findMany({
        where: { userId: req.user.userId, songId: { in: songIds } },
        select: { songId: true },
      });
      likedSet = new Set(userFavs.map((f) => f.songId));
    }

    const formatted = baseSongs.map((s: any) => ({
      ...s,
      isLiked: likedSet.has(s.id),
    }));

    return sendSuccess(res, formatted);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch trending songs', 500);
  }
};

export const getTopCharts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const baseSongs = await appCache.getOrSet(
      'songs:top-charts:base',
      async () => {
        return prisma.song.findMany({
          take: 10,
          orderBy: { playsCount: 'desc' },
          include: {
            artist: { select: { id: true, name: true, avatarUrl: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
            genre: { select: { id: true, name: true, color: true } },
          },
        });
      },
      90
    );

    let likedSet = new Set<string>();
    if (req.user && baseSongs.length > 0) {
      const songIds = baseSongs.map((s) => s.id);
      const userFavs = await prisma.favorite.findMany({
        where: { userId: req.user.userId, songId: { in: songIds } },
        select: { songId: true },
      });
      likedSet = new Set(userFavs.map((f) => f.songId));
    }

    const formatted = baseSongs.map((s: any) => ({
      ...s,
      isLiked: likedSet.has(s.id),
    }));

    return sendSuccess(res, formatted);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch top charts', 500);
  }
};

export const getRecommendedSongs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const baseSongs = await appCache.getOrSet(
      'songs:recommended:base',
      async () => {
        return prisma.song.findMany({
          where: { isFeatured: true },
          take: 12,
          orderBy: { createdAt: 'desc' },
          include: {
            artist: { select: { id: true, name: true, avatarUrl: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
            genre: { select: { id: true, name: true, color: true } },
          },
        });
      },
      120
    );

    let likedSet = new Set<string>();
    if (req.user && baseSongs.length > 0) {
      const songIds = baseSongs.map((s) => s.id);
      const userFavs = await prisma.favorite.findMany({
        where: { userId: req.user.userId, songId: { in: songIds } },
        select: { songId: true },
      });
      likedSet = new Set(userFavs.map((f) => f.songId));
    }

    const formatted = baseSongs.map((s: any) => ({
      ...s,
      isLiked: likedSet.has(s.id),
    }));

    return sendSuccess(res, formatted);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch recommended songs', 500);
  }
};

export const recordPlay = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { durationPlayed = 0 } = req.body;

    // Buffer in-memory and batch write to Postgres (zero row-lock contention)
    const updatedCount = playbackBuffer.recordPlay(
      id,
      req.user?.userId,
      Number(durationPlayed) || 0
    );

    return sendSuccess(res, { playsCount: updatedCount });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to record play count', 500);
  }
};


// ==================== SONG CONTRIBUTION & CRUD ====================

const extractYoutubeId = (url?: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return match ? match[1] : null;
};

// YouTube Title & Info helper with SSRF Protection
export const getYoutubeInfo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url } = req.query;
    if (!url) {
      return sendError(res, 'Vui lòng cung cấp đường dẫn YouTube.', 400);
    }

    const rawUrl = String(url).trim();
    // SSRF Guard validation
    const ssrfCheck = validateSafeUrl(rawUrl, ['youtube.com', 'youtu.be', 'www.youtube.com', 'm.youtube.com']);
    if (!ssrfCheck.isValid) {
      SecurityLogger.log({
        type: 'SSRF_BLOCKED',
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        userId: req.user?.userId,
        resource: 'getYoutubeInfo',
        details: { blockedUrl: rawUrl, reason: ssrfCheck.reason },
      });
      return sendError(res, ssrfCheck.reason || 'Đường dẫn YouTube không hợp lệ.', 400);
    }

    const youtubeId = extractYoutubeId(rawUrl);
    if (!youtubeId) {
      return sendError(res, 'URL YouTube không hợp lệ.', 400);
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
    const cleanTitle = title
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

    // Real duration probe
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
    return sendError(res, error.message || 'Không thể lấy thông tin video YouTube.', 500);
  }
};

export const createSong = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = { ...req.body };

    const title = (body.title || '').trim();
    if (!title) {
      return sendError(res, 'Tên bài hát không được để trống.', 400);
    }

    const artistId = (body.artistId || '').trim();
    if (!artistId) {
      return sendError(res, 'Vui lòng chọn nghệ sĩ thể hiện.', 400);
    }

    // Verify artist exists
    const artist = await prisma.artist.findUnique({
      where: { id: artistId },
    });
    if (!artist) {
      return sendError(res, 'Nghệ sĩ được chọn không tồn tại.', 404);
    }

    // Check duplicate song under same artist
    const duplicate = await prisma.song.findFirst({
      where: {
        artistId,
        title: { equals: title, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      return sendError(res, `Bài hát "${duplicate.title}" của nghệ sĩ này đã có trên hệ thống.`, 409, {
        existingSong: duplicate,
      });
    }

    // Check uploaded files
    if (files?.audioFile && files.audioFile[0]) {
      body.audioUrl = await uploadPublicMedia(files.audioFile[0], 'audio');
      body.sourceType = 'upload';
    }
    if (files?.coverFile && files.coverFile[0]) {
      body.coverUrl = await uploadPublicMedia(files.coverFile[0], 'covers');
    }

    // Handle YouTube audio source
    if (
      body.sourceType === 'youtube' ||
      body.youtubeUrl ||
      (body.audioUrl && (body.audioUrl.includes('youtube.com') || body.audioUrl.includes('youtu.be')))
    ) {
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

    // Default coverUrl if not provided
    if (!body.coverUrl || !String(body.coverUrl).trim()) {
      if (artist.avatarUrl) {
        body.coverUrl = artist.avatarUrl;
      } else {
        body.coverUrl = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80';
      }
    }

    if (!body.audioUrl && !body.youtubeUrl) {
      return sendError(res, 'Vui lòng cung cấp file âm thanh hoặc đường dẫn YouTube.', 400);
    }

    // If audioUrl is remote URL, validate against SSRF
    if (body.audioUrl && (body.audioUrl.startsWith('http://') || body.audioUrl.startsWith('https://'))) {
      const audioUrlCheck = validateSafeUrl(body.audioUrl);
      if (!audioUrlCheck.isValid) {
        return sendError(res, `URL âm thanh không an toàn: ${audioUrlCheck.reason}`, 400);
      }
    }

    if (body.coverUrl && (body.coverUrl.startsWith('http://') || body.coverUrl.startsWith('https://'))) {
      const coverUrlCheck = validateSafeUrl(body.coverUrl);
      if (!coverUrlCheck.isValid) {
        return sendError(res, `URL ảnh bìa không an toàn: ${coverUrlCheck.reason}`, 400);
      }
    }

    const duration = parseInt(body.duration, 10) || 180;

    const song = await prisma.song.create({
      data: {
        title,
        artistId,
        albumId: body.albumId ? String(body.albumId).trim() : null,
        genreId: body.genreId ? String(body.genreId).trim() : null,
        duration,
        sourceType: body.sourceType || 'url',
        youtubeUrl: body.youtubeUrl || null,
        youtubeId: body.youtubeId || null,
        audioUrl: body.audioUrl,
        coverUrl: body.coverUrl,
        isTrending: req.user!.role === 'ADMIN' ? (body.isTrending === 'true' || body.isTrending === true) : false,
        isFeatured: req.user!.role === 'ADMIN' ? (body.isFeatured === 'true' || body.isFeatured === true) : false,
        createdBy: userId,
        ...(body.lyrics || body.syncedLyrics
          ? {
              lyrics: {
                create: {
                  plainLyrics: body.lyrics ? String(body.lyrics).trim() : '',
                  syncedLyrics: body.syncedLyrics ? String(body.syncedLyrics).trim() : null,
                  isSynced: !!body.syncedLyrics,
                },
              },
            }
          : {}),
      },
      include: {
        artist: { select: { id: true, name: true, avatarUrl: true } },
        album: { select: { id: true, title: true, coverUrl: true } },
        genre: { select: { id: true, name: true, slug: true } },
        lyrics: true,
      },
    });

    appCache.invalidatePrefix('songs:');
    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('albums:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');
    return sendSuccess(res, song, 'Đã thêm bài hát thành công.', 201);
  } catch (error: any) {
    return sendError(res, error.message || 'Không thể tạo bài hát mới.', 500);
  }
};

export const updateSong = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = { ...req.body };

    const song = await prisma.song.findUnique({
      where: { id },
    });

    if (!song) {
      return sendError(res, 'Không tìm thấy bài hát.', 404);
    }

    // Ownership check: user can only edit their own contributed song, unless admin
    if (song.createdBy !== userId && userRole !== 'ADMIN') {
      return sendError(res, 'Bạn không có quyền chỉnh sửa bài hát này.', 403);
    }

    const title = body.title !== undefined ? String(body.title).trim() : undefined;
    const artistId = body.artistId !== undefined ? String(body.artistId).trim() : undefined;

    if (title !== undefined && !title) {
      return sendError(res, 'Tên bài hát không được để trống.', 400);
    }

    // Check duplicate if title or artist changed
    if (title !== undefined || artistId !== undefined) {
      const targetArtistId = artistId || song.artistId;
      const targetTitle = title || song.title;

      const duplicate = await prisma.song.findFirst({
        where: {
          artistId: targetArtistId,
          title: { equals: targetTitle, mode: 'insensitive' },
          NOT: { id },
        },
      });

      if (duplicate) {
        return sendError(res, `Bài hát "${duplicate.title}" của nghệ sĩ này đã có trên hệ thống.`, 409, {
          existingSong: duplicate,
        });
      }
    }

    if (files?.audioFile && files.audioFile[0]) {
      body.audioUrl = await uploadPublicMedia(files.audioFile[0], 'audio');
      body.sourceType = 'upload';
    }
    if (files?.coverFile && files.coverFile[0]) {
      body.coverUrl = await uploadPublicMedia(files.coverFile[0], 'covers');
    }

    if (
      body.sourceType === 'youtube' ||
      body.youtubeUrl ||
      (body.audioUrl && (body.audioUrl.includes('youtube.com') || body.audioUrl.includes('youtu.be')))
    ) {
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

    const updated = await prisma.song.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(artistId !== undefined ? { artistId } : {}),
        ...(body.albumId !== undefined ? { albumId: body.albumId ? String(body.albumId).trim() : null } : {}),
        ...(body.genreId !== undefined ? { genreId: body.genreId ? String(body.genreId).trim() : null } : {}),
        ...(body.duration !== undefined ? { duration: parseInt(body.duration, 10) || song.duration } : {}),
        ...(body.sourceType !== undefined ? { sourceType: body.sourceType } : {}),
        ...(body.youtubeUrl !== undefined ? { youtubeUrl: body.youtubeUrl || null } : {}),
        ...(body.youtubeId !== undefined ? { youtubeId: body.youtubeId || null } : {}),
        ...(body.audioUrl ? { audioUrl: body.audioUrl } : {}),
        ...(body.coverUrl ? { coverUrl: body.coverUrl } : {}),
        ...(userRole === 'ADMIN' && body.isTrending !== undefined ? { isTrending: body.isTrending === 'true' || body.isTrending === true } : {}),
        ...(userRole === 'ADMIN' && body.isFeatured !== undefined ? { isFeatured: body.isFeatured === 'true' || body.isFeatured === true } : {}),
      },
    });

    if (body.lyrics !== undefined || body.syncedLyrics !== undefined) {
      await prisma.lyrics.upsert({
        where: { songId: id },
        create: {
          songId: id,
          plainLyrics: body.lyrics ? String(body.lyrics).trim() : '',
          syncedLyrics: body.syncedLyrics ? String(body.syncedLyrics).trim() : null,
          isSynced: !!body.syncedLyrics,
        },
        update: {
          ...(body.lyrics !== undefined ? { plainLyrics: String(body.lyrics).trim() } : {}),
          ...(body.syncedLyrics !== undefined
            ? {
                syncedLyrics: body.syncedLyrics ? String(body.syncedLyrics).trim() : null,
                isSynced: !!body.syncedLyrics,
              }
            : {}),
        },
      });
    }

    appCache.invalidatePrefix('songs:');
    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('albums:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');
    return sendSuccess(res, updated, 'Đã cập nhật bài hát thành công.');
  } catch (error: any) {
    return sendError(res, error.message || 'Không thể cập nhật bài hát.', 500);
  }
};

export const deleteSong = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const song = await prisma.song.findUnique({
      where: { id },
    });

    if (!song) {
      return sendError(res, 'Không tìm thấy bài hát.', 404);
    }

    // Ownership check: user can only delete their own contributed song, unless admin
    if (song.createdBy !== userId && userRole !== 'ADMIN') {
      SecurityLogger.log({
        type: 'AUTH_UNAUTHORIZED_ACCESS',
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        userId,
        action: 'DELETE_SONG_DENIED',
        resource: id,
      });
      return sendError(res, 'Bạn không có quyền xóa bài hát này.', 403);
    }

    await prisma.song.delete({ where: { id } });

    appCache.invalidatePrefix('songs:');
    appCache.invalidatePrefix('artists:');
    appCache.invalidatePrefix('albums:');
    appCache.invalidatePrefix('search:');
    appCache.invalidatePrefix('admin:dashboard');

    SecurityLogger.log({
      type: 'ADMIN_ACTION',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userId,
      action: 'DELETE_SONG',
      resource: id,
    });

    return sendSuccess(res, null, 'Đã xóa bài hát thành công.');
  } catch (error: any) {
    return sendError(res, error.message || 'Không thể xóa bài hát.', 500);
  }
};


export const getMySongContributions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const songs = await prisma.song.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        artist: { select: { id: true, name: true, avatarUrl: true } },
        album: { select: { id: true, title: true, coverUrl: true } },
        genre: { select: { id: true, name: true, color: true } },
        lyrics: true,
      },
    });

    return sendSuccess(res, songs);
  } catch (error: any) {
    return sendError(res, error.message || 'Không thể tải danh sách bài hát đã đóng góp.', 500);
  }
};
