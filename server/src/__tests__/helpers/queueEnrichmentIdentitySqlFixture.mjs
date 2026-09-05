/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import assert from 'node:assert/strict';
import { QueueRefillService } from '../../services/queueRefillService.mjs';
import { QueueTmdbResolutionService } from '../../services/queueTmdbResolutionService.mjs';
import { QueueOmdbEnrichmentService } from '../../services/queueOmdbEnrichmentService.mjs';
import { QueueClassificationHistoryService } from '../../services/queueClassificationHistoryService.mjs';
import { processMetadataEnrichmentTask } from '../../services/queueTaskProcessorEnrichment.mjs';

/** Runs real queue services and SQL with stubbed providers; only TEMP tables are written. */
export async function verifyQueueEnrichmentIdentitySql(client) {
  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TEMP TABLE libraries (id integer PRIMARY KEY, name text, media_type text) ON COMMIT DROP;
      CREATE TEMP TABLE media_server_items (
        id integer PRIMARY KEY, media_type text, tmdb_id integer, tvdb_id integer, imdb_id text,
        library_id integer, title text, year integer, metadata jsonb DEFAULT '{}',
        genres jsonb, tags jsonb, content_rating text, original_rating text
      ) ON COMMIT DROP;
      CREATE TEMP TABLE task_queue (task_type text, status text, payload jsonb) ON COMMIT DROP;
      CREATE TEMP TABLE omdb_config (is_active boolean, api_key text) ON COMMIT DROP;
      CREATE TEMP TABLE classification_history (
        tmdb_id integer, media_type text, title text, year integer, library_id integer,
        status text, confidence integer, method text, reason text, metadata jsonb,
        director_name text, primary_studio_name text, genre_names text[], cast_ids integer[], cast_names text[]
      ) ON COMMIT DROP;
      INSERT INTO libraries VALUES (1, 'Source', 'movie');
      INSERT INTO omdb_config VALUES (true, 'fixture-only');
      INSERT INTO media_server_items (id, media_type, library_id, title, year) VALUES
        (1, 'movie', 1, 'Shared title', 2001), (2, 'tv', 1, 'Shared title', 2001),
        (3, NULL, 1, 'Unknown type', 2001), (4, 'tv', 1, 'Changing source', 2001);
    `);
    const query = (text, values) => client.query(text, values);
    const logger = { info() {}, warn() {}, debug() {}, error() {} };
    const refill = new QueueRefillService({ db: { query }, logger });
    const candidates = await refill.selectRefillCandidates();
    assert.deepEqual(candidates.map((row) => row.id).sort(), [1, 2, 4]);
    const movie = refill.buildMetadataEnrichmentPayload(candidates.find((row) => row.id === 1));
    const tv = refill.buildMetadataEnrichmentPayload(candidates.find((row) => row.id === 2));
    assert.equal(tv.media.media_type, 'tv'); // Source item wins over movie library type.
    const providerTypes = [];
    const omdb = new QueueOmdbEnrichmentService({ db: { query }, logger, queryWithTimeout: query,
      omdbService: { getByTitle: async (_title, _year, type) => {
        providerTypes.push(type);
        return { type: type === 'tv' ? 'series' : 'movie', imdbId: 'tt1234', rated: 'PG' };
      } },
    });
    let drift = false;
    let findCalls = 0;
    const tmdb = new QueueTmdbResolutionService({ logger, queryWithTimeout: query, tmdbService: {
      findByExternalId: async (id, source) => {
        assert.equal(id, 'tt1234'); assert.equal(source, 'imdb_id');
        findCalls++;
        if (drift) await query("UPDATE media_server_items SET media_type = 'movie' WHERE id = 4");
        return { movie_results: [{ id: 111 }], tv_results: [{ id: 222 }] };
      },
      searchIdentityCandidates: async () => { throw new Error('Normalized OMDb IMDb ID should avoid title search'); },
    } });
    const completions = [];
    const deps = {
      db: { query }, logger,
      metadataEnrichment: { hasWebSearchEnrichmentMetadata: () => false },
      enrichmentItemStateService: { markProcessing: async () => {}, syncItemState: async () => {} },
      resolveSourceLibraryName: async (_id, name) => name,
      queueOmdbEnrichmentService: omdb,
      queueWebSearchEnrichmentService: { enrich: async () => {} },
      queueTmdbResolutionService: tmdb,
      queueClassificationHistoryService: new QueueClassificationHistoryService({ db: { query }, logger }),
      queryWithTimeout: query,
      completeTask: async (_id, result) => completions.push(result),
    };
    await processMetadataEnrichmentTask({ id: 1, payload: movie }, deps);
    await processMetadataEnrichmentTask({ id: 2, payload: tv }, deps);
    assert.deepEqual(providerTypes, ['movie', 'tv']);
    assert.equal(findCalls, 2);
    assert.deepEqual((await query('SELECT media_type, tmdb_id FROM classification_history ORDER BY media_type')).rows,
      [{ media_type: 'movie', tmdb_id: 111 }, { media_type: 'tv', tmdb_id: 222 }]);
    assert.equal(completions.every((result) => result.enriched), true);

    await processMetadataEnrichmentTask({ id: 3, payload: { ...tv, media: { media_type: 'movie' } } }, deps);
    assert.equal(providerTypes.length, 2);
    assert.equal(completions.at(-1).reason, 'invalid_media_identity');

    drift = true;
    const changing = refill.buildMetadataEnrichmentPayload(candidates.find((row) => row.id === 4));
    await processMetadataEnrichmentTask({ id: 4, payload: changing }, deps);
    assert.equal(completions.at(-1).reason, 'source_identity_changed');
    assert.equal((await query('SELECT tmdb_id FROM media_server_items WHERE id = 4')).rows[0].tmdb_id, null);
    assert.equal((await query('SELECT COUNT(*)::integer AS count FROM classification_history')).rows[0].count, 2);

    // Direct writes retain the type guard and never overwrite an existing ID.
    await tmdb.backfillTmdbId(3, 999, 'tv');
    await tmdb.backfillTmdbId(2, 999, 'tv');
    await omdb.maybeBackfillRating(1, { type: 'series', rated: 'TV-MA' }, 'tv');
    const stored = (await query('SELECT id, tmdb_id, content_rating FROM media_server_items ORDER BY id')).rows;
    assert.equal(stored[0].content_rating, 'PG');
    assert.equal(stored[1].tmdb_id, 222);
    assert.equal(stored[2].tmdb_id, null);
    return { typedHistoryRows: 2, sourceTypePreserved: true, staleTaskSkipped: true, guardedBackfills: true };
  } finally {
    await client.query('ROLLBACK');
  }
}
