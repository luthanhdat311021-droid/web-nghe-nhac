import { Response } from 'express';
import { prisma } from '../services/prisma.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { uploadPublicMedia } from '../services/storage.js';
import { appCache } from '../utils/cacheManager.js';

export const getAllArtists = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const cleanSearch = typeof search === 'string' ? search.trim() : '';
    const cacheKey = `artists:list:${cleanSearch}:${pageNum}:${limitNum}`;

    const { total, artists } = await appCache.getOrSet(
      cacheKey,
      async () => {
        const where: any = cleanSearch
          ? { name: { contains: cleanSearch, mode: 'insensitive' } }
          : {};

        const [t, a] = await Promise.all([
          prisma.artist.count({ where }),
          prisma.artist.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { monthlyListeners: 'desc' },
            include: {
              _count: {
                select: { songs: true, albums: true, followers: true },
              },
            },
          }),
        ]);

        return { total: t, artists: a };
      },
      180 // Cache for 3 minutes
    );

    let followedSet = new Set<string>();
    if (req.user && artists.length > 0) {
      const artistIds = artists.map((a: any) => a.id);
      const userFollows = await prisma.follower.findMany({
        where: { userId: req.user.userId, artistId: { in: artistIds } },
        select: { artistId: true },
      });
      followedSet = new Set(userFollows.map((f) => f.artistId));
    }

    const formatted = artists.map((a: any) => ({
      ...a,
      isFollowed: followedSet.has(a.id),
    }));

    return sendSuccess(res, {
      items: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch artists', 500);
  }
};

export const getArtistById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const data = await appCache.getOrSet(
      `artists:detail:${id}`,
      async () => {
        const artist = await prisma.artist.findUnique({
          where: { id },
          include: {
            _count: {
              select: { songs: true, albums: true, followers: true },
            },
            albums: {
              orderBy: { releaseDate: 'desc' },
              include: {
                genre: { select: { id: true, name: true } },
                _count: { select: { songs: true } },
              },
            },
            songs: {
              take: 50,
              orderBy: { playsCount: 'desc' },
              include: {
                artist: { select: { id: true, name: true, avatarUrl: true } },
                album: { select: { id: true, title: true, coverUrl: true } },
                genre: { select: { id: true, name: true, color: true } },
              },
            },
          },
        });

        if (!artist) return null;

        // Get related artists
        const relatedArtists = await prisma.artist.findMany({
          where: {
            NOT: { id: artist.id },
          },
          take: 6,
          orderBy: { monthlyListeners: 'desc' },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            monthlyListeners: true,
            verified: true,
          },
        });

        return { artist, relatedArtists };
      },
      180 // Cache for 3 minutes
    );

    if (!data || !data.artist) {
      return sendError(res, 'Artist not found', 404);
    }

    let isFollowed = false;
    let likedSongSet = new Set<string>();

    if (req.user) {
      const [follow, userFavs] = await Promise.all([
        prisma.follower.findUnique({
          where: { userId_artistId: { userId: req.user.userId, artistId: id } },
        }),
        prisma.favorite.findMany({
          where: {
            userId: req.user.userId,
            songId: { in: data.artist.songs.map((s: any) => s.id) },
          },
          select: { songId: true },
        }),
      ]);
      isFollowed = Boolean(follow);
      likedSongSet = new Set(userFavs.map((f) => f.songId));
    }

    const formattedSongs = data.artist.songs.map((s: any) => ({
      ...s,
      isLiked: likedSongSet.has(s.id),
    }));

    return sendSuccess(res, {
      ...data.artist,
      songs: formattedSongs,
      isFollowed,
      relatedArtists: data.relatedArtists,
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch artist details', 500);
  }
};

export const toggleFollowArtist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const existingFollow = await prisma.follower.findUnique({
      where: {
        userId_artistId: { userId, artistId: id },
      },
    });

    if (existingFollow) {
      await prisma.follower.delete({
        where: { id: existingFollow.id },
      });
      return sendSuccess(res, { isFollowed: false }, 'Unfollowed artist');
    } else {
      await prisma.follower.create({
        data: { userId, artistId: id },
      });
      return sendSuccess(res, { isFollowed: true }, 'Followed artist');
    }
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to toggle follow status', 500);
  }
};

