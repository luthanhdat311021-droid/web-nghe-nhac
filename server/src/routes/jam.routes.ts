import { Router, Response } from 'express';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';

// Listening rooms ("Jam"). Clients poll GET /:code every ~2s; the host pushes its player state with PUT /:code/state.
// Vercel functions cannot hold WebSockets, so polling plus server timestamps keeps members in sync.

const router = Router();
const wrap = (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthenticatedRequest, res: Response, next: any) => { Promise.resolve(fn(req, res)).catch(next); };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid misreads
export const MEMBER_TIMEOUT_MS = 20_000;
export const HOST_TIMEOUT_MS = 120_000;
const MAX_PENDING = 50;
// Animated Noto emoji codepoints the chat may send as stickers (rendered from fonts.gstatic.com by the client).
export const JAM_STICKERS = [
  '1f600', '1f602', '1f923', '1f60d', '1f970', '1f618', '1f973', '1f60e', '1f929', '1f62d', '1f97a', '1f631',
  '1f621', '1f634', '1f914', '1f92f', '1f525', '2764_fe0f', '1f494', '1f44f', '1f64c', '1f44d', '1f389', '1f3b6',
  '1f483', '1f4af', '2728', '1f308', '1f680',
];
const userSelect = { select: { id: true, username: true, avatarUrl: true } };
const songInclude = { artist: { select: { id: true, name: true } }, album: { select: { id: true, title: true } } };

const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const normalizeCode = (code: string) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

/** Load an open room, closing it if the host has gone silent. */
const openRoom = async (code: string) => {
  const room = await prisma.jamRoom.findUnique({ where: { code: normalizeCode(code) } });
  if (!room || room.endedAt) return null;
  const host = await prisma.jamMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId: room.hostId } } });
  if (!host || Date.now() - host.lastSeenAt.getTime() > HOST_TIMEOUT_MS) {
    await prisma.jamRoom.update({ where: { id: room.id }, data: { endedAt: new Date(), isPlaying: false } });
    return null;
  }
  return room;
};

router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

router.post('/', requireAuth, wrap(async (req, res) => {
  const userId = req.user!.userId;
  // One open room per host: starting a new one closes the previous.
  await prisma.jamRoom.updateMany({ where: { hostId: userId, endedAt: null }, data: { endedAt: new Date(), isPlaying: false } });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const room = await prisma.jamRoom.create({
        data: { code: newCode(), hostId: userId, members: { create: { userId } } },
      });
      return sendSuccess(res, { code: room.code }, 'Đã tạo phòng nghe chung.', 201);
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error; // code collision: try another
    }
  }
  return sendError(res, 'Không tạo được phòng. Vui lòng thử lại.', 500);
}));

