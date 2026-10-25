import { Router, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AD_SECONDS, FREE_LIMIT, FREE_PLAYLIST_LIMIT, PAYMENT_CLOCK_SKEW_MS, PRO_DAYS, PRO_PRICE, extendPro, isPro, paymentCode, vietnamDay } from '../services/musicPolicy.js';
import { config } from '../config/index.js';

const router = Router();
const account = () => process.env.SEPAY_ACCOUNT_NUMBER || '0819883208';
const bank = () => process.env.SEPAY_BANK || 'MBBank';
const wrap = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthenticatedRequest, res: Response, next: any) => { Promise.resolve(fn(req, res)).catch(next); };
const presentOrder = (order: any) => ({
  id: order.id, code: order.code, amount: order.amount, expiresAt: order.expiresAt,
  status: order.status === 'PENDING' && order.expiresAt < new Date() ? 'EXPIRED' : order.status,
  paidAt: order.paidAt, accountNumber: account(), bank: bank(),
  qrUrl: `https://vietqr.app/img?${new URLSearchParams({ acc: account(), bank: bank(), amount: String(order.amount), des: order.code, template: 'compact' })}`,
});

router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
router.get('/status', requireAuth, wrap(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId } });
  const usage = await prisma.dailyUsage.findUnique({ where: { userId_day: { userId: user.id, day: vietnamDay() } } });
  const playlistCount = await prisma.playlist.count({ where: { userId: user.id } });
  return sendSuccess(res, { isPro: isPro(user.proExpiresAt), proExpiresAt: user.proExpiresAt,
    used: usage?.count || 0, limit: FREE_LIMIT, price: PRO_PRICE, days: PRO_DAYS,
    playlistCount, playlistLimit: FREE_PLAYLIST_LIMIT,
    paymentEnabled: !!process.env.SEPAY_WEBHOOK_KEY });
}));

router.post('/orders', requireAuth, wrap(async (req, res) => {
  if (!process.env.SEPAY_WEBHOOK_KEY) return sendError(res, 'Thanh toán đang được thiết lập. Vui lòng quay lại sau.', 503);
  const order = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user!.userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: req.user!.userId } });
    if (isPro(user.proExpiresAt)) return null;
    const existing = await tx.paymentOrder.findFirst({ where: { userId: req.user!.userId, status: 'PENDING', expiresAt: { gt: new Date() } } });
    return existing || tx.paymentOrder.create({ data: { userId: req.user!.userId,
      code: `MW${randomBytes(12).toString('hex').toUpperCase()}`, amount: PRO_PRICE,
      expiresAt: new Date(Date.now() + 30 * 60000) } });
  });
  if (!order) return sendError(res, 'Gói Music Pro của bạn vẫn đang hoạt động.', 400);
  return sendSuccess(res, presentOrder(order));
}));
router.get('/orders/:id', requireAuth, wrap(async (req, res) => {
  const order = await prisma.paymentOrder.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
  return order ? sendSuccess(res, presentOrder(order)) : sendError(res, 'Không tìm thấy đơn thanh toán.', 404);
}));

const webhookSchema = z.object({
  id: z.number().int().positive(), gateway: z.string(), accountNumber: z.string(),
  transferType: z.string(), transferAmount: z.number().finite().nonnegative(),
  content: z.string().nullable().optional(), code: z.string().nullable().optional(), transactionDate: z.string(),
});
router.post('/sepay/webhook', wrap(async (req, res) => {
  const secret = process.env.SEPAY_WEBHOOK_KEY;
  if (!secret) return sendError(res, 'Payment service unavailable', 503);
  const expected = Buffer.from(`Apikey ${secret}`);
  const received = Buffer.from(req.headers.authorization || '');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return sendError(res, 'Unauthorized', 401);
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Invalid webhook payload', 400);
  const event = parsed.data;
  // Acknowledge ignored events so SePay stops retrying, but leave a trail for reconciliation.
  const ignore = (reason: string) => {
    console.warn(`[SePay] ignored transaction ${event.id}: ${reason}`, { gateway: event.gateway, accountNumber: event.accountNumber,
      transferType: event.transferType, transferAmount: event.transferAmount, code: event.code, content: event.content, transactionDate: event.transactionDate });
    return res.json({ success: true });
  };
  if (event.transferType !== 'in') return ignore('not incoming');
  if (event.accountNumber !== account() || event.gateway.toLowerCase() !== bank().toLowerCase()) return ignore('account or bank mismatch');
  const codes = [...new Set(paymentCode(`${event.code || ''} ${event.content || ''}`))];
  if (codes.length !== 1) return ignore(`expected one payment code, found ${codes.length}`);
  const paidAt = new Date(event.transactionDate.replace(' ', 'T') + '+07:00');
  if (!Number.isFinite(paidAt.getTime())) return sendError(res, 'Invalid transaction date', 400);
  const rejected = await prisma.$transaction(async tx => {
    const found = await tx.paymentOrder.findUnique({ where: { code: codes[0] } });
    if (!found) return 'order not found';
    // One lock serializes renewals, duplicate notifications and playback for this account.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${found.userId} FOR UPDATE`;
    const order = await tx.paymentOrder.findUniqueOrThrow({ where: { id: found.id } });
    if (order.status !== 'PENDING') return `order already ${order.status}`;
    if (order.amount !== event.transferAmount) return `amount ${event.transferAmount} != ${order.amount}`;
    if (paidAt.getTime() > order.expiresAt.getTime() + PAYMENT_CLOCK_SKEW_MS ||
        paidAt.getTime() < order.createdAt.getTime() - PAYMENT_CLOCK_SKEW_MS ||
        paidAt.getTime() > Date.now() + PAYMENT_CLOCK_SKEW_MS) return 'transaction time outside order window';
    if (await tx.paymentOrder.findUnique({ where: { transactionId: String(event.id) } })) return 'duplicate transaction';
    const user = await tx.user.findUniqueOrThrow({ where: { id: order.userId } });
    await tx.paymentOrder.update({ where: { id: order.id }, data: { status: 'PAID', transactionId: String(event.id), paidAt } });
    await tx.user.update({ where: { id: user.id }, data: { proExpiresAt: extendPro(user.proExpiresAt) } });
    return null;
  });
  if (rejected) return ignore(rejected);
  console.log(`[SePay] order ${codes[0]} paid by transaction ${event.id}`);
  return res.json({ success: true });
}));

