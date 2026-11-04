import test from 'node:test';
import assert from 'node:assert/strict';
import { alignLines } from '../services/lyricsWhisper.js';

const words = (text: string, start: number) =>
  text.split(' ').map((word, i) => ({ word, start: start + i * 0.4 }));

test('alignLines takes wording from the reference and timing from heard words', () => {
  const heard = [
    ...words('anh tim em giua', 12),
    ...words('dem dong', 14),          // misheard filler
    ...words('em o noi dau', 20.5),
    ...words('nguoi oi', 30),
  ];
  const lines = alignLines(['Anh tìm em giữa đêm đông', 'Em ở nơi đâu', 'Người ơi'], heard);
  assert.deepEqual(lines?.map((l) => l.time), [12, 20.5, 30]);
  assert.equal(lines?.[1].text, 'Em ở nơi đâu');
});

test('alignLines keeps a line on its own audio when its opening words were misheard', () => {
  // "Có đôi lần khẽ cười" is heard as "co doi lam khe cuoi" (one letter off) and "Từ giọng nói" loses
  // its first word: each line must still start where it is sung, not slide onto the next line.
  const heard = [
    ...words('ngoi ngan ngo anh hat vu vo', 26),
    ...words('co doi lam khe cuoi vi anh', 32),
    ...words('giong noi nhu giot mat ben tai', 38.8),
    ...words('nhieu khi anh cu ngo', 45),
  ];
  const lines = alignLines([
    'Ngồi ngẩn ngơ, anh hát vu vơ',
    'Có đôi lần khẽ cười vì anh',
    'Từ giọng nói như rót mật bên tai',
    'Nhiều khi anh cứ ngỡ',
  ], heard);
  assert.deepEqual(lines?.map((l) => l.time), [26, 32, 38.52, 45]);
});

test('alignLines fills an unheard line between its neighbours and gives up when little matches', () => {
  const heard = [...words('mot hai ba', 10), ...words('bay tam chin', 20)];
  const lines = alignLines(['Một hai ba', 'Bốn năm sáu', 'Bảy tám chín'], heard);
  assert.deepEqual(lines?.map((l) => l.time), [10, 15, 20]);
  assert.equal(alignLines(['xyz abc', 'qqq www', 'rrr ttt'], heard), null);
});
