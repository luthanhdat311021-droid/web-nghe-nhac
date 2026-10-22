import test from 'node:test';
import assert from 'node:assert/strict';
import router from '../routes/rating.routes.js';
import { prisma } from '../services/prisma.js';

// In-memory delegates exercise actual handlers without opening a database connection.
const db = prisma as any;
let user: any, ratings: any[];
const reset = (proExpiresAt: Date | null) => { user = { id: 'user', proExpiresAt }; ratings = []; };
db.user.findUniqueOrThrow = async () => user;
db.user.findUnique = async () => user;
db.song.findUnique = async ({ where }: any) => where.id === 'song' ? { id: 'song' } : null;
db.songRating.upsert = async ({ where, create, update }: any) => {
  const found = ratings.find(r => r.userId === where.userId_songId.userId && r.songId === where.userId_songId.songId);
  if (found) return Object.assign(found, update);
  ratings.push({ id: `r${ratings.length}`, ...create }); return ratings.at(-1);
};
db.songRating.deleteMany = async ({ where }: any) => { ratings = ratings.filter(r => !(r.userId === where.userId && r.songId === where.songId)); };
function invoke(method: string, overrides: any = {}): Promise<any> {
  const route = (router as any).stack.find((s: any) => s.route?.methods[method]).route;
  const handler = route.stack.at(-1).handle;
  return new Promise((resolve, reject) => {
    const res: any = { statusCode: 200, setHeader() {}, status(code: number) { this.statusCode = code; return this; },
      json(body: any) { resolve({ status: this.statusCode, body }); return this; } };
    handler({ user: { userId: 'user' }, params: { id: 'song' }, headers: {}, body: {}, ...overrides }, res, reject);
  });
}

test('free accounts cannot rate', async () => {
  reset(null);
  assert.equal((await invoke('put', { body: { rating: 5 } })).status, 403);
  reset(new Date(Date.now() - 1000));
  assert.equal((await invoke('put', { body: { rating: 5 } })).status, 403);
  assert.equal(ratings.length, 0);
});
test('Pro accounts rate once per song and can update or delete', async () => {
  reset(new Date(Date.now() + 86400000));
  assert.equal((await invoke('put', { body: { rating: 4, comment: '  hay  ' } })).status, 200);
  assert.equal((await invoke('put', { body: { rating: 2 } })).status, 200);
  assert.equal(ratings.length, 1); assert.equal(ratings[0].rating, 2); assert.equal(ratings[0].comment, null);
  await invoke('delete'); assert.equal(ratings.length, 0);
});
test('invalid ratings and unknown songs are rejected', async () => {
  reset(new Date(Date.now() + 86400000));
  for (const body of [{ rating: 0 }, { rating: 6 }, { rating: 3.5 }, { rating: '5' }, { rating: 5, comment: 'x'.repeat(501) }]) {
    assert.equal((await invoke('put', { body })).status, 400);
  }
  assert.equal((await invoke('put', { params: { id: 'missing' }, body: { rating: 5 } })).status, 404);
  assert.equal(ratings.length, 0);
});