router.post('/playback/:songId/prepare', requireAuth, wrap(async (req, res) => {
  const userId = req.user!.userId;
  if (!await prisma.song.findUnique({ where: { id: req.params.songId }, select: { id: true } })) return sendError(res, 'Bài hát không tồn tại.', 404);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const pro = isPro(user.proExpiresAt);
  const usage = await prisma.dailyUsage.findUnique({ where: { userId_day: { userId, day: vietnamDay() } } });
  if (!pro && (usage?.count || 0) >= FREE_LIMIT) return sendError(res, 'Bạn đã nghe đủ 3 lượt hôm nay. Nâng cấp Music Pro để nghe không giới hạn.', 403);
  const seconds = pro ? 0 : AD_SECONDS;
  const session = await prisma.playbackSession.create({ data: { userId, songId: req.params.songId, adRequired: !pro,
    readyAt: new Date(Date.now() + seconds * 1000), expiresAt: new Date(Date.now() + 5 * 60000) } });
  return sendSuccess(res, { sessionId: session.id, adSeconds: seconds });
}));

router.post('/playback/:sessionId/start', requireAuth, wrap(async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const userId = req.user!.userId;
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const session = await tx.playbackSession.findUnique({ where: { id: req.params.sessionId } });
    const now = new Date();
    if (!session || session.userId !== userId || session.expiresAt < now || session.readyAt > now) return null;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const song = await tx.song.findUnique({ where: { id: session.songId } });
    if (!song) return null;
    if (!session.consumedAt) {
      if (!isPro(user.proExpiresAt, now)) {
        if (!session.adRequired) return null; // Pro expired after preparation: request a new ad-backed session.
        const key = { userId, day: vietnamDay(now) };
        const usage = await tx.dailyUsage.upsert({ where: { userId_day: key }, create: key, update: {} });
        if (usage.count >= FREE_LIMIT) return null;
        await tx.dailyUsage.update({ where: { userId_day: key }, data: { count: { increment: 1 } } });
      }
      await tx.playbackSession.update({ where: { id: session.id }, data: { consumedAt: now } });
      await tx.song.update({ where: { id: song.id }, data: { playsCount: { increment: 1 } } });
      await tx.recentlyPlayed.create({ data: { userId, songId: song.id } });
    }
    return { song, userId };
  });
  if (!result) return sendError(res, 'Lượt phát không hợp lệ, chưa hết quảng cáo hoặc đã hết hạn mức hôm nay.', 403);
  res.locals.allowPlaybackSource = true;
  const mediaToken = jwt.sign({ purpose: 'MEDIA', userId: result.userId, songId: result.song.id }, config.jwt.secret, { expiresIn: '2h' });
  const song = result.song;
  if (song.audioUrl.startsWith('data:')) song.audioUrl = `/api/media/inline/${song.id}/audioUrl?ticket=${mediaToken}`;
  else if (new URL(song.audioUrl || '/', 'http://local').pathname.startsWith('/uploads/')) {
    song.audioUrl = `${new URL(song.audioUrl, 'http://local').pathname}?ticket=${mediaToken}`;
  }
  return sendSuccess(res, { audioUrl: song.audioUrl, youtubeId: song.youtubeId, youtubeUrl: song.youtubeUrl, sourceType: song.sourceType });
}));

export default router;
