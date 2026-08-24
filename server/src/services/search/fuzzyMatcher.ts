/**
 * Fuzzy Search & Typo Matching Engine
 * MusicWave AI Smart Search Engine
 */

import { removeVietnameseAccents } from './textNormalizer.js';

/**
 * Computes Damerau-Levenshtein distance between two strings
 * Handles insertions, deletions, substitutions, and transpositions (adjacent character swaps)
 */
export function damerauLevenshteinDistance(source: string, target: string): number {
  if (source === target) return 0;
  if (!source) return target ? target.length : 0;
  if (!target) return source ? source.length : 0;

  const srcLen = source.length;
  const tgtLen = target.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= srcLen; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= tgtLen; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= srcLen; i++) {
    for (let j = 1; j <= tgtLen; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Deletion
        matrix[i][j - 1] + 1,      // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );

      // Transposition check
      if (
        i > 1 &&
        j > 1 &&
        source[i - 1] === target[j - 2] &&
        source[i - 2] === target[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }

  return matrix[srcLen][tgtLen];
}

/**
 * Computes Trigrams / N-grams for a string
 */
export function getNGrams(text: string, n = 2): Set<string> {
  const ngrams = new Set<string>();
  const padded = ` ${text} `;
  for (let i = 0; i <= padded.length - n; i++) {
    ngrams.add(padded.substring(i, i + n));
  }
  return ngrams;
}

/**
 * Computes N-gram Dice coefficient similarity [0.0 - 1.0]
 */
export function nGramSimilarity(strA: string, strB: string, n = 2): number {
  if (strA === strB) return 1.0;
  if (!strA || !strB) return 0.0;

  const setA = getNGrams(strA, n);
  const setB = getNGrams(strB, n);

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection++;
    }
  }

  const total = setA.size + setB.size;
  return total > 0 ? (2 * intersection) / total : 0;
}

export interface FuzzyMatchResult {
  score: number;        // 0.0 to 1.0
  isExact: boolean;
  isPrefix: boolean;
  isSubstring: boolean;
  isFuzzy: boolean;
}

/**
 * Computes a comprehensive matching score between query and target candidate
 */
export function computeMatchScore(
  queryRaw: string,
  candidateRaw: string
): FuzzyMatchResult {
  if (!queryRaw || !candidateRaw) {
    return { score: 0, isExact: false, isPrefix: false, isSubstring: false, isFuzzy: false };
  }

  const queryClean = queryRaw.toLowerCase().trim();
  const candClean = candidateRaw.toLowerCase().trim();

  // 1. Exact raw match
  if (queryClean === candClean) {
    return { score: 1.0, isExact: true, isPrefix: true, isSubstring: true, isFuzzy: false };
  }

  const qNoAcc = removeVietnameseAccents(queryClean);
  const cNoAcc = removeVietnameseAccents(candClean);

  // 2. Exact match ignoring Vietnamese accents
  if (qNoAcc === cNoAcc) {
    return { score: 0.96, isExact: true, isPrefix: true, isSubstring: true, isFuzzy: false };
  }

  const qCompact = qNoAcc.replace(/[^a-z0-9]/g, '');
  const cCompact = cNoAcc.replace(/[^a-z0-9]/g, '');

  // 3. Compact match (e.g. "sontung" === "sontungmtp" or "sontung" in "sontung")
  if (qCompact && cCompact && qCompact === cCompact) {
    return { score: 0.94, isExact: true, isPrefix: true, isSubstring: true, isFuzzy: false };
  }

  // 4. Prefix match
  if (cNoAcc.startsWith(qNoAcc) || (cCompact && qCompact && cCompact.startsWith(qCompact))) {
    const ratio = Math.min(1, qNoAcc.length / cNoAcc.length);
    const prefixScore = 0.82 + ratio * 0.12; // 0.82 - 0.94
    return { score: prefixScore, isExact: false, isPrefix: true, isSubstring: true, isFuzzy: false };
  }

  // 5. Word boundary / Substring match
  if (cNoAcc.includes(qNoAcc)) {
    const ratio = Math.min(1, qNoAcc.length / cNoAcc.length);
    const subScore = 0.70 + ratio * 0.15; // 0.70 - 0.85
    return { score: subScore, isExact: false, isPrefix: false, isSubstring: true, isFuzzy: false };
  }

  // 6. Compact substring match (e.g. "sontung" in "sontungmtp")
  if (qCompact.length >= 3 && cCompact.includes(qCompact)) {
    const ratio = Math.min(1, qCompact.length / cCompact.length);
    const compactSubScore = 0.68 + ratio * 0.15;
    return { score: compactSubScore, isExact: false, isPrefix: false, isSubstring: true, isFuzzy: false };
  }

  // 7. Token-by-token alignment & similarity
  const qTokens = qNoAcc.split(/\s+/).filter(Boolean);
  const cTokens = cNoAcc.split(/\s+/).filter(Boolean);

  let totalTokenScore = 0;
  for (const qt of qTokens) {
    let bestForToken = 0;
    for (const ct of cTokens) {
      if (qt === ct) {
        bestForToken = 1.0;
        break;
      }
      if (ct.startsWith(qt) || qt.startsWith(ct)) {
        const pScore = Math.min(qt.length, ct.length) / Math.max(qt.length, ct.length);
        bestForToken = Math.max(bestForToken, 0.82 * pScore);
      }
      const dist = damerauLevenshteinDistance(qt, ct);
      const maxL = Math.max(qt.length, ct.length);
      if (maxL > 0) {
        const ratio = Math.max(0, 1 - dist / maxL);
        bestForToken = Math.max(bestForToken, ratio);
      }
    }
    totalTokenScore += bestForToken;
  }
  const tokenFuzzyAvg = qTokens.length > 0 ? totalTokenScore / qTokens.length : 0;

  // 8. Damerau-Levenshtein distance on compact strings
  const maxLen = Math.max(qCompact.length, cCompact.length);
  const dist = damerauLevenshteinDistance(qCompact, cCompact);
  const editRatio = maxLen > 0 ? Math.max(0, 1 - dist / maxLen) : 0;

  // 9. N-Gram similarity
  const nGramScore = nGramSimilarity(qNoAcc, cNoAcc, 2);

  // Composite fuzzy score
  const fuzzyComposite = Math.max(
    tokenFuzzyAvg,
    editRatio,
    nGramScore * 0.85
  );

  const isFuzzy = fuzzyComposite >= 0.50;

  return {
    score: Math.min(0.88, fuzzyComposite),
    isExact: false,
    isPrefix: false,
    isSubstring: false,
    isFuzzy,
  };
}
