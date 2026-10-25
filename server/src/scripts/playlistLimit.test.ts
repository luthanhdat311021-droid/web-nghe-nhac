import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaylist } from '../controllers/playlist.controller.js';
import { prisma } from '../services/prisma.js';
import { FREE_PLAYLIST_LIMIT } from '../services/musicPolicy.js';

// In-memory delegates exercise the real handler without opening a database connection.
const db = prisma as any;
let user: any, count: number, created: number;
db.$transaction = async (fn: any) => fn(db);
db.$queryRaw = async () => [];
db.user.findUniqueOrThrow = async () => user;
db.playlist.count = async () => count;
db.playlist.create = async ({ data }: any) => { created++; return { id: 'pl', ...data }; };
const create = (): Promise<any> => new Promise((resolve, reject) => {
  const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; },
    json(body: any) { resolve({ status: this.statusCode, body }); return this; } };
  createPlaylist({ user: { userId: 'user', role: 'USER' }, body: { title: 'Chill' } } as any, res).catch(reject);
});
const setup = (proExpiresAt: Date | null, role = 'USER', existing = FREE_PLAYLIST_LIMIT) => {
  user = { role, proExpiresAt }; count = existing; created = 0;
};

test('Free users are capped at the playlist limit', async () => {
  setup(null, 'USER', FREE_PLAYLIST_LIMIT - 1);
  assert.equal((await create()).status, 201);
  setup(null);
  const res = await create();
  assert.equal(res.status, 403);
  assert.equal(created, 0);
});

test('Pro and admin accounts create playlists without a limit', async () => {
  setup(new Date(Date.now() + 86400000), 'USER', 50);
  assert.equal((await create()).status, 201);
  setup(null, 'ADMIN', 50);
  assert.equal((await create()).status, 201);
});

test('expired Pro falls back to the Free limit', async () => {
  setup(new Date(Date.now() - 1000));
  assert.equal((await create()).status, 403);
});
