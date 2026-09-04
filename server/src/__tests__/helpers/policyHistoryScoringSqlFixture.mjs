/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import assert from 'node:assert/strict';
import { createPolicyHistoryScorer } from '../../services/policyHistoryScoring.mjs';

/** Reusable PostgreSQL regression; only a connection-local temporary table is written. */
export async function verifyPolicyHistoryScoringSql(client) {
  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TEMP TABLE classification_history (
        tmdb_id integer, media_type text, library_id integer,
        confidence numeric(5,2), status text
      ) ON COMMIT DROP;
      INSERT INTO classification_history VALUES
        (42, 'movie', 10, 60, 'completed'),
        (42, 'movie', 10, 99, 'pending'),
        (42, 'movie', 10, 99, 'failed'),
        (42, 'movie', NULL, 99, 'completed'),
        (42, NULL, 10, 99, 'completed'),
        (44, 'movie', 10, 99, 'completed'),
        (43, 'movie', 10, 60, 'completed'),
        (45, 'movie', 10, NULL, 'completed');
      INSERT INTO classification_history
        SELECT 42, 'tv', 10, 99, 'completed' FROM generate_series(1,4);
      INSERT INTO classification_history
        SELECT identity, 'tv', library, 99, 'completed'
        FROM generate_series(42,43) identity
        CROSS JOIN generate_series(20,25) library
        CROSS JOIN generate_series(1,4);
      INSERT INTO classification_history
        SELECT 46, 'movie', library, 60, 'completed' FROM generate_series(16,11,-1) library;
    `);

    const scorer = createPolicyHistoryScorer({ query: (text, values) => client.query(text, values) });
    const movieScore = await scorer(10, { tmdb_id: 42, media_type: 'movie' });
    const tvScore = await scorer(10, { tmdb_id: 42, media_type: 'tv' });
    const crossTypeDestinationScore = await scorer(20, { tmdb_id: 42, media_type: 'movie' });
    const beforeLimitScore = await scorer(10, { tmdb_id: 43, media_type: 'movie' });
    assert.equal(movieScore, 70);
    assert.equal(tvScore, 95);
    assert.equal(crossTypeDestinationScore, 0);
    assert.equal(beforeLimitScore, 70);
    assert.equal(await scorer(10, { tmdb_id: 45, media_type: 'movie' }), 0);
    assert.equal(await scorer(10, { tmdb_id: 999, media_type: 'movie' }), 0);
    assert.equal(await scorer(10, { tmdb_id: 42 }), 0);
    assert.equal(await scorer(15, { tmdb_id: 46, media_type: 'movie' }), 70);
    assert.equal(await scorer(16, { tmdb_id: 46, media_type: 'movie' }), 0);

    // Reproduce the former query shape so the fixture proves the original bug.
    const legacyRows = (await client.query(`
      SELECT library_id, MAX(confidence) AS confidence, COUNT(*) AS match_count
      FROM classification_history WHERE tmdb_id = $1 AND status = 'completed'
        AND library_id IS NOT NULL
      GROUP BY library_id ORDER BY match_count DESC, confidence DESC LIMIT 5
    `, [43])).rows;
    assert.equal(legacyRows.some((row) => row.library_id === 10), false);
    return { movieScore, tvScore, crossTypeDestinationScore, beforeLimitScore, deterministicLimit: true };
  } finally {
    await client.query('ROLLBACK');
  }
}
