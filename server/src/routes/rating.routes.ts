import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { isPro } from '../services/musicPolicy.js';

const router = Router({ mergeParams: true });
const wrap = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthenticatedRequest, res: Response, next: any) => { Promise.resolve(fn(req, res)).catch(next); };

const ratingSchema = z.object({
  rating: z.number().int('Số sao phải là số nguyên').min(1, 'Số sao từ 1 đến 5').max(5, 'Số sao từ 1 đến 5'),
  comment: z.string().trim().max(500, 'Nhận xét tối đa 500 ký tự').optional().nullable(),
});
const userSelect = { select: { id: true, username: true, avatarUrl: true } };

router.get('/', optionalAuth, wrap(async (req, res) => {
  const songId = req.params.id;
  const userId = req.user?.userId;
  const [stats, items, mine, viewer] = await Promise.all([
    prisma.songRating.aggregate({ where: { songId }, _avg: { rating: true }, _count: true }),
    prisma.songRating.findMany({ where: { songId }, orderBy: { updatedAt: 'desc' }, take: 20, include: { user: userSelect } }),
    userId ? prisma.songRating.findUnique({ where: { userId_songId: { userId, songId } } }) : null,
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { proExpiresAt: true } }) : null,
  ]);
  if (userId) res.setHeader('Cache-Control', 'private, no-store');
  return sendSuccess(res, {
    average: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : 0,
    count: stats._count,
    items,
    myRating: mine,
    canRate: !!viewer && isPro(viewer.proExpiresAt),
  });
}));

router.put('/', requireAuth, wrap(async (req, res) => {
  const parsed = ratingSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, parsed.error.errors[0]?.message || 'Dữ liệu đánh giá không hợp lệ', 400);
  const userId = req.user!.userId;
  const songId = req.params.id;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { proExpiresAt: true } });
  if (!isPro(user.proExpiresAt)) return sendError(res, 'Chỉ tài khoản Music Pro mới được đánh giá bài hát.', 403);
  if (!await prisma.song.findUnique({ where: { id: songId }, select: { id: true } })) return sendError(res, 'Bài hát không tồn tại.', 404);
  const data = { rating: parsed.data.rating, comment: parsed.data.comment || null };
  const rating = await prisma.songRating.upsert({
    where: { userId_songId: { userId, songId } },
    create: { userId, songId, ...data },
    update: data,
    include: { user: userSelect },
  });
  return sendSuccess(res, rating, 'Đã lưu đánh giá của bạn.');
}));

router.delete('/', requireAuth, wrap(async (req, res) => {
  await prisma.songRating.deleteMany({ where: { userId: req.user!.userId, songId: req.params.id } });
  return sendSuccess(res, null, 'Đã xóa đánh giá.');
}));

export default router;
