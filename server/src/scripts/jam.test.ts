import test from 'node:test';
import assert from 'node:assert/strict';
import router, { HOST_TIMEOUT_MS, QUIZ_OPTIONS, QUIZ_ROUND_MS, quizPoints } from '../routes/jam.routes.js';
import { prisma } from '../services/prisma.js';

// In-memory delegates exercise actual handlers without opening a database connection.
const db = prisma as any;
let room: any, members: Record<string, any>, messages: any[];
const newMember = (userId: string) => ({ roomId: 'room', userId, joinedAt: new Date(), lastSeenAt: new Date(),
  quizScore: 0, quizAnsweredRound: 0, quizLastChoice: null, quizLastPoints: 0 });
const catalog = ['song', 's2', 's3', 's4', 's5'];
// Applies Prisma-style { increment } / { set } updates to a plain object.
const apply = (target: any, data: any) => {
  for (const [k, v] of Object.entries<any>(data)) {
    if (v && typeof v === 'object' && 'increment' in v) target[k] += v.increment;
    else if (v && typeof v === 'object' && 'set' in v) target[k] = v.set;
    else target[k] = v;
  }
  return target;
};
const matches = (m: any, where: any) =>
  (where.userId === undefined || (typeof where.userId === 'string' ? m.userId === where.userId : m.userId !== where.userId.not)) &&
  (where.quizAnsweredRound === undefined || (typeof where.quizAnsweredRound === 'number'
    ? m.quizAnsweredRound === where.quizAnsweredRound : m.quizAnsweredRound < where.quizAnsweredRound.lt)) &&
  (where.quizLastPoints === undefined || m.quizLastPoints > where.quizLastPoints.gt);
