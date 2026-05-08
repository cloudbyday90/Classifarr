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
 * verify_classification_evidence_backfill.mjs
 *
 * Phase 2 backfill verification: checks that classification_evidence is
 * populated and that row counts and key formats are consistent with the
 * source tables.
 *
 * USAGE
 *   node server/src/scripts/verify_classification_evidence_backfill.mjs
 *
 * EXIT CODES
 *   0 — all checks passed
 *   1 — one or more checks failed
 *
 * OUTPUT
 *   Structured verification report to stdout.
 */

import * as db from '../config/database.mjs';

// ── Individual check functions (exported for unit testing) ────────────────────

/**
 * Count rows in classification_evidence by source_system.
 * Returns { learning_patterns: N, discovered_patterns: N, total: N }
 *
 * @param {object} client - database client
 * @returns {Promise<object>}
 */
export async function countBySource(client) {
  const result = await client.query(
    `SELECT source_system, COUNT(*)::int AS cnt
     FROM classification_evidence
     GROUP BY source_system`
  );
  const counts = {};
  for (const row of result.rows) {
    counts[row.source_system] = row.cnt;
  }
  return {
    learning_patterns: counts.learning_patterns ?? 0,
    discovered_patterns: counts.discovered_patterns ?? 0,
    total: result.rows.reduce((sum, row) => sum + row.cnt, 0)
  };
}

/**
 * Count source rows in learning_patterns that should have been backfilled.
 *
 * @param {object} client
 * @returns {Promise<number>}
 */
export async function countLearningPatternsSource(client) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS cnt
     FROM learning_patterns
     WHERE pattern_type IN ('exact_match', 'genre_pattern')`
  );
  return result.rows[0]?.cnt ?? 0;
}

/**
 * Count source rows in discovered_patterns that should have been backfilled.
 * Returns 0 if the table does not exist on this install.
 *
 * @param {object} client
 * @returns {Promise<number>}
 */
export async function countDiscoveredPatternsSource(client) {
  const tableCheck = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'discovered_patterns'
     )`
  );
  if (!tableCheck.rows[0]?.exists) return 0;

  const result = await client.query(
    `SELECT COUNT(*)::int AS cnt
     FROM discovered_patterns
     WHERE pattern_type IN ('studio','franchise','genre','certification')
       AND deprecated_at IS NULL`
  );
  return result.rows[0]?.cnt ?? 0;
}

/**
 * Find classification_evidence rows that have a non-null evidence_key that
 * does not match the expected {scope}:{lowercase_value} format.
 *
 * Returns an array of malformed rows (id, scope, evidence_key) capped at 20.
 *
 * @param {object} client
 * @returns {Promise<Array>}
 */
export async function findMalformedKeys(client) {
  const result = await client.query(
    `SELECT id, scope, evidence_key
     FROM classification_evidence
     WHERE evidence_key IS NOT NULL
       AND evidence_key !~ '^[a-z_]+:[a-z0-9|._ /-]+$'
     ORDER BY id
     LIMIT 20`
  );
  return result.rows;
}

/**
 * Find active item_exact rows with null tmdb_id (violates trust semantics).
 *
 * @param {object} client
 * @returns {Promise<Array>}
 */
export async function findExactMatchWithoutTmdbId(client) {
  const result = await client.query(
    `SELECT id, scope, library_id, evidence_key
     FROM classification_evidence
     WHERE scope = 'item_exact'
       AND tmdb_id IS NULL
     ORDER BY id
     LIMIT 20`
  );
  return result.rows;
}

// ── Main verify logic ─────────────────────────────────────────────────────────

export async function verify({ database = null } = {}) {
  const executor = database || db;
  const client = await executor.connect();

  const report = {
    passed: true,
    checks: []
  };

  function addCheck(name, passed, detail) {
    report.checks.push({ name, passed, detail });
    if (!passed) report.passed = false;
  }

  try {
    const tableCheck = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'classification_evidence'
       )`
    );
    const tableExists = tableCheck.rows[0]?.exists === true;
    addCheck(
      'classification_evidence table exists',
      tableExists,
      tableExists ? 'OK' : 'Table not found — run migration first'
    );

    if (!tableExists) {
      return report;
    }

    const [byCounts, lpSource, dpSource] = await Promise.all([
      countBySource(client),
      countLearningPatternsSource(client),
      countDiscoveredPatternsSource(client)
    ]);

    addCheck(
      'learning_patterns rows fully backfilled',
      byCounts.learning_patterns >= lpSource,
      `classification_evidence has ${byCounts.learning_patterns} rows from learning_patterns; source has ${lpSource}`
    );

    addCheck(
      'discovered_patterns rows fully backfilled',
      byCounts.discovered_patterns >= dpSource,
      `classification_evidence has ${byCounts.discovered_patterns} rows from discovered_patterns; source has ${dpSource}`
    );

    addCheck(
      'total classification_evidence rows',
      byCounts.total > 0 || (lpSource === 0 && dpSource === 0),
      `total rows: ${byCounts.total}`
    );

    const malformed = await findMalformedKeys(client);
    addCheck(
      'all evidence_key values match {scope}:{value} format',
      malformed.length === 0,
      malformed.length === 0
        ? 'OK'
        : `${malformed.length} malformed key(s): ${JSON.stringify(malformed.map((row) => row.evidence_key))}`
    );

    const missingTmdb = await findExactMatchWithoutTmdbId(client);
    addCheck(
      'all item_exact rows have a tmdb_id',
      missingTmdb.length === 0,
      missingTmdb.length === 0
        ? 'OK'
        : `${missingTmdb.length} item_exact row(s) have null tmdb_id (ids: ${missingTmdb.map((row) => row.id).join(', ')})`
    );

    const badScope = await client.query(
      `SELECT scope, COUNT(*)::int AS cnt
       FROM classification_evidence
       WHERE scope NOT IN ('item_exact','genre','studio','franchise','certification','profile_affinity')
       GROUP BY scope`
    );
    addCheck(
      'all rows have a recognised scope',
      badScope.rows.length === 0,
      badScope.rows.length === 0
        ? 'OK'
        : `Unknown scope(s): ${badScope.rows.map((row) => `${row.scope}(${row.cnt})`).join(', ')}`
    );
  } finally {
    client.release();
  }

  return report;
}

/* eslint-disable no-console */
async function main() {
  try {
    const report = await verify();
    console.log('\n=== Classification Evidence Backfill Verification ===\n');
    for (const check of report.checks) {
      const icon = check.passed ? '✓' : '✗';
      console.log(`  ${icon} ${check.name}`);
      if (!check.passed || process.argv.includes('--verbose')) {
        console.log(`      ${check.detail}`);
      }
    }
    console.log('');
    if (report.passed) {
      console.log('All checks passed.');
      process.exit(0);
    }

    const failures = report.checks.filter((check) => !check.passed).length;
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
  } catch (err) {
    console.error('Verification failed:', err.message);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
