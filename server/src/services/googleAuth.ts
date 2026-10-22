import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { z } from 'zod';
import { config } from '../config/index.js';
import { prisma } from './prisma.js';
import { comparePassword, generateToken, hashPassword } from '../utils/auth.js';
import { invalidateUserAuthCache } from '../middleware/auth.js';

export class GoogleAuthError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function settings() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) throw new GoogleAuthError('Đăng nhập Google chưa được cấu hình trên máy chủ.', 503);
  return { clientId, clientSecret, redirectUri };
}

export function googleLoginUrl(challenge: string, state: string, nonce: string) {
  const { clientId, clientSecret, redirectUri } = settings();
  return new OAuth2Client(clientId, clientSecret, redirectUri).generateAuthUrl({
    scope: ['openid', 'email', 'profile'], response_type: 'code',
    prompt: 'select_account', state, nonce,
    code_challenge: challenge, code_challenge_method: CodeChallengeMethod.S256,
  });
}

export interface GoogleIdentity { sub: string; email: string; email_verified: true; picture?: string }
export function checkedIdentity(payload: unknown): GoogleIdentity {
  return z.object({ sub: z.string().min(1).max(255), email: z.string().email().max(100).transform(s => s.toLowerCase()),
    email_verified: z.literal(true), picture: z.string().url().optional() }).parse(payload) as GoogleIdentity;
}

export async function exchangeGoogleCode(code: string, verifier: string, nonce: string) {
  const { clientId, clientSecret, redirectUri } = settings();
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  const { tokens } = await client.getToken({ code, codeVerifier: verifier, redirect_uri: redirectUri });
  if (!tokens.id_token) throw new GoogleAuthError('Google không trả về thông tin đăng nhập hợp lệ.', 401);
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload || (payload as any).nonce !== nonce) throw new GoogleAuthError('Phiên đăng nhập Google không hợp lệ. Vui lòng thử lại.', 401);
  return checkedIdentity(payload);
}

function session(user: { id: string; email: string; username: string; role: string; isBlocked: boolean; avatarUrl: string | null; bio: string | null; createdAt: Date }) {
  if (user.isBlocked) throw new GoogleAuthError('Tài khoản đã bị khóa.', 403);
  const { id, email, username, role, avatarUrl, bio, createdAt } = user;
  invalidateUserAuthCache(id);
  return { user: { id, email, username, role, avatarUrl, bio, createdAt },
    token: generateToken({ userId: id, email, username, role }) };
}

export async function signInGoogle(identity: GoogleIdentity) {
  const linked = await prisma.user.findUnique({ where: { googleSubject: identity.sub } });
  // Stable provider ID survives edits to the MusicWave profile email.
  if (linked) return session(linked);
  const existing = await prisma.user.findFirst({ where: { email: { equals: identity.email, mode: 'insensitive' } } });
  if (existing) {
    if (existing.isBlocked) throw new GoogleAuthError('Tài khoản đã bị khóa.', 403);
    if (existing.googleSubject) throw new GoogleAuthError('Email này đã liên kết với một tài khoản Google khác.', 409);
    // Local emails were not verified at registration. Never merge solely by email.
    const linkTicket = jwt.sign({ purpose: 'google-link', userId: existing.id, email: existing.email, sub: identity.sub },
      config.jwt.secret, { expiresIn: '5m', audience: 'musicwave-google-link' });
    return { requiresLink: true as const, linkTicket };
  }
  const user = await prisma.user.create({ data: {
    username: `google_${crypto.randomBytes(10).toString('hex')}`, email: identity.email,
    googleSubject: identity.sub, passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex')),
    avatarUrl: identity.picture || null, role: 'USER',
  } });
  return session(user);
}

export async function linkGoogleAccount(ticket: string, password: string) {
  let claim: { purpose: string; userId: string; email: string; sub: string };
  try {
    claim = z.object({ purpose: z.literal('google-link'), userId: z.string(), email: z.string(), sub: z.string() })
      .parse(jwt.verify(ticket, config.jwt.secret, { audience: 'musicwave-google-link', algorithms: ['HS256'] })) as typeof claim;
  } catch { throw new GoogleAuthError('Yêu cầu liên kết đã hết hạn. Vui lòng đăng nhập Google lại.', 401); }
  const user = await prisma.user.findUnique({ where: { id: claim.userId } });
  if (!user || user.email !== claim.email || user.googleSubject || !await comparePassword(password, user.passwordHash)) {
    throw new GoogleAuthError('Mật khẩu không đúng hoặc tài khoản đã thay đổi.', 401);
  }
  if (user.isBlocked) throw new GoogleAuthError('Tài khoản đã bị khóa.', 403);
  const updated = await prisma.user.updateMany({
    where: { id: user.id, googleSubject: null, email: claim.email, passwordHash: user.passwordHash, isBlocked: false },
    data: { googleSubject: claim.sub },
  });
  if (updated.count !== 1) throw new GoogleAuthError('Tài khoản đã thay đổi. Vui lòng đăng nhập lại.', 409);
  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return session(fresh);
}
