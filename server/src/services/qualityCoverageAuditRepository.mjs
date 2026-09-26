/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildQualityCoverageAudit } from './qualityCoverageAudit.mjs';

const required = Object.freeze({
  study: { table: 'quality_evidence_study', columns: ['protocol_id', 'protocol', 'evidence', 'status', 'created_at', 'expires_at'] },
  cache: { table: 'cached_adjudication_batch', columns: ['batch', 'captured_at', 'expires_at'] },
  evaluation: { table: 'automatic_source_pair_evaluation', columns: ['cohort', 'cohort_created_at'] },
  budget: { table: 'adjudication_capture_budget', columns: ['daily_calls'] },
});
export const qualityAuditCapabilities = rows => Object.fromEntries(Object.entries(required).map(([key, value]) => [key,
  value.columns.every(column => rows.some(row => row.table_name === value.table && row.column_name === column))]));
export async function readQualityCoverageAudit(database, { signal, reference = null } = {}) {
  return database.withTransaction(async client => {
    signal?.throwIfAborted();
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='15s'");
    const { rows: [clock] } = await client.query('SELECT transaction_timestamp()::text AS observed_at');
    const { rows } = await client.query(`SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name,column_name LIMIT 256`, [Object.values(required).map(row => row.table)]);
    const capabilities = qualityAuditCapabilities(rows);
    const input = { observedAt: clock.observed_at, capabilities };
    if (Object.values(capabilities).every(Boolean)) {
      // Deliberately do not use repositories whose read methods seed, prune or reset rows.
      const study = await client.query(`SELECT protocol_id,protocol,evidence,status,created_at::text,expires_at::text
        FROM public.quality_evidence_study LIMIT 2`);
      if (study.rows.length > 1) throw new Error('quality_audit_invalid');
      input.study = study.rows[0] ?? null;
      const budget = await client.query('SELECT daily_calls FROM public.adjudication_capture_budget LIMIT 2');
      const diagnostic = await client.query('SELECT cohort,cohort_created_at::text FROM public.automatic_source_pair_evaluation LIMIT 2');
      const cache = await client.query(`SELECT captured_at::text,expires_at::text,
        CASE WHEN jsonb_typeof(batch->'records')='array' THEN jsonb_array_length(batch->'records') END AS responses
        FROM public.cached_adjudication_batch LIMIT 2`);
      if ([budget, diagnostic, cache].some(result => result.rows.length > 1)) throw new Error('quality_audit_invalid');
      input.budget = budget.rows[0] ?? null; input.diagnostic = diagnostic.rows[0] ?? null; input.cache = cache.rows[0] ?? null;
    }
    signal?.throwIfAborted();
    return buildQualityCoverageAudit(input, reference);
  });
}
