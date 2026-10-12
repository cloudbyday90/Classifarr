/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { PGVECTOR_REPORT_KEY, presentPgvectorSelection, normalizePgvectorTimestamp } from './pgvectorSelectionReport.mjs';

export async function readPgvectorStatus(db, context = {}) {
  const result = await db.query(`SELECT key, value, pg_postmaster_start_time() AS database_started_at
    FROM settings WHERE key IN ('avx_guard_pgvector_selected', 'avx_guard_pgvector_build',
      'avx_guard_cpu_avx', 'avx_guard_cpu_avx2', 'avx_guard_last_run', $1)`, [PGVECTOR_REPORT_KEY]);
  const entries = new Map(result.rows.map(row => [row.key, row.value]));
  const selection = presentPgvectorSelection(entries.get(PGVECTOR_REPORT_KEY), {
    ...context, databaseStartedAt: result.rows[0]?.database_started_at,
  });
  if (selection.status === 'current_process' && (
    entries.get('avx_guard_pgvector_selected') !== selection.report.selectedVariant
    || entries.get('avx_guard_pgvector_build') !== selection.report.build
    || entries.get('avx_guard_cpu_avx') !== selection.report.cpuAvx
    || entries.get('avx_guard_cpu_avx2') !== selection.report.cpuAvx2
    || normalizePgvectorTimestamp(entries.get('avx_guard_last_run')) !== selection.report.recordedAt)) {
    selection.status = 'settings_changed';
  }
  return {
    pgvectorVariant: entries.get('avx_guard_pgvector_selected') ?? null,
    pgvectorBuild: entries.get('avx_guard_pgvector_build') ?? null,
    cpuAvx: entries.get('avx_guard_cpu_avx') ?? null,
    cpuAvx2: entries.get('avx_guard_cpu_avx2') ?? null,
    lastChecked: entries.get('avx_guard_last_run') ?? null,
    pgvectorSelection: selection,
  };
}
