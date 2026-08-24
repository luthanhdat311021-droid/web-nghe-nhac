import { Response } from 'express';
import { prisma } from '../services/prisma.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { appCache } from '../utils/cacheManager.js';

export const getAllAlbums = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, genre, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const cacheKey = `albums:list:${genre || 'all'}:${search || ''}:${pageNum}:${limitNum}`;

    const { total, albums } = await appCache.getOrSet(
      cacheKey,
      async () => {
        const where: any = {};
        if (search) {
          where.OR = [
            { title: { contains: String(search), mode: 'insensitive' } },
            { artist: { name: { contains: String(search), mode: 'insensitive' } } },
          ];
        }
        if (genre) {
          where.genre = { slug: String(genre) };
        }

        const [t, al] = await Promise.all([
          prisma.album.count({ where }),
          prisma.album.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { releaseDate: 'desc' },
            include: {
              artist: { select: { id: true, name: true, avatarUrl: true, verified: true } },
              genre: { select: { id: true, name: true, slug: true, color: true } },
              _count: { select: { songs: true } },
            },
          }),
        ]);

        return { total: t, albums: al };
      },
      180 // Cache for 3 minutes
    );

    return sendSuccess(res, {
      items: albums,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch albums', 500);
  }
};

export const getAlbumById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const album = await appCache.getOrSet(
      `albums:detail:${id}`,
      async () => {
        return prisma.album.findUnique({
          where: { id },
          include: {
            artist: { select: { id: true, name: true, avatarUrl: true, biography: true, verified: true } },
            genre: { select: { id: true, name: true, slug: true, color: true } },
            songs: {
              orderBy: { createdAt: 'asc' },
              include: {
                artist: { select: { id: true, name: true } },
                genre: { select: { id: true, name: true } },
              },
            },
          },
        });
      },
      180 // Cache for 3 minutes
    );

    if (!album) {
      return sendError(res, 'Album not found', 404);
    }

    const totalDuration = album.songs.reduce((acc: number, song: any) => acc + song.duration, 0);

    let likedSet = new Set<string>();
    if (req.user && album.songs.length > 0) {
      const songIds = album.songs.map((s: any) => s.id);
      const userFavs = await prisma.favorite.findMany({
        where: { userId: req.user.userId, songId: { in: songIds } },
        select: { songId: true },
      });
      likedSet = new Set(userFavs.map((f) => f.songId));
    }

    const formattedSongs = album.songs.map((s: any) => ({
      ...s,
      isLiked: likedSet.has(s.id),
    }));

    return sendSuccess(res, {
      ...album,
      totalDuration,
      songs: formattedSongs,
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch album details', 500);
  }
};