router.get('/:code', requireAuth, wrap(async (req, res) => {
  const userId = req.user!.userId;
  const room = await openRoom(req.params.code);
  if (!room) return sendSuccess(res, { ended: true });
  const now = new Date();
  await prisma.jamMember.upsert({
    where: { roomId_userId: { roomId: room.id, userId } },
    create: { roomId: room.id, userId },
    update: { lastSeenAt: now },
  });
  const isHost = room.hostId === userId;
  const since = req.query.since ? new Date(String(req.query.since)) : null;
  const [song, members, messages] = await Promise.all([
    room.songId ? prisma.song.findUnique({ where: { id: room.songId }, include: songInclude }) : null,
    prisma.jamMember.findMany({
      where: { roomId: room.id, lastSeenAt: { gte: new Date(now.getTime() - MEMBER_TIMEOUT_MS) } },
      include: { user: userSelect },
      orderBy: { joinedAt: 'asc' },
    }),
    prisma.jamMessage.findMany({
      where: { roomId: room.id, ...(since && !isNaN(since.getTime()) ? { createdAt: { gt: since } } : {}) },
      include: { user: userSelect },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);
  // Songs suggested by members are handed to the host's player exactly once.
  let pendingSongs: unknown[] = [];
  if (isHost && room.pendingSongIds.length) {
    const ids = room.pendingSongIds;
    await prisma.jamRoom.update({ where: { id: room.id }, data: { pendingSongIds: { set: [] } } });
    const found = await prisma.song.findMany({ where: { id: { in: ids } }, include: songInclude });
    pendingSongs = ids.map((id) => found.find((s) => s.id === id)).filter(Boolean);
  }
  return sendSuccess(res, {
    ended: false,
    code: room.code,
    hostId: room.hostId,
    isHost,
    song,
    positionSec: room.positionSec,
    isPlaying: room.isPlaying,
    stateAt: room.stateAt,
    serverNow: now,
    members: members.map((m) => ({ ...m.user, isHost: m.userId === room.hostId })),
    messages: messages.reverse(),
    pendingSongs,
  });
}));

const stateSchema = z.object({
  songId: z.string().min(1).max(64).nullable(),
  positionSec: z.number().finite().min(0).max(24 * 3600),
  isPlaying: z.boolean(),
});
router.put('/:code/state', requireAuth, wrap(async (req, res) => {
  const parsed = stateSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Trạng thái phát không hợp lệ.', 400);
  const room = await openRoom(req.params.code);
  if (!room) return sendError(res, 'Phòng nghe chung đã kết thúc.', 404);
  if (room.hostId !== req.user!.userId) return sendError(res, 'Chỉ chủ phòng mới điều khiển được nhạc.', 403);
  const { songId, positionSec, isPlaying } = parsed.data;
  if (songId && !await prisma.song.findUnique({ where: { id: songId }, select: { id: true } })) return sendError(res, 'Bài hát không tồn tại.', 404);
  const now = new Date();
  await prisma.$transaction([
    prisma.jamRoom.update({ where: { id: room.id }, data: { songId, positionSec, isPlaying, stateAt: now } }),
    prisma.jamMember.update({ where: { roomId_userId: { roomId: room.id, userId: room.hostId } }, data: { lastSeenAt: now } }),
  ]);
  return sendSuccess(res, { stateAt: now });
}));

router.post('/:code/queue', requireAuth, wrap(async (req, res) => {
  const songId = z.string().min(1).max(64).safeParse(req.body?.songId);
  if (!songId.success) return sendError(res, 'Bài hát không hợp lệ.', 400);
  const room = await openRoom(req.params.code);
  if (!room) return sendError(res, 'Phòng nghe chung đã kết thúc.', 404);
  const userId = req.user!.userId;
  if (!await prisma.jamMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId } } })) return sendError(res, 'Bạn chưa vào phòng này.', 403);
  const song = await prisma.song.findUnique({ where: { id: songId.data }, select: { id: true, title: true } });
  if (!song) return sendError(res, 'Bài hát không tồn tại.', 404);
  if (room.pendingSongIds.length >= MAX_PENDING) return sendError(res, 'Hàng chờ của phòng đang đầy.', 429);
  await prisma.$transaction([
    prisma.jamRoom.update({ where: { id: room.id }, data: { pendingSongIds: { push: song.id } } }),
    prisma.jamMessage.create({ data: { roomId: room.id, userId, kind: 'queue', text: song.title } }),
  ]);
  return sendSuccess(res, null, `Đã thêm "${song.title}" vào hàng chờ của phòng.`);
}));

router.post('/:code/messages', requireAuth, wrap(async (req, res) => {
  let data: { kind: string; text: string };
  if (req.body?.sticker !== undefined) {
    if (!JAM_STICKERS.includes(req.body.sticker)) return sendError(res, 'Nhãn dán không hợp lệ.', 400);
    data = { kind: 'sticker', text: req.body.sticker };
  } else {
    const text = z.string().trim().min(1, 'Tin nhắn trống.').max(300, 'Tin nhắn tối đa 300 ký tự.').safeParse(req.body?.text);
    if (!text.success) return sendError(res, text.error.errors[0]?.message || 'Tin nhắn không hợp lệ.', 400);
    data = { kind: 'chat', text: text.data };
  }
  const room = await openRoom(req.params.code);
  if (!room) return sendError(res, 'Phòng nghe chung đã kết thúc.', 404);
  const userId = req.user!.userId;
  if (!await prisma.jamMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId } } })) return sendError(res, 'Bạn chưa vào phòng này.', 403);
  const message = await prisma.jamMessage.create({ data: { roomId: room.id, userId, ...data }, include: { user: userSelect } });
  return sendSuccess(res, message);
}));

router.post('/:code/leave', requireAuth, wrap(async (req, res) => {
  const room = await prisma.jamRoom.findUnique({ where: { code: normalizeCode(req.params.code) } });
  if (!room) return sendSuccess(res, null);
  const userId = req.user!.userId;
  if (room.hostId === userId) {
    await prisma.jamRoom.update({ where: { id: room.id }, data: { endedAt: room.endedAt || new Date(), isPlaying: false } });
  } else {
    await prisma.jamMember.deleteMany({ where: { roomId: room.id, userId } });
  }
  return sendSuccess(res, null, room.hostId === userId ? 'Đã đóng phòng.' : 'Đã rời phòng.');
}));

export default router;
