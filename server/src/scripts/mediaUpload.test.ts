import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://proj.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_only';
process.env.SUPABASE_STORAGE_BUCKET = 'musicwave-media';

const { createMediaUploadUrl, importSingleSong } = await import('../controllers/admin.controller.js');
const { isOwnStorageUrl } = await import('../services/storage.js');

// Fake Supabase Storage: records requests, signs every upload unless told to fail.
let calls: { url: string; headers: any }[] = [];
let signFails = false;
globalThis.fetch = (async (url: string, init: any = {}) => {
  calls.push({ url: String(url), headers: init.headers || {} });
  if (String(url).includes('/object/upload/sign/')) {
    if (signFails) return new Response('nope', { status: 403 });
    const path = String(url).split('/object/upload/sign/')[1];
    return Response.json({ url: `/object/upload/sign/${path}?token=abc` });
  }
  return Response.json({});
}) as any;

const call = (handler: any, body: any, files?: any): Promise<any> => new Promise((resolve, reject) => {
  const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; },
    json(b: any) { resolve({ status: this.statusCode, body: b }); return this; } };
  Promise.resolve(handler({ user: { userId: 'admin', role: 'ADMIN' }, body, files }, res)).catch(reject);
});

test('signed upload URL for a big MP3 bypasses the server body limit', async () => {
  calls = []; signFails = false;
  const res = await call(createMediaUploadUrl, { kind: 'audio', fileName: 'Hngle - Tìm em.mp3', contentType: 'audio/mpeg', title: 'Tìm em', artistName: 'HNGLE' });
  assert.equal(res.status, 200);
  const { uploadUrl, publicUrl } = res.body.data;
  assert.match(uploadUrl, /^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/upload\/sign\/musicwave-media\/music\/hngle\/single\/tim-em-\d+\.mp3\?token=abc$/);
  assert.ok(isOwnStorageUrl(publicUrl));
  const sign = calls.find((c) => c.url.includes('/upload/sign/'))!;
  assert.equal(sign.headers.apikey, 'sb_secret_test_only');
  assert.equal(sign.headers.authorization, undefined, 'new secret keys must not be sent as a Bearer token');
});

test('upload URLs are refused for disallowed or mismatched files', async () => {
  for (const body of [
    { kind: 'audio', fileName: 'virus.exe', contentType: 'application/octet-stream' },
    { kind: 'audio', fileName: 'cover.jpg', contentType: 'image/jpeg' },
    { kind: 'cover', fileName: 'song.mp3', contentType: 'audio/mpeg' },
    { kind: 'audio', fileName: 'song.mp3', contentType: 'text/html' },
    { kind: 'video', fileName: 'a.mp4' },
  ]) {
    assert.equal((await call(createMediaUploadUrl, body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await call(createMediaUploadUrl, { kind: 'cover', fileName: 'a.png', contentType: 'image/png' })).status, 200);
});

test('storage refusing to sign reports 503 so small files can fall back to the server', async () => {
  signFails = true;
  assert.equal((await call(createMediaUploadUrl, { kind: 'audio', fileName: 'a.mp3', contentType: 'audio/mpeg' })).status, 503);
  signFails = false;
});

test('an unreachable storage host answers 503 instead of hanging the request', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as any;
  try {
    assert.equal((await call(createMediaUploadUrl, { kind: 'audio', fileName: 'a.mp3', contentType: 'audio/mpeg' })).status, 503);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('import only accepts audio/cover URLs from our own bucket', async () => {
  assert.equal((await call(importSingleSong, { title: 'x', artistName: 'y', audioUrl: 'https://evil.test/a.mp3' })).status, 400);
  assert.equal((await call(importSingleSong, { title: 'x', artistName: 'y',
    audioUrl: 'https://proj.supabase.co/storage/v1/object/public/musicwave-media/music/a.mp3', coverUrl: 'javascript:alert(1)' })).status, 400);
  assert.equal(isOwnStorageUrl('https://proj.supabase.co/storage/v1/object/public/musicwave-media/../other/a.mp3'), false);
});
