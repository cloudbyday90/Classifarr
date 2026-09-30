/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isDeepStrictEqual } from 'node:util';
import { installRetryBenchmarkSchema, installRetryBenchmarkCandidateIndex } from './schema.mjs';
import { seedRetryBenchmark, expectedRetryIds, expectedRetryReadinessIds, RETRY_BENCHMARK_SCENARIOS, RETRY_BENCHMARK_TYPES } from './fixture.mjs';
import { captureRetryBenchmarkQuery } from './queries.mjs';
import { measureRetryQuery, readRetryQueryIds, retryQueryFingerprint } from './measurement.mjs';

export async function runRetryQueryMeasurements(db, { size = 100000 } = {}) {
  if (!Number.isSafeInteger(size) || size < 300 || size > 300000) throw new RangeError('Invalid retry benchmark size');
  const measurements = [];
  const settings = (await db.query(`SELECT name,setting,unit FROM pg_settings WHERE name IN
    ('jit','jit_above_cost','work_mem','shared_buffers','random_page_cost','effective_cache_size','max_parallel_workers_per_gather') ORDER BY name`)).rows;
  let schema;
  for (const scenario of RETRY_BENCHMARK_SCENARIOS) {
    await db.query('BEGIN');
    try {
      await db.query("SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='30s'; SET LOCAL transaction_timeout='4min'");
      schema = await installRetryBenchmarkSchema(db);
      const rowCount = await seedRetryBenchmark(db, scenario, size);
      const after = Math.floor(size*0.9);
      const cursor = { priority: 5, queue_id: after,
        retry_created_at: new Date(Date.UTC(2026,0,1) + after*1000).toISOString() };
      const queries = [];
      for (const type of RETRY_BENCHMARK_TYPES) {
        const candidateId = expectedRetryIds(scenario, size, type, 0, 1)[0] ?? 1;
        for (const operation of ['page', 'deep_page', 'readiness', 'claim', 'claim_by_id']) {
          queries.push({ type, operation, query: await captureRetryBenchmarkQuery(operation, type,
            operation === 'deep_page' ? cursor : null, candidateId) });
        }
      }
      let indexBytes = 0;
      for (const strategy of ['current', 'pending_order_index']) {
        if (strategy === 'pending_order_index') indexBytes = await installRetryBenchmarkCandidateIndex(db);
        for (const { type, operation, query } of queries) {
          const actual = await readRetryQueryIds(db, query);
          const expected = operation === 'readiness'
            ? expectedRetryReadinessIds(scenario, size, type)
            : expectedRetryIds(scenario, size, type, operation === 'deep_page' ? after : 0, operation.startsWith('claim') ? 1 : 50);
          if (!isDeepStrictEqual(actual, expected)) throw new Error(`Retry benchmark correctness mismatch: ${scenario}/${type}/${operation}`);
          // Warmed repetitions; do not label these as cold-cache or latency SLO evidence.
          const repetitions = [];
          for (let repeat = 0; repeat < 3; repeat++) repetitions.push(await measureRetryQuery(db, query));
          measurements.push({ scenario, rowCount, strategy, indexBytes, type, operation,
            querySha256: retryQueryFingerprint(query.sql), resultCount: actual.length, exactIdsVerified: true, repetitions });
        }
      }
      const { rows: [claims] } = await db.query("SELECT count(*)::integer AS count FROM enrichment_retry_queue WHERE status='processing' OR claim_token IS NOT NULL");
      if (claims.count !== 0) throw new Error('Retry benchmark claim rollback failed');
    } finally { await db.query('ROLLBACK'); }
  }
  const { rows: [remaining] } = await db.query("SELECT to_regnamespace('retry_query_benchmark') IS NULL AS clean");
  if (remaining.clean !== true) throw new Error('Retry benchmark schema rollback failed');
  return { version: 1, kind: 'synthetic_retry_query_comparison', schema, settings, measurements, rollbackVerified: true,
    providerRequests: 0, productionChanges: 0,
    limitations: ['warm_cache', 'synthetic_distributions', 'no_concurrent_writers', 'foreign_keys_and_triggers_not_installed',
      'not_provider_admission_or_http_latency', 'ordered_index_is_offline_only'] };
}
