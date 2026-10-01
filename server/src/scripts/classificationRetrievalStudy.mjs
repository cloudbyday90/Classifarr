/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertStudyProviderEnvironment } from './resourceStudyProviderFixture.mjs';
import { buildSemanticVectorSearchQuery, executeSemanticVectorSearch, mapSearchResults } from '../services/ragRetrieverQuery.mjs';
import { applyPgvectorRecallSettings, resolvePgvectorRecallTuning } from '../services/pgvectorRecallTuning.mjs';
import { summarizeSemanticStudyPlan } from './classificationRetrievalStudyContract.mjs';

/** Only the fresh synthetic cohort created by the enclosing mixed-load study. */
export async function prepareClassificationRetrievalStudy(db, libraries) {
  assertStudyProviderEnvironment();
  assert.equal(libraries.length, 4);
  const cohort = (await db.query(`SELECT count(*)::integer n, count(embedding)::integer populated,
    min(id)::integer first, max(id)::integer last FROM classification_embeddings`)).rows[0];
  assert.deepEqual(cohort, { n: 50000, populated: 0, first: 1, last: 50000 });
  assert.equal((await db.query(`SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute
    WHERE attrelid='classification_embeddings'::regclass AND attname='embedding'`)).rows[0].type, 'vector(1024)');
  for (let start = 1; start <= 50000; start += 100) {
    await db.query(`UPDATE classification_embeddings SET embedding=ARRAY(
      SELECT sin(id::double precision*d+d::double precision*d*0.13)::real
      FROM generate_series(1,1024) d)::public.vector, is_stale=false WHERE id BETWEEN $1 AND $2`, [start, start + 99]);
    // Status changes invoke per-row totals/search triggers. Bound their transaction
    // size just like vector writes; do not extend the database statement deadline.
    await db.query(`UPDATE classification_history ch SET library_id=l.id, media_type=l.media_type, status='completed'
      FROM classification_embeddings ce, libraries l WHERE ch.id=ce.classification_id
      AND l.id=($1::integer[])[(ce.id % 4)+1] AND ce.id BETWEEN $2 AND $3`,
    [libraries.map(row => row.id), start, start + 99]);
  }
  await db.query('ANALYZE classification_embeddings; ANALYZE classification_history; ANALYZE libraries');
  const options = { vectorString: JSON.stringify(Array.from({ length: 1024 }, (_, i) => Math.sin(i + 1))),
    imageVectorString: JSON.stringify(Array.from({ length: 2000 }, (_, i) => Math.sin(i + 1))),
    textWeight: 0.7, imageWeight: 0.3, candidateLimit: 50, limit: 5, recallTuning: resolvePgvectorRecallTuning() };
  return function createSession(reader) {
    let queries = 0, imageScoredRows = 0, plan;
    const transaction = async work => {
      await reader.query('BEGIN READ ONLY');
      try { const result = await work(reader); await reader.query('COMMIT'); return result; }
      catch (error) { await reader.query('ROLLBACK'); throw error; }
    };
    return {
      async measurePlan() {
        assertStudyProviderEnvironment();
        const query = buildSemanticVectorSearchQuery(options);
        plan = await transaction(async client => {
          await applyPgvectorRecallSettings(client, options.recallTuning);
          const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) ${query.text}`, query.values);
          return summarizeSemanticStudyPlan(result.rows[0]['QUERY PLAN']);
        });
      },
      async retrieve() {
        assertStudyProviderEnvironment();
        const result = await executeSemanticVectorSearch({ withTransaction: transaction }, options);
        assert.equal(result.rows.length, 5);
        for (const row of result.rows) {
          assert.equal(row.status, 'completed');
          assert([row.text_similarity, row.image_similarity, row.combined_similarity].every(Number.isFinite));
          assert(Math.abs(row.combined_similarity - (0.7 * row.text_similarity + 0.3 * row.image_similarity)) < 1e-9);
        }
        const { matches } = mapSearchResults(result.rows, { ...options, applyThreshold: false });
        assert(matches.every(row => row.status === 'completed' && row.imageSimilarity !== null));
        queries++; imageScoredRows += result.rows.length;
        return result;
      },
      receipt() { return { protocol: 'semantic_retrieval.v1', queries, imageScoredRows,
        candidateLimit: 50, resultLimit: 5, statusPreserved: true, weightedScoresVerified: true, plan }; },
    };
  };
}
