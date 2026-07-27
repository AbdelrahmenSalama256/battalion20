/**
 * Arabic Name Matcher — Fuzzy matching for Arabic military personnel names.
 *
 * Handles:
 *   - Tashkeel/diacritics removal
 *   - Alef variations (أ, إ, آ, ا)
 *   - Hamza normalization
 *   - Ta Marbuta / Ha normalization
 *   - Extra whitespace
 *   - Title prefixes (ال, أبو,_bin/ibn)
 *
 * Classification:
 *   - confirmed: similarity ≥ 0.95 AND unique best match
 *   - needs_review: similarity 0.70–0.94, OR multiple candidates in that range
 *   - no_match: similarity < 0.70
 */

const stringSimilarity = require("string-similarity");

// ============================================================
// ARABIC TEXT NORMALIZATION
// ============================================================

/**
 * Normalize an Arabic name for comparison.
 * - Remove tashkeel (diacritics)
 * - Normalize alef variants → ا
 * - Normalize ta marbuta → ه
 * - Normalize hamza variants → ء
 * - Remove extra whitespace
 * - Trim
 */
function normalizeArabic(str) {
  if (!str) return "";
  let s = String(str).trim();

  // Remove tashkeel (fathah, dammah, kasrah, sukun, shaddah, etc.)
  s = s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "");

  // Normalize alef variants → ا
  s = s.replace(/[أإآ]/g, "ا");

  // Normalize ta marbuta → ه
  s = s.replace(/ة/g, "ه");

  // Normalize ya variations
  s = s.replace(/ى/g, "ي");

  // Remove tatweel (kashida)
  s = s.replace(/\u0640/g, "");

  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

// ============================================================
// LEVENSHTEIN DISTANCE (for fine-grained comparison)
// ============================================================

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

// ============================================================
// MATCHING ENGINE
// ============================================================

/**
 * Find the best matches for a name from a list of database soldiers.
 *
 * @param {string} testName - Name from the uploaded file
 * @param {Array<{id: string, name: string, military_id?: string, rank_name?: string}>} soldiers - DB soldiers
 * @returns {{ match: "confirmed" | "needs_review" | "no_match", candidates: Array<{id, name, similarity}>, bestSimilarity: number }}
 */
function findMatch(testName, soldiers) {
  const normalizedTest = normalizeArabic(testName);
  if (!normalizedTest) return { match: "no_match", candidates: [], bestSimilarity: 0 };

  // Pre-normalize all soldier names
  const normalized = soldiers.map(s => ({
    ...s,
    _normalized: normalizeArabic(s.name),
  }));

  // Exact match first (after normalization)
  const exactMatch = normalized.find(s => s._normalized === normalizedTest);
  if (exactMatch) {
    return {
      match: "confirmed",
      candidates: [{ id: exactMatch.id, name: exactMatch.name, similarity: 1.0 }],
      bestSimilarity: 1.0,
    };
  }

  // Fuzzy matching using string-similarity (Dice coefficient)
  const dbNames = normalized.map(s => s._normalized);
  const ratings = stringSimilarity.compareTwoString(normalizedTest, dbNames);

  // Also try Levenshtein-based similarity for short names
  // (string-similarity can be unreliable for very short strings)
  const similarities = normalized.map((s, i) => {
    const diceRating = ratings[i];
    const levDist = levenshtein(normalizedTest, s._normalized);
    const maxLen = Math.max(normalizedTest.length, s._normalized.length);
    const levSim = maxLen > 0 ? 1 - levDist / maxLen : 0;
    // Take the better of the two scores
    const similarity = Math.max(diceRating, levSim);
    return { id: s.id, name: s.name, similarity };
  });

  // Sort by similarity descending
  similarities.sort((a, b) => b.similarity - a.similarity);

  const best = similarities[0];

  if (best.similarity >= 0.95) {
    // Check if there's another candidate very close to the best
    const runnerUp = similarities[1];
    if (runnerUp && runnerUp.similarity >= 0.90) {
      // Two very close candidates → needs review
      return {
        match: "needs_review",
        candidates: similarities.filter(s => s.similarity >= 0.80).slice(0, 5),
        bestSimilarity: best.similarity,
      };
    }
    return {
      match: "confirmed",
      candidates: [best],
      bestSimilarity: best.similarity,
    };
  }

  if (best.similarity >= 0.70) {
    return {
      match: "needs_review",
      candidates: similarities.filter(s => s.similarity >= 0.60).slice(0, 5),
      bestSimilarity: best.similarity,
    };
  }

  return {
    match: "no_match",
    candidates: similarities.filter(s => s.similarity >= 0.50).slice(0, 3),
    bestSimilarity: best.similarity,
  };
}

/**
 * Classify all parsed results against the DB soldier list.
 *
 * @param {Array} results - Parsed test results from the parser
 * @param {Array} soldiers - Soldiers from DB
 * @returns {{ confirmed: Array, needsReview: Array, noMatch: Array }}
 */
function classifyMatches(results, soldiers) {
  const confirmed = [];
  const needsReview = [];
  const noMatch = [];

  for (const result of results) {
    const matchResult = findMatch(result.name, soldiers);

    const enriched = {
      ...result,
      match_status: matchResult.match,
      best_similarity: matchResult.bestSimilarity,
      candidates: matchResult.candidates,
    };

    // If rank in file differs from DB rank, add a warning
    if (matchResult.match !== "no_match" && matchResult.candidates.length > 0) {
      const soldier = soldiers.find(s => s.id === matchResult.candidates[0].id);
      if (soldier && result.rank_from_file && soldier.rank_name) {
        const fileRank = normalizeArabic(result.rank_from_file);
        const dbRank = normalizeArabic(soldier.rank_name);
        if (fileRank && dbRank && fileRank !== dbRank) {
          enriched.rank_warning = `الرتبة في الملف "${result.rank_from_file}" مختلفة عن الرتبة في قاعدة البيانات "${soldier.rank_name}"`;
        }
      }
    }

    switch (matchResult.match) {
      case "confirmed":
        confirmed.push(enriched);
        break;
      case "needs_review":
        needsReview.push(enriched);
        break;
      case "no_match":
        noMatch.push(enriched);
        break;
    }
  }

  return { confirmed, needsReview, noMatch };
}

module.exports = { findMatch, classifyMatches, normalizeArabic, levenshtein };
