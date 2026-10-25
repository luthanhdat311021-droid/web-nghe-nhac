import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle, findLyrics, pickBest, splitArtists } from '../services/lyricsLookup.js';

const rec = (trackName: string, artistName: string, duration: number, synced = true) => ({
  trackName, artistName, duration, plainLyrics: 'la la', syncedLyrics: synced ? '[00:01.00] la la' : null,
});

test('YouTube-style titles and combined artists are cleaned before searching', () => {
  assert.equal(cleanTitle('Hngle - Tìm em ft. Bảo Anh | Official Music Video', 'HNGLE / hưng lê'), 'Tìm em');
  assert.equal(cleanTitle('Nàng Thơ (Official MV)', 'Hoàng Dũng'), 'Nàng Thơ');
  assert.equal(cleanTitle('See Tình - Hoàng Thùy Linh', 'Hoàng Thùy Linh'), 'See Tình');
  assert.equal(cleanTitle('Anh - Em', 'Someone'), 'Anh - Em', 'a dash inside a real title is kept');
  assert.deepEqual(splitArtists('HNGLE / hưng lê'), ['HNGLE', 'hưng lê']);
  assert.deepEqual(splitArtists('A ft. B & C'), ['A', 'B', 'C']);
});

test('the best match needs the same title, a shared artist and a close duration', () => {
  const records = [
    rec('Tìm Em', 'Hngle', 275, false),
    rec('Tìm Em', 'Hngle & Bảo Anh', 274),
    rec('Tìm em', 'Ho Quang Hieu', 270),
    rec('Tìm Em', 'Noo Phước Thịnh', 251),
  ];
  assert.equal(pickBest(records, 'Tìm em', 'HNGLE / hưng lê', 272)?.artistName, 'Hngle & Bảo Anh', 'synced version of the right artist');
  assert.equal(pickBest(records, 'Tìm em', 'Sơn Tùng', 251), null, 'same title by another singer is not used, even at the same length');
  assert.equal(pickBest(records, 'Tìm em', 'Unknown Artist', 251)?.artistName, 'Noo Phước Thịnh', 'unnamed artist falls back to title + duration');
  assert.equal(pickBest(records, 'Tìm em', 'Noo Phước Thịnh', 400), null, 'duration far off');
  assert.equal(pickBest(records, 'Other song', 'Hngle', 274), null);
});

test('lookup survives an unreachable lyrics service', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as any;
  try {
    assert.equal(await findLyrics({ title: 'x', artistName: 'y', duration: 100 }), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
