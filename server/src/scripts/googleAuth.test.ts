import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../services/prisma.js';
import { checkedIdentity, googleLoginUrl, signInGoogle, linkGoogleAccount } from '../services/googleAuth.js';
import { hashPassword, verifyToken } from '../utils/auth.js';

test('Google authorization requests use PKCE, state, nonce and only basic identity scopes', () => {
  process.env.GOOGLE_CLIENT_ID = 'test.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-only-secret';
  process.env.GOOGLE_REDIRECT_URI = 'https://musicwave-app.vercel.app/auth/google/callback';
  const url = new URL(googleLoginUrl('challenge', 'state', 'nonce'));
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('redirect_uri'), process.env.GOOGLE_REDIRECT_URI);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), 'state');
  assert.equal(url.searchParams.get('nonce'), 'nonce');
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
  assert.equal(url.toString().includes('test-only-secret'), false);
});

test('identity validation rejects unverified email or missing provider ID', () => {
  assert.throws(() => checkedIdentity({ sub: 'g', email: 'a@example.com', email_verified: false }));
  assert.throws(() => checkedIdentity({ email: 'a@example.com', email_verified: true }));
  assert.equal(checkedIdentity({ sub: 'g', email: 'A@Example.com', email_verified: true }).email, 'a@example.com');
});

test('stable Google IDs preserve profiles; existing emails require password linking; blocked users cannot sign in', async () => {
  const db = prisma as any;
  const originals = Object.fromEntries(['findUnique', 'findFirst', 'create', 'updateMany', 'findUniqueOrThrow'].map(k => [k, db.user[k]]));
  const identity = checkedIdentity({ sub: 'google-1', email: 'a@example.com', email_verified: true });
  let user: any = { id: 'self', username: 'existing', email: 'a@example.com', role: 'ADMIN',
    isBlocked: false, avatarUrl: null, bio: null, createdAt: new Date(), googleSubject: null,
    passwordHash: await hashPassword('Password123!') };
  let hasExisting = true;
  db.user.findUnique = async ({ where }: any) => where.id === user.id || where.googleSubject === user.googleSubject ? user : null;
  db.user.findFirst = async () => hasExisting ? user : null;
  db.user.findUniqueOrThrow = async () => user;
  db.user.updateMany = async ({ data }: any) => { Object.assign(user, data); return { count: 1 }; };
  db.user.create = async ({ data }: any) => { user = { ...user, ...data }; return user; };
  try {
    const pending = await signInGoogle(identity);
    assert.ok('requiresLink' in pending);
    if (!('linkTicket' in pending)) throw new Error('Expected link ticket');
    assert.throws(() => verifyToken(pending.linkTicket));
    await assert.rejects(linkGoogleAccount(pending.linkTicket, 'wrong'), /Mật khẩu/);
    assert.equal(user.googleSubject, null);
    const linked = await linkGoogleAccount(pending.linkTicket, 'Password123!');
    assert.equal(linked.user.role, 'ADMIN');
    assert.equal(verifyToken(linked.token).userId, 'self');
    await assert.rejects(linkGoogleAccount(pending.linkTicket, 'Password123!'));
    user.email = 'edited@example.com';
    const returning = await signInGoogle(identity);
    assert.ok('user' in returning);
    if ('user' in returning) assert.equal(returning.user.email, 'edited@example.com');
    user.isBlocked = true;
    await assert.rejects(signInGoogle(identity), /khóa/);
    user.isBlocked = false; user.googleSubject = null; hasExisting = false;
    const created = await signInGoogle(identity);
    assert.ok('user' in created);
    if ('user' in created) {
      assert.equal(created.user.role, 'USER');
      assert.equal('passwordHash' in created.user, false);
    }
  } finally { Object.assign(db.user, originals); }
});
