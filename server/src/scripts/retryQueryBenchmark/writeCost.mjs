/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { requireRetryBenchmarkSchema } from './schema.mjs';
import { measureRetryQuery } from './measurement.mjs';

/** Bounded synthetic writes only; each EXPLAIN and index removal is rolled back. */
export async function measureRetryIndexWriteCost(db) {
  await requireRetryBenchmarkSchema(db);
  const indexBytes = Number((await db.query("SELECT pg_relation_size('retry_query_benchmark.idx_enrichment_retry_wait_provenance') AS bytes")).rows[0].bytes);
  const measurements = [];
  for (const strategy of ['without_wait_index','with_wait_index']) {
    await db.query('SAVEPOINT retry_benchmark_write_index');
    try {
      if (strategy === 'without_wait_index') await db.query('DROP INDEX retry_query_benchmark.idx_enrichment_retry_wait_provenance');
      for (const [operation,assignment] of [
        ['record_wait', `next_attempt_at=statement_timestamp()+interval '1 day',
          retry_wait_until=statement_timestamp()+interval '1 day',
          retry_wait_context=jsonb_build_array(jsonb_build_object('providerKey',
            CASE WHEN enrichment_type='omdb' THEN 'omdb' ELSE 'tavily' END,
            'source',CASE WHEN enrichment_type='omdb' THEN 'omdb' ELSE 'web_search' END,
            'id',1,'generation','00000000-0000-4000-8000-000000000001'))`],
        ['clear_wait', 'retry_wait_context=NULL,retry_wait_until=NULL'],
        ['claim_status', "status='processing'"],
      ]) {
        const repetitions = [];
        for (let repeat=0;repeat<3;repeat++) repetitions.push(await measureRetryQuery(db, {
          sql:`UPDATE retry_query_benchmark.enrichment_retry_queue SET ${assignment} WHERE id<=1000 RETURNING id`, params:[],
        }));
        measurements.push({strategy,operation,repetitions});
      }
    } finally {
      await db.query('ROLLBACK TO SAVEPOINT retry_benchmark_write_index');
      await db.query('RELEASE SAVEPOINT retry_benchmark_write_index');
    }
  }
  return { indexBytes, maxRowsPerWrite:1000, measurements };
}
