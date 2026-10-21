import test from 'node:test';
import assert from 'node:assert/strict';
import router from '../routes/musicPro.routes.js';
import { prisma } from '../services/prisma.js';
import { extendPro, isPro, paymentCode, vietnamDay } from '../services/musicPolicy.js';
import { hidePlaybackSources } from '../middleware/playbackAccess.js';
import { requireAdmin } from '../middleware/admin.js';

// In-memory delegates exercise actual handlers without opening a database connection.
const db = prisma as any;
let user: any, order: any, sessions: Record<string, any>, usage: any, writes: number;
function reset() {
  user = { id: 'user', proExpiresAt: null, isBlocked: false };
  order = { id: 'order', userId: 'user', code: 'MW' + 'A'.repeat(24), amount: 50000,
    status: 'PENDING', transactionId: null, createdAt: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() + 60000) };
  sessions = {}; usage = { count: 0 }; writes = 0;
  process.env.SEPAY_WEBHOOK_KEY = 'test-secret-only';
  process.env.SEPAY_ACCOUNT_NUMBER = '0819883208'; process.env.SEPAY_BANK = 'MBBank';
}
db.$transaction = async (fn: any) => fn(db);
db.$queryRaw = async () => [];
db.user.findUniqueOrThrow = async () => user;
db.user.update = async ({ data }: any) => { Object.assign(user, data); writes++; return user; };
db.paymentOrder.findUnique = async ({ where }: any) => where.transactionId ? (where.transactionId === order.transactionId ? order : null) : order;
db.paymentOrder.findUniqueOrThrow = async () => order;
db.paymentOrder.findFirst = async ({ where }: any) => where.userId === order.userId ? order : null;
db.paymentOrder.update = async ({ data }: any) => Object.assign(order, data);
db.dailyUsage.findUnique = async () => usage;
db.dailyUsage.upsert = async () => usage;
db.dailyUsage.update = async () => { usage.count++; return usage; };
db.song.findUnique = async () => ({ id: 'song', audioUrl: 'https://example.com/audio.mp3', sourceType: 'url' });
db.song.update = async () => ({});
db.recentlyPlayed.create = async () => ({});
db.playbackSession.create = async ({ data }: any) => { const id = `session-${Object.keys(sessions).length}`; return sessions[id] = { id, ...data }; };
db.playbackSession.findUnique = async ({ where }: any) => sessions[where.id];
db.playbackSession.update = async ({ where, data }: any) => Object.assign(sessions[where.id], data);
function invoke(path: string, method = 'post', overrides: any = {}): Promise<any> {
  const route = (router as any).stack.find((s: any) => s.route?.path === path && s.route.methods[method]).route;
  const handler = route.stack.at(-1).handle;
  return new Promise((resolve, reject) => {
    const res: any = { statusCode: 200, locals: {}, status(code: number) { this.statusCode = code; return this; },
      json(body: any) { resolve({ status: this.statusCode, body }); return this; } };
    handler({ user: { userId: 'user' }, params: {}, headers: {}, body: {}, ...overrides }, res, reject);
  });
}
const event = (changes = {}) => ({ id: 123, gateway: 'MBBank', accountNumber: '0819883208',
  transferType: 'in', transferAmount: 50000, content: order.code,
  transactionDate: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' '), ...changes });
const webhook = (changes = {}, authorization = 'Apikey test-secret-only') => invoke('/sepay/webhook', 'post', { headers: { authorization }, body: event(changes) });

