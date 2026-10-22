import test from 'node:test';
import assert from 'node:assert/strict';
import router, { HOST_TIMEOUT_MS } from '../routes/jam.routes.js';
import { prisma } from '../services/prisma.js';

// In-memory delegates exercise actual handlers without opening a database connection.
const db = prisma as any;
let room: any, members: Record<string, any>, messages: any[];
const reset = () => {
  room = { id: 'room', code: 'ABC234', hostId: 'host', songId: null, positionSec: 0, isPlaying: false,
    stateAt: new Date(), pendingSongIds: [], endedAt: null };
  members = { host: { roomId: 'room', userId: 'host', joinedAt: new Date(), lastSeenAt: new Date() } };
  messages = [];
};
const key = (where: any) => where.roomId_userId.userId;
db.jamRoom.findUnique = async ({ where }: any) => (where.code === room.code ? room : null);
db.jamRoom.update = async ({ data }: any) => {
  for (const [k, v] of Object.entries<any>(data)) {
    if (v && typeof v === 'object' && 'push' in v) room[k] = [...room[k], v.push];
    else if (v && typeof v === 'object' && 'set' in v) room[k] = v.set;
    else room[k] = v;
  }
  return room;
};
db.jamMember.findUnique = async ({ where }: any) => members[key(where)] || null;
db.jamMember.upsert = async ({ where, create, update }: any) =>
  (members[key(where)] = members[key(where)] ? { ...members[key(where)], ...update } : { ...create, joinedAt: new Date(), lastSeenAt: new Date() });
db.jamMember.update = async ({ where, data }: any) => Object.assign(members[key(where)], data);
db.jamMember.findMany = async () => Object.values(members).map((m: any) => ({ ...m, user: { id: m.userId, username: m.userId, avatarUrl: null } }));
db.jamMember.deleteMany = async ({ where }: any) => { delete members[where.userId]; };
db.jamMessage.findMany = async () => [];
db.jamMessage.create = async ({ data }: any) => { messages.push(data); return { id: `m${messages.length}`, ...data }; };
db.song.findUnique = async ({ where }: any) => (where.id === 'song' ? { id: 'song', title: 'Song' } : null);
db.song.findMany = async ({ where }: any) => where.id.in.filter((id: string) => id === 'song').map((id: string) => ({ id, title: 'Song' }));
db.$transaction = async (ops: any) => (Array.isArray(ops) ? Promise.all(ops) : ops(db));

function invoke(path: string, method: string, userId: string, overrides: any = {}): Promise<any> {
  const route = (router as any).stack.find((s: any) => s.route?.path === path && s.route.methods[method]).route;
  const handler = route.stack.at(-1).handle;
  return new Promise((resolve, reject) => {
    const res: any = { statusCode: 200, setHeader() {}, status(code: number) { this.statusCode = code; return this; },
      json(body: any) { resolve({ status: this.statusCode, body }); return this; } };
    handler({ user: { userId }, params: { code: 'abc234' }, query: {}, headers: {}, body: {}, ...overrides }, res, reject);
  });
}

test('only the host can change what the room plays', async () => {
  reset();
  const body = { songId: 'song', positionSec: 42, isPlaying: true };
  assert.equal((await invoke('/:code/state', 'put', 'guest', { body })).status, 403);
  assert.equal(room.songId, null);
  assert.equal((await invoke('/:code/state', 'put', 'host', { body })).status, 200);
  assert.equal(room.songId, 'song'); assert.equal(room.positionSec, 42); assert.equal(room.isPlaying, true);
  assert.equal((await invoke('/:code/state', 'put', 'host', { body: { ...body, songId: 'missing' } })).status, 404);
  assert.equal((await invoke('/:code/state', 'put', 'host', { body: { ...body, positionSec: -1 } })).status, 400);
});

test('polling joins the room and suggested songs reach the host exactly once', async () => {
  reset();
  assert.equal((await invoke('/:code/queue', 'post', 'guest', { body: { songId: 'song' } })).status, 403);
  const guestView = await invoke('/:code', 'get', 'guest');
  assert.equal(guestView.body.data.isHost, false);
  assert.ok(members.guest, 'guest became a member by polling');
  assert.equal((await invoke('/:code/queue', 'post', 'guest', { body: { songId: 'song' } })).status, 200);
  assert.deepEqual(room.pendingSongIds, ['song']);
  assert.equal(messages.at(-1).kind, 'queue');
  assert.deepEqual((await invoke('/:code', 'get', 'guest')).body.data.pendingSongs, [], 'guests never claim the queue');
  assert.equal((await invoke('/:code', 'get', 'host')).body.data.pendingSongs.length, 1);
  assert.equal((await invoke('/:code', 'get', 'host')).body.data.pendingSongs.length, 0);
});

test('chat messages are validated and only members may post', async () => {
  reset();
  assert.equal((await invoke('/:code/messages', 'post', 'stranger', { body: { text: 'hi' } })).status, 403);
  assert.equal((await invoke('/:code/messages', 'post', 'host', { body: { text: '   ' } })).status, 400);
  assert.equal((await invoke('/:code/messages', 'post', 'host', { body: { text: 'x'.repeat(301) } })).status, 400);
  assert.equal((await invoke('/:code/messages', 'post', 'host', { body: { text: ' xin chào ' } })).status, 200);
  assert.equal(messages.at(-1).text, 'xin chào');
  assert.equal((await invoke('/:code/messages', 'post', 'host', { body: { sticker: '1f973' } })).status, 200);
  assert.deepEqual([messages.at(-1).kind, messages.at(-1).text], ['sticker', '1f973']);
  for (const sticker of ['../evil', 'https://x.test/a.png', '', 42]) {
    assert.equal((await invoke('/:code/messages', 'post', 'host', { body: { sticker } })).status, 400);
  }
  assert.equal((await invoke('/:code/messages', 'post', 'stranger', { body: { sticker: '1f973' } })).status, 403);
});

test('a silent host or a host leaving ends the room', async () => {
  reset();
  members.host.lastSeenAt = new Date(Date.now() - HOST_TIMEOUT_MS - 1000);
  assert.equal((await invoke('/:code', 'get', 'guest')).body.data.ended, true);
  assert.ok(room.endedAt);
  reset();
  await invoke('/:code', 'get', 'guest');
  await invoke('/:code/leave', 'post', 'guest');
  assert.equal(room.endedAt, null, 'a guest leaving keeps the room open');
  await invoke('/:code/leave', 'post', 'host');
  assert.ok(room.endedAt);
  assert.equal((await invoke('/:code/state', 'put', 'host', { body: { songId: null, positionSec: 0, isPlaying: false } })).status, 404);
});
