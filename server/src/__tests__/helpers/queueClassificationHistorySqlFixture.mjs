/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import assert from 'node:assert/strict';
import { QueueClassificationHistoryService } from '../../services/queueClassificationHistoryService.mjs';

/** Real SQL regression: every fixture write uses connection-local temporary tables. */
export async function verifyQueueClassificationHistorySql(client) {
  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TEMP TABLE libraries (id integer PRIMARY KEY) ON COMMIT DROP;
      CREATE TEMP TABLE classification_history (
        tmdb_id integer, media_type varchar(10) NOT NULL, title varchar(500) NOT NULL,
        year integer, library_id integer REFERENCES libraries(id), status text,
        confidence numeric(5,2), method text, reason text, metadata jsonb,
        director_name text, primary_studio_name text, genre_names text[],
        cast_ids integer[], cast_names text[]
      ) ON COMMIT DROP;
      INSERT INTO libraries VALUES (1), (2);
    `);
    const warnings = [];
    const svc = new QueueClassificationHistoryService({
      db: { query: (text, values) => client.query(text, values) },
      logger: { warn: (_message, details) => warnings.push(details.reason) },
    });
    const persist = (mediaType, tmdbId, title = 'Shared title', libraryId = 1) => svc.persist({
      title, year: 2001, media: { media_type: mediaType },
      director_name: 'Director', genres: ['Drama'], cast: [{ id: 7, name: 'Actor' }],
    }, tmdbId, libraryId, 'Source', 'fixture');

    // The same numeric ID in movie and TV namespaces represents separate items.
    await persist('movie', 42);
    await persist('tv', 42);
    await persist(' TV ', '0042');
    await persist('tv', 42, 'Shared title', 2);
    const idRows = (await client.query(`
      SELECT media_type, library_id FROM classification_history
      WHERE tmdb_id = 42 ORDER BY library_id, media_type
    `)).rows;
    assert.deepEqual(idRows, [
      { media_type: 'movie', library_id: 1 },
      { media_type: 'tv', library_id: 1 },
      { media_type: 'tv', library_id: 2 },
    ]);

    // Known-ID rows cannot suppress the null-ID fallback, which also needs type.
    await persist('movie', null);
    await persist('tv', undefined);
    await persist('tv', null);
    await persist('tv', null, 'Shared title', 2);
    const titleRows = (await client.query(`
      SELECT media_type, library_id FROM classification_history
      WHERE tmdb_id IS NULL ORDER BY library_id, media_type
    `)).rows;
    assert.deepEqual(titleRows, idRows);

    // Non-source history does not prevent recording an authoritative source item.
    await client.query(`INSERT INTO classification_history
      (tmdb_id, media_type, title, library_id, method)
      VALUES (43, 'movie', 'Other method', 1, 'manual')`);
    await persist('movie', 43, 'Other method');
    assert.equal((await client.query(`SELECT COUNT(*)::integer AS count
      FROM classification_history WHERE tmdb_id = 43`)).rows[0].count, 2);

    // Exact fallback titles are bound data, including SQL-looking punctuation.
    const literalTitle = "Title'); DROP TABLE classification_history; --";
    await persist('tv', null, literalTitle);
    await persist('tv', null, literalTitle);
    assert.equal((await client.query(`SELECT COUNT(*)::integer AS count
      FROM classification_history WHERE title = $1`, [literalTitle])).rows[0].count, 1);

    const graphRow = (await client.query(`SELECT director_name, genre_names, cast_ids,
      cast_names, confidence, status, method, metadata->>'title' AS metadata_title
      FROM classification_history WHERE tmdb_id = 42 AND media_type = 'tv' AND library_id = 1`)).rows[0];
    assert.deepEqual({ ...graphRow, confidence: Number(graphRow.confidence) }, {
      director_name: 'director', genre_names: ['Drama'], cast_ids: [7], cast_names: ['Actor'],
      confidence: 100, status: 'completed', method: 'source_library', metadata_title: 'Shared title',
    });

    const beforeInvalid = (await client.query('SELECT COUNT(*)::integer AS count FROM classification_history')).rows[0].count;
    await persist(undefined, 44);
    await persist('person', 44);
    await persist('tv', 0);
    await persist('tv', '');
    await svc.persist({ title: 'Conflict', media_type: 'movie', media: { media_type: 'tv' } }, 44, 1, 'Source');
    await persist('tv', 44, 'Missing library', 999);
    assert.equal((await client.query('SELECT COUNT(*)::integer AS count FROM classification_history')).rows[0].count, beforeInvalid);
    assert.deepEqual(warnings, [
      ...Array(5).fill('invalid_media_identity'), 'library_unavailable',
    ]);

    // Prove the old untyped predicates would suppress these distinct identities.
    const legacyIdCount = (await client.query(`SELECT COUNT(*)::integer AS count FROM classification_history
      WHERE tmdb_id = 42 AND library_id = 1 AND method = 'source_library'`)).rows[0].count;
    const legacyTitleCount = (await client.query(`SELECT COUNT(*)::integer AS count FROM classification_history
      WHERE title = 'Shared title' AND tmdb_id IS NULL AND library_id = 1 AND method = 'source_library'`)).rows[0].count;
    assert.equal(legacyIdCount, 2);
    assert.equal(legacyTitleCount, 2);
    return { typedIdRows: idRows.length, typedTitleRows: titleRows.length, rejectedInputs: warnings.length, graphPreserved: true };
  } finally {
    await client.query('ROLLBACK');
  }
}
