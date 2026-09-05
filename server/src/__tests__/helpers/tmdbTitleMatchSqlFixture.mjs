/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import assert from 'node:assert/strict';
import { QueueTmdbResolutionService } from '../../services/queueTmdbResolutionService.mjs';
import { QueueClassificationHistoryService } from '../../services/queueClassificationHistoryService.mjs';
import { processMetadataEnrichmentTask } from '../../services/queueTaskProcessorEnrichment.mjs';

const page = (results) => ({ page: 1, total_pages: results.length ? 1 : 0, total_results: results.length, results });
const movie = (id, title) => ({ id, title, release_date: '2001-01-01' });

/** Actual queue/database path with stubbed providers, rolled-back connection-local tables only. */
export async function verifyTmdbTitleMatchSql(client) {
  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TEMP TABLE libraries (id integer PRIMARY KEY, name text) ON COMMIT DROP;
      CREATE TEMP TABLE media_server_items (
        id integer PRIMARY KEY, media_type text, tmdb_id integer, library_id integer,
        title text, year integer, metadata jsonb DEFAULT '{}'
      ) ON COMMIT DROP;
      CREATE TEMP TABLE classification_history (
        tmdb_id integer, media_type text, title text, year integer, library_id integer,
        status text, confidence integer, method text, reason text, metadata jsonb,
        director_name text, primary_studio_name text, genre_names text[], cast_ids integer[], cast_names text[]
      ) ON COMMIT DROP;
      INSERT INTO libraries VALUES (1, 'Source');
    `);
    const cases = [
      { id: 1, title: 'Unique', response: page([movie(41, 'Other'), movie(42, 'Unique')]), expectedId: 42, reason: 'exact_title_year_match' },
      { id: 2, title: 'Weak', response: page([movie(43, 'Unrelated')]), reason: 'no_exact_title_year_match' },
      { id: 3, title: 'Ambiguous', response: page([movie(44, 'Ambiguous'), movie(45, 'Ambiguous')]), reason: 'ambiguous_title_year' },
      { id: 4, title: 'Missing year', year: null, reason: 'missing_year' },
      { id: 5, title: 'Partial', response: { ...page([movie(46, 'Partial')]), total_pages: 2, total_results: 21 }, reason: 'incomplete_results' },
      { id: 6, title: 'Unavailable', error: true, reason: 'provider_unavailable' },
      { id: 7, title: 'Invalid', response: page([movie(47, 'Invalid'), movie(0, 'Invalid')]), reason: 'invalid_response' },
      { id: 8, title: 'TV title', type: 'tv', response: page([{ id: 48, name: 'TV title', first_air_date: '2001-01-01' }]), expectedId: 48, reason: 'exact_title_year_match' },
    ];
    const query = (text, values) => client.query(text, values);
    const logger = { info() {}, warn() {}, debug() {}, error() {} };
    let calls = 0;
    const tmdb = new QueueTmdbResolutionService({ logger, queryWithTimeout: query, tmdbService: {
      searchIdentityCandidates: async (title, type, year) => {
        calls++;
        const item = cases.find((entry) => entry.title === title);
        assert.equal(type, item.type || 'movie'); assert.equal(year, 2001);
        if (item.error) throw new Error('private provider diagnostic');
        return item.response;
      },
    } });
    const completions = [];
    const deps = {
      db: { query }, logger, queryWithTimeout: query,
      metadataEnrichment: { hasWebSearchEnrichmentMetadata: () => false },
      enrichmentItemStateService: { markProcessing: async () => {}, syncItemState: async () => {} },
      resolveSourceLibraryName: async (_id, name) => name,
      queueOmdbEnrichmentService: { enrich: async () => {} },
      queueWebSearchEnrichmentService: { enrich: async () => {} },
      queueTmdbResolutionService: tmdb,
      queueClassificationHistoryService: new QueueClassificationHistoryService({ db: { query }, logger }),
      completeTask: async (_id, result) => completions.push(result),
    };
    for (const item of cases) {
      const type = item.type || 'movie';
      const year = item.year === null ? null : 2001;
      await query('INSERT INTO media_server_items (id, media_type, library_id, title, year) VALUES ($1, $2, 1, $3, $4)',
        [item.id, type, item.title, year]);
      await processMetadataEnrichmentTask({ id: item.id, payload: {
        itemId: item.id, title: item.title, media_type: type, year,
      } }, deps);
      const stored = (await query('SELECT tmdb_id, metadata FROM media_server_items WHERE id = $1', [item.id])).rows[0];
      assert.equal(stored.tmdb_id, item.expectedId ?? null);
      assert.deepEqual(stored.metadata.tmdb_resolution, {
        version: 1, status: item.expectedId ? 'resolved' : 'review_required', method: 'title', reason: item.reason,
      });
      const history = (await query('SELECT tmdb_id, media_type, method FROM classification_history WHERE title = $1', [item.title])).rows;
      assert.equal(history.length, 1);
      assert.equal(history[0].tmdb_id, item.expectedId ?? null);
      assert.equal(history[0].media_type, type);
      assert.equal(history[0].method, 'source_library');
    }
    assert.equal(calls, 7); // Missing years cause no provider request.
    assert.equal(completions.length, 8);
    assert.equal(completions.every((result) => result.enriched), true);

    // Simulate an independently established source ID and rerun enrichment.
    await query('UPDATE media_server_items SET tmdb_id = 99 WHERE id = 4');
    await processMetadataEnrichmentTask({ id: 9, payload: {
      itemId: 4, title: 'Missing year', media_type: 'movie', year: null,
    } }, deps);
    const updated = (await query('SELECT tmdb_id, metadata FROM media_server_items WHERE id = 4')).rows[0];
    assert.equal(updated.tmdb_id, 99);
    assert.deepEqual(updated.metadata.tmdb_resolution, {
      version: 1, status: 'resolved', method: 'existing_id', reason: 'identifier_available',
    });
    assert.equal(calls, 7);
    return { cases: 8, resolved: 2, reviewRequired: 6, knownIdClearsReview: true };
  } finally {
    await client.query('ROLLBACK');
  }
}
