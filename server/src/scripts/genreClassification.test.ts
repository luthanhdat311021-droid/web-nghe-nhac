import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGenres, validateClassifications } from '../services/genreClassification.js';

const songs = [{ id: 'song-1', title: 'Example', artist: 'Artist', album: null }];
const genres = [{ id: 'genre-1', name: 'Pop', slug: 'pop' }];
const decision = { songId: 'song-1', genreId: 'genre-1', confidence: 0.9 };
test('accepts a confident catalog classification', () => {
  assert.deepEqual(validateClassifications({ classifications: [decision] }, songs, genres), [decision]);
});
test('leaves uncertain or unknown songs unassigned', () => {
  for (const item of [{ ...decision, confidence: 0.79 }, { ...decision, genreId: null }]) {
    assert.deepEqual(validateClassifications({ classifications: [item] }, songs, genres), []);
  }
});
test('rejects hallucinated IDs, duplicate decisions and malformed confidence', () => {
  for (const classifications of [
    [{ ...decision, songId: 'invented' }], [{ ...decision, genreId: 'invented' }],
    [decision, decision], [{ ...decision, confidence: 1.1 }], [{ ...decision, confidence: '0.9' }],
  ]) assert.throws(() => validateClassifications({ classifications }, songs, genres));
});
test('Gemini transport uses server credentials and validates the response', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only';
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'test-only');
      const body = JSON.parse(init?.body as string);
      assert.deepEqual(JSON.parse(body.contents[0].parts[0].text).songs, songs);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ classifications: [decision] }) }] } }] }));
    };
    assert.deepEqual(await classifyGenres(songs, genres), [decision]);
    globalThis.fetch = async () => new Response('', { status: 429 });
    await assert.rejects(classifyGenres(songs, genres), /HTTP 429/);
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(classifyGenres(songs, genres), /GEMINI_API_KEY/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});
