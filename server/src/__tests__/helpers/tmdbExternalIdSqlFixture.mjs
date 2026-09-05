/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import assert from 'node:assert/strict';
import { QueueTmdbResolutionService } from '../../services/queueTmdbResolutionService.mjs';
import { QueueClassificationHistoryService } from '../../services/queueClassificationHistoryService.mjs';
import { processMetadataEnrichmentTask } from '../../services/queueTaskProcessorEnrichment.mjs';

const bucket = (...ids) => ({ tv_results: ids.map((id) => ({ id })) });
const both = { tvdb_id: 123, imdb_id: 'tt456' };

/** Actual queue services and SQL; providers are stubbed and only rolled-back TEMP tables are written. */
export async function verifyTmdbExternalIdSql(client) {
  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TEMP TABLE libraries (id integer PRIMARY KEY, name text) ON COMMIT DROP;
      CREATE TEMP TABLE media_server_items (
        media_server_id integer, external_id text,
        id integer PRIMARY KEY, media_type text, tmdb_id integer, library_id integer,
        title text, year integer, imdb_id text, tvdb_id integer, metadata jsonb DEFAULT '{}', tags text[],
        inventory_tmdb_attempted_at timestamptz, inventory_tmdb_fetched_at timestamptz
      ) ON COMMIT DROP;
      CREATE TEMP TABLE classification_history (
        tmdb_id integer, media_type text, title text, year integer, library_id integer,
        status text, confidence integer, method text, reason text, metadata jsonb,
        director_name text, primary_studio_name text, genre_names text[], cast_ids integer[], cast_names text[]
      ) ON COMMIT DROP;
    `);
    const cases = [
      { ids: { tvdb_id: 123 }, responses: [bucket(42)], expectedId: 42, method: 'tvdb', reason: 'external_id_match' },
      { ids: both, responses: [bucket(42), bucket(42)], expectedId: 42, method: 'external_ids', reason: 'external_ids_agree' },
      { ids: both, responses: [bucket(42), bucket(43)], method: 'external_ids', reason: 'conflicting_external_ids' },
      { ids: both, responses: [bucket(42, 43)], method: 'tvdb', reason: 'ambiguous_external_id' },
      { ids: both, responses: [bucket(42, 0)], method: 'tvdb', reason: 'invalid_response' },
      { ids: both, responses: [bucket(42, '042')], method: 'tvdb', reason: 'duplicate_external_results' },
      { ids: both, responses: [bucket(), bucket()], expectedId: 999, method: 'title', reason: 'exact_title_year_match' },
      { ids: both, responses: [new Error('private provider diagnostic')], method: 'tvdb', reason: 'provider_unavailable' },
      { ids: both, responses: [bucket(42), new Error('private provider diagnostic')], method: 'imdb', reason: 'provider_unavailable' },
      { ids: both, responses: [bucket(42), bucket()], method: 'external_ids', reason: 'incomplete_external_evidence' },
      { ids: both, omdb: { type: 'series', imdbID: '' }, responses: [], method: 'external_ids', reason: 'invalid_external_id' },
      { ids: both, omdb: { type: 'series', imdbId: 'tt999' }, responses: [], method: 'external_ids', reason: 'conflicting_external_ids' },
      { type: 'movie', ids: { imdb_id: 'tt456' }, responses: [{ movie_results: [{ id: 111 }], tv_results: [{ id: 222 }] }],
        expectedId: 111, method: 'imdb', reason: 'external_id_match' },
    ];
    const query = (text, values) => client.query(text, values);
    const logger = { info() {}, warn() {}, debug() {}, error() {} };
    for (const [index, item] of cases.entries()) {
      const id = index + 1;
      const type = item.type || 'tv';
      const title = `External fixture ${id}`;
      await query('INSERT INTO libraries VALUES ($1, $2)', [id, 'Fixture source']);
      await query('INSERT INTO media_server_items (id, media_type, library_id, title, year, imdb_id, tvdb_id) VALUES ($1, $2, $1, $3, 2001, $4, $5)', [id, type, title, item.ids.imdb_id ?? null, item.ids.tvdb_id ?? null]);
      let externalCalls = 0;
      let titleCalls = 0;
      const tmdb = new QueueTmdbResolutionService({ logger, queryWithTimeout: query, tmdbService: {
        findIdentityByExternalId: async () => {
          const response = item.responses[externalCalls++];
          if (response instanceof Error) throw response;
          return response;
        },
        searchIdentityCandidates: async () => {
          titleCalls++;
          return { page: 1, total_pages: 1, total_results: 1, results: [{ id: 999, name: title, first_air_date: '2001-01-01' }] };
        },
      } });
      const completions = [];
      const deps = {
        db: { query }, logger, queryWithTimeout: query,
        metadataEnrichment: { hasWebSearchEnrichmentMetadata: () => false },
        enrichmentItemStateService: { markProcessing: async () => {}, syncItemState: async () => {} },
        resolveSourceLibraryName: async (_id, name) => name,
        queueOmdbEnrichmentService: { enrich: async (_payload, data) => { if (item.omdb) data.omdb = { data: item.omdb }; } },
        queueWebSearchEnrichmentService: { enrich: async () => {} },
        queueTmdbResolutionService: tmdb,
        queueInventoryTmdbEnrichmentService: { enrich: async () => false },
        queueClassificationHistoryService: new QueueClassificationHistoryService({ db: { query }, logger }),
        completeTask: async (_id, result) => completions.push(result),
      };
      const task = { id, payload: { itemId: id, media_type: type, title, year: 2001, ...item.ids } };
      await processMetadataEnrichmentTask(task, deps);
      const stored = (await query('SELECT tmdb_id, metadata FROM media_server_items WHERE id = $1', [id])).rows[0];
      assert.equal(stored.tmdb_id, item.expectedId ?? null);
      assert.deepEqual(stored.metadata.tmdb_resolution, {
        version: 1, status: item.expectedId ? 'resolved' : 'review_required', method: item.method, reason: item.reason,
      });
      const history = (await query('SELECT tmdb_id, media_type, method FROM classification_history WHERE library_id = $1', [id])).rows;
      assert.deepEqual(history, [{ tmdb_id: item.expectedId ?? null, media_type: type, method: 'source_library' }]);
      assert.equal(externalCalls, item.responses.length);
      assert.equal(titleCalls, item.method === 'title' ? 1 : 0);
      assert.equal(completions[0].enriched, true);

      if (item.reason === 'ambiguous_external_id') {
        // An independently established source ID may later clear review without reusing ambiguous evidence.
        await query('UPDATE media_server_items SET tmdb_id = 880 WHERE id = $1', [id]);
        await processMetadataEnrichmentTask(task, deps);
        const receipt = (await query('SELECT metadata FROM media_server_items WHERE id = $1', [id])).rows[0].metadata.tmdb_resolution;
        assert.deepEqual(receipt, { version: 1, status: 'resolved', method: 'existing_id', reason: 'identifier_available' });
        assert.equal(externalCalls, item.responses.length);
        assert.equal(titleCalls, 0);
      }
    }
    return { cases: 13, resolved: 4, reviewRequired: 9, uncertaintyBlocksTitle: true, knownIdClearsReview: true };
  } finally {
    await client.query('ROLLBACK');
  }
}
