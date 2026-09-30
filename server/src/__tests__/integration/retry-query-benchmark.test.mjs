/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { runRetryQueryMeasurements } from '../../scripts/retryQueryBenchmark/runner.mjs';
import { installRetryBenchmarkSchema } from '../../scripts/retryQueryBenchmark/schema.mjs';
import { captureRetryBenchmarkQuery } from '../../scripts/retryQueryBenchmark/queries.mjs';
import { seedRetryBenchmark, expectedRetryIds } from '../../scripts/retryQueryBenchmark/fixture.mjs';

test('real PostgreSQL compares all distributions, providers, page shapes and claims with exact IDs and rollback', async () => {
  const db = await getPool().connect();
  try {
    const report = await runRetryQueryMeasurements(db, { size: 300 });
    expect(report.measurements).toHaveLength(432);
    expect(report.measurements.every(result => result.exactIdsVerified && result.repetitions.length === 3)).toBe(true);
    expect(report).toMatchObject({ rollbackVerified: true, providerRequests: 0, productionChanges: 0 });
    expect(JSON.stringify(report)).not.toMatch(/synthetic-only|Synthetic item|claim_token|Filter|Index Cond/);
    expect((await db.query('SELECT count(*)::integer n FROM public.enrichment_retry_queue')).rows[0].n).toBe(0);
  } finally { db.release(); }
});

test('readiness candidate flags agree with the fixture oracle without claiming or mutating rows', async () => {
  const db = await getPool().connect();
  await db.query('BEGIN');
  try {
    await installRetryBenchmarkSchema(db);
    await seedRetryBenchmark(db, 'mixed', 300);
    for (const type of ['omdb', 'web_search', 'tavily']) {
      const { sql, params } = await captureRetryBenchmarkQuery('readiness', type);
      const rows = (await db.query(sql, params)).rows;
      const eligible = new Set(expectedRetryIds('mixed',300,type));
      for (const row of rows) expect(row.candidate).toBe(eligible.has(row.queue_id));
    }
    expect((await db.query("SELECT count(*)::integer n FROM enrichment_retry_queue WHERE status='processing'")).rows[0].n).toBe(0);
  } finally { await db.query('ROLLBACK'); db.release(); }
});
