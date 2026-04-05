/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * verify_classification_evidence_backfill.js
 *
 * Phase 2 verification companion to backfill_classification_evidence.js.
 * Compares learning_patterns and discovered_patterns row counts against
 * classification_evidence to detect missing rows, provenance drift, or
 * scope mismatches after a backfill run.
 *
 * USAGE:
 *   node scripts/verify_classification_evidence_backfill.js
 *
 * EXIT CODE:
 *   0 — all checks pass
 *   1 — one or more checks failed or errors were detected
 */

'use strict';

/**
 * Build the count summary from both source tables and the target table.
 *
 * @param {object} db - database instance
 * @returns {Promise<VerificationCounts>}
 */
async function collectCounts(db) {
  const [lpExact, lpGenre, dpActive, ceItemExact, ceGenre, ceRelated] = await Promise.all([
    db.query(`SELECT COUNT(*) AS count FROM learning_patterns WHERE pattern_type = 'exact_match'`),
    db.query(`SELECT COUNT(*) AS count FROM learning_patterns WHERE pattern_type = 'genre_pattern' AND pattern_data->>'genre' IS NOT NULL`),
    db.query(`SELECT COUNT(*) AS count FROM discovered_patterns WHERE status IN ('discovered', 'approved') AND pattern_type IN ('studio','franchise','genre','certification')`),
    db.query(`SELECT COUNT(*) AS count FROM classification_evidence WHERE scope = 'item_exact' AND source_system = 'learning_patterns'`),
    db.query(`SELECT COUNT(*) AS count FROM classification_evidence WHERE scope = 'genre' AND source_system = 'learning_patterns'`),
    db.query(`SELECT COUNT(*) AS count FROM classification_evidence WHERE scope IN ('studio','franchise','genre','certification') AND source_system = 'discovered_patterns'`)
  ]);

  return {
    source: {
      learningPatternsExact:  parseInt(lpExact.rows[0].count, 10),
      learningPatternsGenre:  parseInt(lpGenre.rows[0].count, 10),
      discoveredPatternsActive: parseInt(dpActive.rows[0].count, 10)
    },
    target: {
      itemExactFromLearning: parseInt(ceItemExact.rows[0].count, 10),
      genreFromLearning:     parseInt(ceGenre.rows[0].count, 10),
      relatedFromDiscovered: parseInt(ceRelated.rows[0].count, 10)
    }
  };
}

/**
 * Check for learning_patterns rows that are missing from classification_evidence.
 * Returns a list of missing row ids (up to limit).
 *
 * @param {object} db
 * @param {number} [limit]
 * @returns {Promise<{exact: number[], genre: number[]}>}
 */
async function detectMissingRows(db, limit = 20) {
  const [exactMissing, genreMissing] = await Promise.all([
    db.query(
      `SELECT lp.id
       FROM learning_patterns lp
       LEFT JOIN classification_evidence ce
         ON ce.scope = 'item_exact'
        AND ce.tmdb_id = lp.tmdb_id
        AND ce.media_type = lp.media_type
        AND ce.source_system = 'learning_patterns'
       WHERE lp.pattern_type = 'exact_match'
         AND lp.tmdb_id IS NOT NULL
         AND ce.id IS NULL
       LIMIT $1`,
      [limit]
    ),
    db.query(
      `SELECT lp.id
       FROM learning_patterns lp
       LEFT JOIN classification_evidence ce
         ON ce.scope = 'genre'
        AND ce.evidence_key = 'genre:' || lower(lp.pattern_data->>'genre')
        AND ce.library_id = lp.library_id
        AND ce.source_system = 'learning_patterns'
       WHERE lp.pattern_type = 'genre_pattern'
         AND lp.pattern_data->>'genre' IS NOT NULL
         AND ce.id IS NULL
       LIMIT $1`,
      [limit]
    )
  ]);

  return {
    exact: exactMissing.rows.map(r => r.id),
    genre: genreMissing.rows.map(r => r.id)
  };
}

/**
 * Run all verification checks and return a report.
 *
 * @param {object} db
 * @returns {Promise<VerificationReport>}
 */
async function runVerification(db) {
  const counts = await collectCounts(db);
  const missing = await detectMissingRows(db);

  const checks = [];

  // Check 1: exact_match coverage
  const exactCoverage = counts.source.learningPatternsExact > 0
    ? counts.target.itemExactFromLearning / counts.source.learningPatternsExact
    : 1;
  checks.push({
    name: 'exact_match_coverage',
    passed: exactCoverage >= 1.0,
    expected: counts.source.learningPatternsExact,
    actual: counts.target.itemExactFromLearning,
    detail: `coverage=${(exactCoverage * 100).toFixed(1)}%`,
    missingIds: missing.exact
  });

  // Check 2: genre_pattern coverage
  const genreCoverage = counts.source.learningPatternsGenre > 0
    ? counts.target.genreFromLearning / counts.source.learningPatternsGenre
    : 1;
  checks.push({
    name: 'genre_pattern_coverage',
    passed: genreCoverage >= 1.0,
    expected: counts.source.learningPatternsGenre,
    actual: counts.target.genreFromLearning,
    detail: `coverage=${(genreCoverage * 100).toFixed(1)}%`,
    missingIds: missing.genre
  });

  // Check 3: discovered_patterns coverage (approximate — may under-count due to unique key collisions)
  const discoveredCoverage = counts.source.discoveredPatternsActive > 0
    ? counts.target.relatedFromDiscovered / counts.source.discoveredPatternsActive
    : 1;
  // Allow some slack for duplicate keys across libraries (same pattern_value, different library)
  checks.push({
    name: 'discovered_patterns_coverage',
    passed: discoveredCoverage >= 0.90,
    expected: counts.source.discoveredPatternsActive,
    actual: counts.target.relatedFromDiscovered,
    detail: `coverage=${(discoveredCoverage * 100).toFixed(1)}% (90% threshold; duplicates may be collapsed)`
  });

  const allPassed = checks.every(c => c.passed);

  return {
    passed: allPassed,
    counts,
    checks
  };
}

/**
 * Format the verification report as a human-readable string.
 * @param {VerificationReport} report
 * @returns {string}
 */
function formatReport(report) {
  const status = report.passed ? 'PASS' : 'FAIL';
  const lines = [`Verify classification_evidence backfill — ${status}`];

  for (const check of report.checks) {
    const icon = check.passed ? '✓' : '✗';
    lines.push(`  ${icon} ${check.name}: expected=${check.expected}, actual=${check.actual} (${check.detail})`);
    if (!check.passed && check.missingIds?.length > 0) {
      lines.push(`    Missing row ids (sample): ${check.missingIds.join(', ')}`);
    }
  }

  return lines.join('\n');
}

// ── CLI entry point ──────────────────────────────────────────────────────────
if (require.main === module) {
  const db = require('../server/src/config/database');
  require('dotenv').config({ path: '../server/.env' });

  (async () => {
    try {
      const report = await runVerification(db);
      console.log(formatReport(report));
      if (!report.passed) process.exit(1);
    } catch (err) {
      console.error('Verification failed:', err.message);
      process.exit(1);
    } finally {
      if (db.pool && typeof db.pool.end === 'function') {
        await db.pool.end();
      }
    }
  })();
}

module.exports = {
  collectCounts,
  detectMissingRows,
  runVerification,
  formatReport
};
