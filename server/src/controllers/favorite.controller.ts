import { Response } from 'express';
import { prisma } from '../services/prisma.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getFavorites = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { limit = '100', page = '1' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 100));
    const skip = (pageNum - 1) * limitNum;

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        song: {
          include: {
            artist: { select: { id: true, name: true, avatarUrl: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
            genre: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    const songs = favorites.map((f) => ({
      ...f.song,
      isLiked: true,
      likedAt: f.createdAt,
    }));

    return sendSuccess(res, songs);

  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch favorites', 500);
  }
};

export const toggleFavorite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { songId } = req.params;
    const userId = req.user!.userId;

    const song = await prisma.song.findUnique({
      where: { id: songId },
    });

    if (!song) {
      return sendError(res, 'Song not found', 404);
    }

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_songId: { userId, songId },
      },
    });

    if (existing) {
      await prisma.favorite.delete({
        where: { id: existing.id },
      });
      return sendSuccess(res, { isLiked: false }, 'Removed from favorites');
    } else {
      await prisma.favorite.create({
        data: { userId, songId },
      });
      return sendSuccess(res, { isLiked: true }, 'Added to favorites');
    }
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to toggle favorite', 500);
  }
};
