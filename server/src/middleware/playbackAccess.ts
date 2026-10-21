import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../services/prisma.js';

export const requireMediaTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticket = jwt.verify(String(req.query.ticket || ''), config.jwt.secret) as any;
    if (ticket.purpose !== 'MEDIA') throw new Error('Wrong token purpose');
    const user = await prisma.user.findUnique({ where: { id: ticket.userId }, select: { isBlocked: true } });
    const song = await prisma.song.findUnique({ where: { id: ticket.songId }, select: { audioUrl: true } });
    if (!user || user.isBlocked || !song) throw new Error('Invalid ticket');
    if (req.params.id ? req.params.id !== ticket.songId : new URL(song.audioUrl, 'http://local').pathname !== `/uploads${req.path}`) throw new Error('Wrong resource');
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  } catch {
    res.status(403).json({ success: false, message: 'Playback authorization required.' });
  }
};

// Clone responses: never mutate objects held in the shared catalog cache.
export const hidePlaybackSources = (value: any): any => {
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(hidePlaybackSources);
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
    ['audioUrl', 'youtubeUrl', 'youtubeId'].includes(key) ? (key === 'audioUrl' ? '' : null) : hidePlaybackSources(child)]));
};