export const getFollowedArtists = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const follows = await prisma.follower.findMany({
      where: { userId },
      include: {
        artist: {
          include: {
            _count: { select: { songs: true, albums: true, followers: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const artists = follows.map((f) => ({
      ...f.artist,
      isFollowed: true,
    }));

    return sendSuccess(res, artists);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch followed artists', 500);
  }
};

// ==================== ARTIST CONTRIBUTION & CRUD ====================

export const createArtist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = { ...req.body };

    const name = (body.name || '').trim();
    if (!name) {
      return sendError(res, 'Tên nghệ sĩ không được để trống.', 400);
    }

    // Check duplicate (case-insensitive name check)
    const existing = await prisma.artist.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existing) {
      return sendError(res, `Nghệ sĩ "${existing.name}" đã tồn tại trong hệ thống.`, 409, {
        existingArtist: existing,
      });
    }

    if (files?.avatarFile && files.avatarFile[0]) {
      body.avatarUrl = await uploadPublicMedia(files.avatarFile[0], 'artists');
    }
    if (files?.bannerFile && files.bannerFile[0]) {
      body.bannerUrl = await uploadPublicMedia(files.bannerFile[0], 'artists');
    }

    if (!body.avatarUrl) {
      body.avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
    }

    const artist = await prisma.artist.create({
      data: {
        name,
        avatarUrl: body.avatarUrl,
        bannerUrl: body.bannerUrl || null,
        biography: body.biography ? String(body.biography).trim() : null,
        verified: req.user!.role === 'ADMIN' ? (body.verified === 'true' || body.verified === true) : false,
        country: body.country ? String(body.country).trim() : null,
        monthlyListeners: body.monthlyListeners ? parseInt(body.monthlyListeners, 10) || 12000 : Math.floor(Math.random() * 50000) + 10000,
        createdBy: userId,
      },
    });

    return sendSuccess(res, artist, 'Đã thêm nghệ sĩ thành công.', 201);
  } catch (error: any) {
    return sendError(res, error.message || 'Không thể tạo nghệ sĩ mới.', 500);
  }
};

export const updateArtist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const body = { ...req.body };

    const artist = await prisma.artist.findUnique({
      where: { id },
    });

    if (!artist) {
      return sendError(res, 'Không tìm thấy nghệ sĩ.', 404);
    }

    // Ownership check: user can only edit their own contributed artist, unless admin
    if (artist.createdBy !== userId && userRole !== 'ADMIN') {
      return sendError(res, 'Bạn không có quyền chỉnh sửa thông tin nghệ sĩ này.', 403);
    }

    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    if (name !== undefined) {
      if (!name) {
        return sendError(res, 'Tên nghệ sĩ không được để trống.', 400);
      }

      // Check if new name conflicts with another artist
      const duplicate = await prisma.artist.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          NOT: { id },
        },
      });

      if (duplicate) {
        return sendError(res, `Tên nghệ sĩ "${duplicate.name}" đã được sử dụng.`, 409, {
          existingArtist: duplicate,
        });
      }
    }

    if (files?.avatarFile && files.avatarFile[0]) {
      body.avatarUrl = await uploadPublicMedia(files.avatarFile[0], 'artists');
    }
    if (files?.bannerFile && files.bannerFile[0]) {
      body.bannerUrl = await uploadPublicMedia(files.bannerFile[0], 'artists');
    }

    const updated = await prisma.artist.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(body.avatarUrl ? { avatarUrl: body.avatarUrl } : {}),
        ...(body.bannerUrl !== undefined ? { bannerUrl: body.bannerUrl || null } : {}),
        ...(body.biography !== undefined ? { biography: body.biography ? String(body.biography).trim() : null } : {}),
        ...(body.country !== undefined ? { country: body.country ? String(body.country).trim() : null } : {}),
        ...(userRole === 'ADMIN' && body.verified !== undefined ? { verified: body.verified === 'true' || body.verified === true } : {}),
        ...(body.monthlyListeners !== undefined ? { monthlyListeners: parseInt(body.monthlyListeners, 10) || artist.monthlyListeners } : {}),
      },
    });

    return sendSuccess(res, updated, 'Đã cập nhật thông tin nghệ sĩ thành công.');
  } catch (error: any) {
    return sendError(res, error.message || 'Không thể cập nhật nghệ sĩ.', 500);
  }
};

export const deleteArtist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const artist = await prisma.artist.findUnique({
      where: { id },
    });

    if (!artist) {
      return sendError(res, 'Không tìm thấy nghệ sĩ.', 404);
    }

    // Ownership check: user can only delete their own contributed artist, unless admin
    if (artist.createdBy !== userId && userRole !== 'ADMIN') {
      return sendError(res, 'Bạn không có quyền xóa nghệ sĩ này.', 403);
    }

    await prisma.artist.delete({ where: { id } });

    return sendSuccess(res, null, 'Đã xóa nghệ sĩ thành công.');
  } catch (error: any) {
    return sendError(res, error.message || 'Không thể xóa nghệ sĩ.', 500);
  }
};

export const getMyArtistContributions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const artists = await prisma.artist.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { songs: true, albums: true, followers: true },
        },
      },
    });

    return sendSuccess(res, artists);
  } catch (error: any) {
    return sendError(res, error.message || 'Không thể tải danh sách nghệ sĩ đã đóng góp.', 500);
  }
};