const reset = () => {
  room = { id: 'room', code: 'ABC234', hostId: 'host', songId: null, positionSec: 0, isPlaying: false,
    stateAt: new Date(), pendingSongIds: [], endedAt: null,
    quizRound: 0, quizSongId: null, quizOptionIds: [], quizEndsAt: null, quizRevealed: true };
  members = { host: newMember('host') };
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
db.jamRoom.updateMany = async ({ where, data }: any) => {
  if (where.quizRound !== room.quizRound || where.quizRevealed !== room.quizRevealed) return { count: 0 };
  apply(room, data);
  return { count: 1 };
};
db.jamMember.upsert = async ({ where, create, update }: any) =>
  (members[key(where)] = members[key(where)] ? { ...members[key(where)], ...update } : { ...newMember(create.userId), ...create });
db.jamMember.update = async ({ where, data }: any) => Object.assign(members[key(where)], data);
const withUser = (m: any) => ({ ...m, user: { id: m.userId, username: m.userId, avatarUrl: null } });
db.jamMember.findMany = async ({ where }: any) => Object.values(members).filter((m) => matches(m, where)).map(withUser);
db.jamMember.updateMany = async ({ where, data }: any) => {
  const hit = Object.values(members).filter((m) => matches(m, where));
  hit.forEach((m) => apply(m, data));
  return { count: hit.length };
};
db.jamMember.count = async ({ where }: any) => Object.values(members).filter((m) => matches(m, where)).length;
db.jamMember.deleteMany = async ({ where }: any) => { delete members[where.userId]; };
db.jamMessage.findMany = async () => [];
db.jamMessage.create = async ({ data }: any) => { messages.push(data); return { id: `m${messages.length}`, ...data }; };
db.user.findUnique = async ({ where }: any) => ({ username: where.id });
db.song.findUnique = async ({ where }: any) => (catalog.includes(where.id) ? { id: where.id, title: `Title ${where.id}`, artist: { name: 'A' } } : null);
db.song.findMany = async ({ where }: any) => (where ? catalog.filter((id) => where.id.in.includes(id)) : catalog)
  .map((id) => ({ id, title: id === 'song' ? 'Song' : `Title ${id}`, artist: { name: 'A' } }));
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

test('quiz: only the host starts rounds; guests see options but not the answer', async () => {
  reset();
  await invoke('/:code', 'get', 'guest');
  assert.equal((await invoke('/:code/quiz/start', 'post', 'guest')).status, 403);
  const started = await invoke('/:code/quiz/start', 'post', 'host');
  assert.equal(started.status, 200);
  assert.equal(started.body.data.song.id, room.quizSongId, 'host gets the song to play');
  assert.equal(room.quizOptionIds.length, QUIZ_OPTIONS);
  assert.ok(room.quizOptionIds.includes(room.quizSongId));
  assert.equal(new Set(room.quizOptionIds).size, QUIZ_OPTIONS, 'no duplicate options');
  const guestQuiz = (await invoke('/:code', 'get', 'guest')).body.data.quiz;
  assert.equal(guestQuiz.active, true);
  assert.equal(guestQuiz.options.length, QUIZ_OPTIONS);
  assert.equal(guestQuiz.correctId, null, 'guests must not receive the answer');
  assert.equal((await invoke('/:code', 'get', 'host')).body.data.quiz.correctId, room.quizSongId);
});

test('quiz: one answer per round, faster correct answers score more, round reveals when all answered', async () => {
  reset();
  await invoke('/:code', 'get', 'a');
  await invoke('/:code', 'get', 'b');
  await invoke('/:code/quiz/start', 'post', 'host');
  const wrong = room.quizOptionIds.find((id: string) => id !== room.quizSongId);
  assert.equal((await invoke('/:code/quiz/answer', 'post', 'host', { body: { songId: room.quizSongId } })).status, 403);
  assert.equal((await invoke('/:code/quiz/answer', 'post', 'a', { body: { songId: 'not-an-option' } })).status, 400);
  const right = await invoke('/:code/quiz/answer', 'post', 'a', { body: { songId: room.quizSongId } });
  assert.deepEqual([right.status, right.body.data.correct], [200, true]);
  assert.ok(members.a.quizScore >= 50);
  assert.equal((await invoke('/:code/quiz/answer', 'post', 'a', { body: { songId: wrong } })).status, 409, 'second answer refused');
  assert.equal(room.quizRevealed, false, 'b has not answered yet');
  const miss = await invoke('/:code/quiz/answer', 'post', 'b', { body: { songId: wrong } });
  assert.deepEqual([miss.body.data.correct, members.b.quizScore], [false, 0]);
  assert.equal(room.quizRevealed, true, 'everyone answered, round closes');
  assert.match(messages.at(-1).text, /^Đáp án vòng 1: .*Đoán đúng: a \(\+\d+\)/);
  assert.equal((await invoke('/:code', 'get', 'b')).body.data.quiz.correctId, room.quizSongId, 'answer shown after reveal');
  assert.ok(quizPoints(QUIZ_ROUND_MS) > quizPoints(QUIZ_ROUND_MS / 2) && quizPoints(1) >= 50);
});

test('quiz: expired rounds close on the next poll and reset clears scores', async () => {
  reset();
  await invoke('/:code', 'get', 'a');
  await invoke('/:code/quiz/start', 'post', 'host');
  room.quizEndsAt = new Date(Date.now() - 1);
  assert.equal((await invoke('/:code/quiz/answer', 'post', 'a', { body: { songId: room.quizSongId } })).status, 409);
  assert.equal(room.quizRevealed, true);
  assert.equal(messages.filter((m) => m.text.startsWith('Đáp án')).length, 1);
  await invoke('/:code', 'get', 'a');
  assert.equal(messages.filter((m) => m.text.startsWith('Đáp án')).length, 1, 'revealed only once');
  members.a.quizScore = 120;
  assert.equal((await invoke('/:code/quiz/reset', 'post', 'a')).status, 403);
  await invoke('/:code/quiz/reset', 'post', 'host');
  assert.deepEqual([members.a.quizScore, room.quizRound], [0, 0]);
  assert.equal((await invoke('/:code', 'get', 'a')).body.data.quiz, null);
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
