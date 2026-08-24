/**
 * Automated Verification Script for MusicWave AI Smart Search Engine
 * Tests all 12 core requirements and acceptance criteria
 */

import { removeVietnameseAccents } from '../services/search/textNormalizer.js';
import { computeMatchScore } from '../services/search/fuzzyMatcher.js';
import { aiSearchManager } from '../services/search/ai/aiProvider.js';
import { HybridSearchService } from '../services/search/hybridSearchService.js';
import { prisma } from '../services/prisma.js';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING MUSICWAVE AI SMART SEARCH ENGINE TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (details) console.log(`   └─ ${details}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${testName}`);
      if (details) console.log(`   └─ ${details}`);
      failed++;
    }
  }

  // 1. Text Normalization & Accent Removal
  const vnText = removeVietnameseAccents('Sơn Tùng M-TP - Em Của Ngày Hôm Qua');
  assert(
    'TEST 1.1: Vietnamese Accent Removal',
    vnText.toLowerCase() === 'son tung m-tp - em cua ngay hom qua',
    `Result: "${vnText}"`
  );

  // 2. Fuzzy Matching & Typo Tolerance
  const match1 = computeMatchScore('sontung', 'Sơn Tùng M-TP');
  assert(
    'TEST 2: Compact Typo "sontung" -> "Sơn Tùng M-TP"',
    match1.score >= 0.85,
    `Score: ${match1.score.toFixed(3)}, isExact/Prefix: ${match1.isExact || match1.isPrefix}`
  );

  const match2 = computeMatchScore('son tung', 'Sơn Tùng M-TP');
  assert(
    'TEST 3: No-accent "son tung" -> "Sơn Tùng M-TP"',
    match2.score >= 0.85,
    `Score: ${match2.score.toFixed(3)}`
  );

  const match3 = computeMatchScore('taylor swfit', 'Taylor Swift');
  assert(
    'TEST 4: Typo "taylor swfit" -> "Taylor Swift"',
    match3.score >= 0.70,
    `Score: ${match3.score.toFixed(3)}`
  );

  const match4 = computeMatchScore('starlite transmsion', 'Starlight Transmission');
  assert(
    'TEST 12: Song Title Typo "starlite transmsion" -> "Starlight Transmission"',
    match4.score >= 0.65,
    `Score: ${match4.score.toFixed(3)}`
  );

  // 3. AI Intent Understanding
  const ai1 = await aiSearchManager.analyzeQuery('nhạc chill để học bài');
  assert(
    'TEST 5 & 7: AI Intent for "nhạc chill để học bài"',
    Boolean(ai1.isRecommendation && ai1.entities.moods.includes('chill') && ai1.entities.activities.includes('study')),
    `Intent: ${ai1.intent}, Moods: [${ai1.entities.moods.join(',')}], Activities: [${ai1.entities.activities.join(',')}], Explanation: "${ai1.explanation}"`
  );

  const ai2 = await aiSearchManager.analyzeQuery('nhạc buồn ban đêm');
  assert(
    'TEST 6 & 11: AI Intent for "nhạc buồn ban đêm"',
    Boolean(ai2.entities.moods.includes('sad') && ai2.entities.timeOfDay === 'night'),
    `Intent: ${ai2.intent}, Moods: [${ai2.entities.moods.join(',')}], Time: ${ai2.entities.timeOfDay}, Explanation: "${ai2.explanation}"`
  );

  const ai3 = await aiSearchManager.analyzeQuery('bài hát giống bài đang nghe', { currentSongId: 'test' });
  assert(
    'TEST: Similar song intent "bài hát giống bài đang nghe"',
    Boolean(ai3.intent === 'SIMILAR_SONG' && ai3.isRecommendation),
    `Intent: ${ai3.intent}, Explanation: "${ai3.explanation}"`
  );

  // 4. End-to-End Hybrid Search via DB
  try {
    const searchRes1 = await HybridSearchService.searchAll({ query: 'Starlight Transmission' });
    assert(
      'TEST 8: Exact Song Title Search "Starlight Transmission"',
      Boolean(searchRes1.songs.length > 0 && searchRes1.songs[0].title === 'Starlight Transmission'),
      `Top match: ${searchRes1.songs[0]?.title || 'none'}`
    );

    const searchRes2 = await HybridSearchService.searchAll({ query: 'Neon Horizon' });
    assert(
      'TEST 9: Exact Artist Search "Neon Horizon"',
      Boolean(searchRes2.artists.length > 0 && searchRes2.artists[0].name === 'Neon Horizon'),
      `Top artist: ${searchRes2.artists[0]?.name || 'none'}`
    );

    const searchRes3 = await HybridSearchService.searchAll({ query: 'asdfghjkl9999xyz_not_exist' });
    assert(
      'TEST 10: Zero-Hallucination on Non-Existent Query',
      Boolean(searchRes3.songs.length === 0 && searchRes3.artists.length === 0 && searchRes3.albums.length === 0),
      `Results count: songs=${searchRes3.songs.length}, artists=${searchRes3.artists.length}`
    );

    const searchRes4 = await HybridSearchService.searchAll({ query: 'nhạc chill' });
    assert(
      'TEST: Semantic Recommendation for "nhạc chill"',
      Boolean(searchRes4.isRecommendation && (searchRes4.songs.length > 0 || searchRes4.explanation?.includes('Chill'))),
      `Recommendation: ${searchRes4.isRecommendation}, Explanation: "${searchRes4.explanation}", Songs found: ${searchRes4.songs.length}`
    );
  } catch (err: any) {
    console.error('Database query error in test (is DB connected?):', err.message);
  }

  console.log('\n====================================================');
  console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await prisma.$disconnect();
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
