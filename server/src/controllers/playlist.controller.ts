import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

const createPlaylistSchema = z.object({
  title: z.string().min(1, 'Playlist title is required').max(60),
  description: z.string().max(300).optional(),
  isPublic: z.boolean().optional().default(true),
  coverUrl: z.string().url().optional().or(z.string().length(0)),
});

const updatePlaylistSchema = z.object({
  title: z.string().min(1).max(60).optional(),
  description: z.string().max(300).optional(),
  isPublic: z.boolean().optional(),
  coverUrl: z.string().url().optional().or(z.string().length(0)),
});

export const getUserPlaylists = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const playlists = await prisma.playlist.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { songs: true } },
        songs: {
          take: 4,
          include: {
            song: { select: { coverUrl: true } },
          },
        },
      },
    });

    return sendSuccess(res, playlists);
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch playlists', 500);
  }
};

export const getPlaylistById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        songs: {
          orderBy: { position: 'asc' },
          include: {
            song: {
              include: {
                artist: { select: { id: true, name: true, avatarUrl: true } },
                album: { select: { id: true, title: true, coverUrl: true } },
                genre: { select: { id: true, name: true, color: true } },
                ...(req.user
                  ? {
                      favorites: {
                        where: { userId: req.user.userId },
                        select: { id: true },
                      },
                    }
                  : {}),
              },
            },
          },
        },
      },
    });

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    // Check visibility if private
    if (!playlist.isPublic && (!req.user || req.user.userId !== playlist.userId)) {
      return sendError(res, 'This playlist is private', 403);
    }

    const formattedTracks = playlist.songs.map((ps) => {
      const isLiked = req.user ? (ps.song as any).favorites && (ps.song as any).favorites.length > 0 : false;
      const { favorites, ...sData } = ps.song as any;
      return {
        ...sData,
        position: ps.position,
        playlistSongId: ps.id,
        isLiked,
      };
    });

    const isOwner = req.user ? req.user.userId === playlist.userId : false;

    return sendSuccess(res, {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      coverUrl: playlist.coverUrl,
      isPublic: playlist.isPublic,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
      user: playlist.user,
      isOwner,
      totalSongs: formattedTracks.length,
      songs: formattedTracks,
    });
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to fetch playlist', 500);
  }
};

export const createPlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = createPlaylistSchema.parse(req.body);
    const userId = req.user!.userId;

    const playlist = await prisma.playlist.create({
      data: {
        title: validated.title,
        description: validated.description,
        isPublic: validated.isPublic ?? true,
        coverUrl: validated.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
        userId,
      },
      include: {
        _count: { select: { songs: true } },
      },
    });

    return sendSuccess(res, playlist, 'Playlist created successfully', 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Validation error', 400);
    }
    return sendError(res, error.message || 'Failed to create playlist', 500);
  }
};

export const updatePlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const validated = updatePlaylistSchema.parse(req.body);

    const playlist = await prisma.playlist.findUnique({
      where: { id },
    });

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    if (playlist.userId !== userId && req.user!.role !== 'ADMIN') {
      return sendError(res, 'Unauthorized to edit this playlist', 403);
    }

    const updated = await prisma.playlist.update({
      where: { id },
      data: {
        ...(validated.title ? { title: validated.title } : {}),
        ...(validated.description !== undefined ? { description: validated.description } : {}),
        ...(validated.isPublic !== undefined ? { isPublic: validated.isPublic } : {}),
        ...(validated.coverUrl !== undefined ? { coverUrl: validated.coverUrl || null } : {}),
      },
    });

    return sendSuccess(res, updated, 'Playlist updated successfully');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Validation error', 400);
    }
    return sendError(res, error.message || 'Failed to update playlist', 500);
  }
};

export const deletePlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const playlist = await prisma.playlist.findUnique({
      where: { id },
    });

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    if (playlist.userId !== userId && req.user!.role !== 'ADMIN') {
      return sendError(res, 'Unauthorized to delete this playlist', 403);
    }

    await prisma.playlist.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Playlist deleted successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to delete playlist', 500);
  }
};

export const addSongToPlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: playlistId } = req.params;
    const { songId } = req.body;
    const userId = req.user!.userId;

    if (!songId) {
      return sendError(res, 'Song ID is required', 400);
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    if (playlist.userId !== userId && req.user!.role !== 'ADMIN') {
      return sendError(res, 'Unauthorized to modify this playlist', 403);
    }

    const count = await prisma.playlistSong.count({
      where: { playlistId },
    });

    const playlistSong = await prisma.playlistSong.upsert({
      where: {
        playlistId_songId: { playlistId, songId },
      },
      update: {},
      create: {
        playlistId,
        songId,
        position: count,
      },
    });

    // Update playlist cover if default or first song
    if (!playlist.coverUrl || playlist.coverUrl.includes('unsplash')) {
      const song = await prisma.song.findUnique({ where: { id: songId } });
      if (song) {
        await prisma.playlist.update({
          where: { id: playlistId },
          data: { coverUrl: song.coverUrl },
        });
      }
    }

    return sendSuccess(res, playlistSong, 'Song added to playlist');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to add song to playlist', 500);
  }
};

export const removeSongFromPlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: playlistId, songId } = req.params;
    const userId = req.user!.userId;

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      return sendError(res, 'Playlist not found', 404);
    }

    if (playlist.userId !== userId && req.user!.role !== 'ADMIN') {
      return sendError(res, 'Unauthorized to modify this playlist', 403);
    }

    await prisma.playlistSong.deleteMany({
      where: {
        playlistId,
        songId,
      },
    });

    return sendSuccess(res, null, 'Song removed from playlist');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to remove song from playlist', 500);
  }
};

export const reorderPlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: playlistId } = req.params;
    const { songIds } = req.body; // Array of song IDs in new order
    const userId = req.user!.userId;

    if (!Array.isArray(songIds)) {
      return sendError(res, 'songIds must be an array of string IDs', 400);
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist || (playlist.userId !== userId && req.user!.role !== 'ADMIN')) {
      return sendError(res, 'Unauthorized or playlist not found', 403);
    }

    await prisma.$transaction(
      songIds.map((songId: string, index: number) =>
        prisma.playlistSong.updateMany({
          where: { playlistId, songId },
          data: { position: index },
        })
      )
    );

    return sendSuccess(res, null, 'Playlist reordered successfully');
  } catch (error: any) {
    return sendError(res, error.message || 'Failed to reorder playlist', 500);
  }
};
