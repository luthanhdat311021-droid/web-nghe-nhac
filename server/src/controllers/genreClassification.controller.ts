import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../services/prisma.js';
import { classifyGenres } from '../services/genreClassification.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { appCache } from '../utils/cacheManager.js';

let running = false;
export async function classifyUnassignedGenres(req: AuthenticatedRequest, res: Response) {
  const input = z.object({ afterId: z.string().uuid().optional() }).safeParse(req.body || {});
  if (!input.success) return sendError(res, 'Tham số phân loại không hợp lệ.', 400);
  if (running) return sendError(res, 'Đang có lượt phân loại khác. Vui lòng thử lại sau.', 409);
  if (!process.env.GEMINI_API_KEY?.trim()) return sendError(res, 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.', 503);
  running = true;
  try {
    const [genres, songs] = await Promise.all([
      prisma.genre.findMany({ select: { id: true, name: true, slug: true } }),
      prisma.song.findMany({
        where: { genreId: null, ...(input.data.afterId ? { id: { gt: input.data.afterId } } : {}) },
        orderBy: { id: 'asc' }, take: 20,
        select: { id: true, title: true, updatedAt: true, artist: { select: { name: true } }, album: { select: { title: true } } },
      }),
    ]);
    if (!genres.length) return sendError(res, 'Chưa có danh mục thể loại để phân loại.', 400);
    const decisions = songs.length ? await classifyGenres(songs.map(s => ({
      id: s.id, title: s.title.slice(0, 200), artist: s.artist.name.slice(0, 150), album: s.album?.title.slice(0, 200) || null,
    })), genres) : [];
    const updates = await prisma.$transaction(decisions.map(d => prisma.song.updateMany({
      // Preserve manual changes made while Gemini was processing.
      where: { id: d.songId, genreId: null, updatedAt: songs.find(s => s.id === d.songId)!.updatedAt },
      data: { genreId: d.genreId },
    })));
    const classified = updates.reduce((sum, update) => sum + update.count, 0);
    if (classified) {
      for (const prefix of ['search:', 'suggestions:', 'songs:', 'genres:', 'trending:', 'admin:dashboard']) appCache.invalidatePrefix(prefix);
    }
    return sendSuccess(res, { processed: songs.length, classified, skipped: songs.length - classified,
      nextCursor: songs.length === 20 ? songs[songs.length - 1].id : null });
  } catch (error) {
    return sendError(res, error instanceof Error && error.message.startsWith('Gemini')
      ? error.message : 'Không thể hoàn tất phân loại AI. Vui lòng thử lại sau.', 502);
  } finally { running = false; }
}
