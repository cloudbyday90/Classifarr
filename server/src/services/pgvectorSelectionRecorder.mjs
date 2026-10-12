/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createPgvectorSelectionReport, PGVECTOR_REPORT_KEY, pgvectorReporterId } from './pgvectorSelectionReport.mjs';

export async function recordPgvectorSelection({ db, environment, cpu, reporterId = pgvectorReporterId, now = new Date() }) {
  // Diagnostic context only. If unavailable, retain the report without claiming freshness.
  let databaseStartedAt = null;
  try {
    databaseStartedAt = (await db.query('SELECT pg_postmaster_start_time() AS started_at')).rows[0]?.started_at;
  } catch { /* Persistence below still has to succeed. */ }
  const report = createPgvectorSelectionReport({ environment, cpu, reporterId, now, databaseStartedAt });
  const entries = [
    ['avx_guard_last_run', report.recordedAt], ['avx_guard_cpu_avx', report.cpuAvx],
    ['avx_guard_cpu_avx2', report.cpuAvx2], ['avx_guard_pgvector_build', report.build],
    ['avx_guard_pgvector_selected', report.selectedVariant], [PGVECTOR_REPORT_KEY, JSON.stringify(report)],
  ];
  try {
    await db.query(`INSERT INTO settings (key, value)
      SELECT * FROM unnest($1::text[], $2::text[])
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [entries.map(([key]) => key), entries.map(([, value]) => value)]);
  } catch (error) {
    if (error.code === '42P01') return { action: 'unavailable', report: null };
    throw error;
  }
  return { action: 'recorded', report };
}