test('Vietnam day changes exactly at UTC 17:00 and Pro expiry is exclusive', () => {
  assert.equal(vietnamDay(new Date('2026-10-21T16:59:59Z')), '2026-10-21');
  assert.equal(vietnamDay(new Date('2026-10-21T17:00:00Z')), '2026-10-22');
  const now = new Date('2026-10-21T00:00:00Z');
  assert.equal(isPro(now, now), false);
  assert.equal(extendPro(null, now).toISOString(), '2026-11-20T00:00:00.000Z');
  assert.equal(extendPro(new Date('2026-11-01'), now).toISOString(), '2026-12-01T00:00:00.000Z');
});
test('only exact payment codes and no source leaks or cache mutation', () => {
  const code = 'MW' + 'A'.repeat(24);
  assert.deepEqual(paymentCode(`transfer ${code} thanks`), [code]);
  assert.deepEqual(paymentCode(`${code}99`), []);
  const catalog = { items: [{ audioUrl: 'private', youtubeId: 'private', title: 'title' }] };
  assert.equal(hidePlaybackSources(catalog).items[0].audioUrl, '');
  assert.equal(catalog.items[0].audioUrl, 'private');
});
test('admin middleware rejects users before uploads', () => {
  let status = 0, next = false;
  requireAdmin({ user: { role: 'USER' } } as any, { status(code: number) { status = code; return this; }, json() {} } as any, () => { next = true; });
  assert.equal(status, 403); assert.equal(next, false);
});
test('webhook rejects missing/wrong secrets and mismatched transfers', async () => {
  reset(); assert.equal((await webhook({}, 'Apikey incorrect')).status, 401);
  for (const data of [{ transferAmount: 49999 }, { transferAmount: 50001 }, { accountNumber: 'other' }, { gateway: 'other' },
    { transferType: 'out' }, { content: 'wrong memo' }, { content: order.code + '1' }, { transactionDate: '2020-01-01 10:00:00' }]) await webhook(data);
  assert.equal(writes, 0); assert.equal(order.status, 'PENDING');
});
test('valid payment grants 30 days once even on repeated delivery', async () => {
  reset(); const before = Date.now();
  assert.equal((await webhook()).body.success, true);
  await webhook(); assert.equal(writes, 1); assert.equal(order.status, 'PAID');
  assert.ok(user.proExpiresAt.getTime() >= before + 30 * 86400000);
});
test('orders are private to their owner', async () => {
  reset(); assert.equal((await invoke('/orders/:id', 'get', { user: { userId: 'other' }, params: { id: 'order' } })).status, 404);
});
test('free admission enforces ad delay, three starts, replay idempotency and ownership', async () => {
  reset();
  for (let i = 0; i < 3; i++) {
    const prep = await invoke('/playback/:songId/prepare', 'post', { params: { songId: 'song' } });
    assert.equal(prep.body.data.adSeconds, 10);
    const id = prep.body.data.sessionId;
    assert.equal((await invoke('/playback/:sessionId/start', 'post', { params: { sessionId: id } })).status, 403);
    sessions[id].readyAt = new Date(Date.now() - 1000);
    assert.equal((await invoke('/playback/:sessionId/start', 'post', { user: { userId: 'other' }, params: { sessionId: id } })).status, 403);
    assert.equal((await invoke('/playback/:sessionId/start', 'post', { params: { sessionId: id } })).status, 200);
    await invoke('/playback/:sessionId/start', 'post', { params: { sessionId: id } });
    assert.equal(usage.count, i + 1);
  }
  assert.equal((await invoke('/playback/:songId/prepare', 'post', { params: { songId: 'song' } })).status, 403);
});
test('pre-created sessions cannot bypass limit at start; Pro skips ads and usage', async () => {
  reset();
  for (let i = 0; i < 4; i++) await invoke('/playback/:songId/prepare', 'post', { params: { songId: 'song' } });
  for (let i = 0; i < 4; i++) {
    sessions[`session-${i}`].readyAt = new Date(Date.now() - 1000);
    assert.equal((await invoke('/playback/:sessionId/start', 'post', { params: { sessionId: `session-${i}` } })).status, i < 3 ? 200 : 403);
  }
  user.proExpiresAt = new Date(Date.now() + 86400000);
  const prep = await invoke('/playback/:songId/prepare', 'post', { params: { songId: 'song' } });
  assert.equal(prep.body.data.adSeconds, 0);
  assert.equal((await invoke('/playback/:sessionId/start', 'post', { params: { sessionId: prep.body.data.sessionId } })).status, 200);
  assert.equal(usage.count, 3);
});

test('Pro expiring after preparation requires a new ad-backed admission', async () => {
  reset(); user.proExpiresAt = new Date(Date.now() + 60000);
  const prep = await invoke('/playback/:songId/prepare', 'post', { params: { songId: 'song' } });
  user.proExpiresAt = new Date(Date.now() - 1);
  assert.equal((await invoke('/playback/:sessionId/start', 'post', { params: { sessionId: prep.body.data.sessionId } })).status, 403);
  assert.equal(usage.count, 0);
});
test('delayed webhook uses transfer time; late transfer cannot activate an expired order', async () => {
  reset();
  order.createdAt = new Date(Date.now() - 40 * 60000); order.expiresAt = new Date(Date.now() - 10 * 60000);
  await webhook(); assert.equal(writes, 0);
  await webhook({ transactionDate: vnTime(-20 * 60000) }); assert.equal(writes, 1);
});
const vnTime = (offsetMs: number) => new Date(Date.now() + offsetMs + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
test('bank time rounded to the minute before order creation still activates', async () => {
  reset(); order.createdAt = new Date(Date.now() - 10000);
  await webhook({ transactionDate: vnTime(-50000).slice(0, 16) + ':00' }); assert.equal(order.status, 'PAID');
});
test('payment code glued to bank-added text is recognised', async () => {
  reset(); await webhook({ content: `MBVCB.123.NGUYENVANA${order.code}TU 0123` }); assert.equal(order.status, 'PAID');
});
