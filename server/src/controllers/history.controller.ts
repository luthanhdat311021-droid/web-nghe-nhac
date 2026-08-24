import { Response } from 'express';
import { prisma } from '../services/prisma.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { limit = '30' } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 30));

    const history = await prisma.recentlyPlayed.findMany({
      where: { userId },
      take: limitNum,
      orderBy: { playedAt: 'desc' },
      include: {
        song: {
          include: {
            artist: { select: { id: true, name: true, avatarUrl: true } },
            album: { select: { id: true, title: true, coverUrl: true } },
            genre: { select: { id: true, name: true, color: true } },
            favorites: {
              where: { userId },
              select: { id: true },
            },
          },
        },
      },
    });

    const formatted = history.map((h) => ({
      historyId: h.id,
      playedAt: h.playedAt,
      durationPlayed: h.durationPlayed,
      song: {
        ...h.song,
        isLiked: h.song.favorites && h.song.favorites.length > 0,
        favorites: undefined,
      },
    }));

    return sendSuccess(res, formatted);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch play history', 500);
  }
};

export const clearHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    await prisma.recentlyPlayed.deleteMany({
      where: { userId },
    });

    return sendSuccess(res, null, 'Listening history cleared successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to clear history', 500);
  }
};
