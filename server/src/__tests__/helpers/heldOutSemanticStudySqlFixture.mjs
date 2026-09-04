/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import assert from 'node:assert/strict';
import { createHeldOutSemanticStudyScope, applyHeldOutSemanticStudyQuerySettings } from '../../services/heldOutSemanticStudyScope.mjs';
import { buildCurrentLibraryCandidateSemanticRetrieverQuery } from '../../services/currentLibraryCandidateSemanticRetrieverQuery.mjs';
import { executeSemanticVectorSearch } from '../../services/ragRetrieverQuery.mjs';

/** Actual pgvector regression; all fixture tables are connection-local and rolled back. */
export async function verifyHeldOutSemanticStudySql(client) {
  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TEMP TABLE libraries (id integer, name text) ON COMMIT DROP;
      CREATE TEMP TABLE classification_history (
        id integer, tmdb_id integer, media_type text, library_id integer,
        title text, library_name text, status text, method text, confidence integer, created_at timestamptz
      ) ON COMMIT DROP;
      CREATE TEMP TABLE classification_embeddings (
        id integer, classification_id integer, embedding vector(3), image_embedding vector(3), is_stale boolean
      ) ON COMMIT DROP;
      CREATE TEMP TABLE media_server_items (
        id integer, tmdb_id integer, media_type text, library_id integer, title text, year integer
      ) ON COMMIT DROP;
      CREATE TEMP TABLE policy_authorized_outcome_source_event_receipts (
        classification_id integer, destination_library_id integer, final_outcome_status_id text, persistence_status_id text
      ) ON COMMIT DROP;
      INSERT INTO libraries VALUES (10, 'A'), (20, 'B');
      INSERT INTO classification_history (id,tmdb_id,media_type,library_id,title) VALUES
        (1,1,'movie',10,'self'), (2,1,'movie',20,'duplicate self'),
        (3,2,'movie',10,'cohort peer'), (4,1000,'movie',10,'legitimate'),
        (5,1,'tv',10,'TV collision'), (6,1001,'movie',20,'alternative'),
        (7,NULL,'movie',10,'unverified identity');
      INSERT INTO classification_embeddings (id,classification_id,embedding,is_stale) VALUES
        (1,1,'[1,0,0]',false), (2,2,'[1,0,0]',false), (3,2,'[1,0,0]',false),
        (4,3,'[1,0.001,0]',false), (5,4,'[1,0.1,0]',false),
        (6,5,'[1,0,0]',false), (7,6,'[1,0.2,0]',false),
        (8,7,'[1,0.001,0]',false);
      INSERT INTO media_server_items (id,tmdb_id,media_type,library_id,title,year)
        SELECT id,tmdb_id,media_type,library_id,title,2026 FROM classification_history;
    `);
    const scope = createHeldOutSemanticStudyScope(Array.from({ length: 24 }, (_, index) => ({
      media_type: 'movie', tmdb_id: index + 1,
    })));
    const request = { candidates: [{ libraryId: 10 }, { libraryId: 20 }], mediaType: 'movie', scanLimit: 1, maximumItemsPerCandidate: 3 };
    const original = buildCurrentLibraryCandidateSemanticRetrieverQuery(request, '[1,0,0]');
    assert.ok(['self', 'duplicate self'].includes((await client.query(original.text, original.values)).rows[0].title));
    await applyHeldOutSemanticStudyQuerySettings(client, scope);
    const heldOut = buildCurrentLibraryCandidateSemanticRetrieverQuery(request, '[1,0,0]', scope);
    const rows = (await client.query(heldOut.text, heldOut.values)).rows;
    assert.deepEqual(rows.map((row) => row.title), ['legitimate']);
    const wider = buildCurrentLibraryCandidateSemanticRetrieverQuery({ ...request, scanLimit: 20 }, '[1,0,0]', scope);
    assert.deepEqual((await client.query(wider.text, wider.values)).rows.map((row) => row.title), ['legitimate', 'alternative']);

    const result = await executeSemanticVectorSearch({ withTransaction: (work) => work(client) }, {
      vectorString: '[1,0,0]', imageVectorString: null, textWeight: 1, imageWeight: 0,
      candidateLimit: 3, limit: 3, heldOutScope: scope,
    });
    assert.deepEqual(result.rows.map((row) => row.title), ['TV collision', 'legitimate', 'alternative']);
    assert.equal((await client.query('SHOW enable_indexscan')).rows[0].enable_indexscan, 'off');
    return { currentInventoryBeforeLimit: true, duplicateEmbeddingsExcluded: true, fullCohortExcluded: true, pairedMediaIdentity: true, legitimateNeighborsRetained: true };
  } finally {
    await client.query('ROLLBACK');
  }
}
