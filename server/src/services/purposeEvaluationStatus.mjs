/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { PURPOSE_EVALUATION_DEFERRALS, PURPOSE_EVALUATION_FAILURES, purposeTime, readPurposeEvaluationReport } from './purposeEvaluationContract.mjs';
import { READ_PURPOSE_EVALUATION_STATUS_SQL } from './purposeEvaluationSql.mjs';

const time = value => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() :
  purposeTime(value) ? value : null;
export function projectPurposeEvaluationStatus(row, checkedAt) {
  const checked = time(checkedAt);
  if (!checked) throw new Error('purpose_evaluation_invalid_clock');
  const base = { version: 'purpose_evaluation_status.v1', status: 'never_run', reason: null,
    checkedAt: checked, observedAt: null, nextCheckAt: null, report: null };
  if (!row) return base;
  const observed = time(row.observed_at), next = time(row.next_check_at);
  if (!observed || observed > checked || !next || next <= observed || Date.parse(next) > Date.parse(checked) + 60 * 60000) {
    return { ...base, status: 'invalid' };
  }
  Object.assign(base, { observedAt: observed, nextCheckAt: next });
  if (row.status === 'failed' && PURPOSE_EVALUATION_FAILURES.includes(row.failure_code)) return { ...base,
    status: row.failure_code === 'sources_unavailable' ? 'unavailable' : PURPOSE_EVALUATION_DEFERRALS.includes(row.failure_code) ? 'deferred' : 'failed', reason: row.failure_code };
  if (row.status !== 'complete') return { ...base, status: 'invalid' };
  if (Date.parse(checked) - Date.parse(observed) >= 15 * 60000) return { ...base, status: 'stale' };
  const report = readPurposeEvaluationReport(row.report);
  return report?.window.until === observed ? { ...base, status: 'complete', report } : { ...base, status: 'invalid' };
}

/** Saved state only. Never invoke source readers, admission, pruning or the worker here. */
export async function readPurposeEvaluationStatus(database, { signal = new AbortController().signal } = {}) {
  return database.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout='3s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='5s'");
    const checkedAt = (await client.query("SELECT date_trunc('milliseconds',statement_timestamp()) AS checked_at")).rows[0]?.checked_at;
    const installed = (await client.query("SELECT to_regclass('public.automatic_purpose_evaluation') IS NOT NULL AS installed")).rows[0]?.installed;
    if (installed !== true) return { ...projectPurposeEvaluationStatus(null, checkedAt), status: 'unavailable' };
    const row = (await client.query(READ_PURPOSE_EVALUATION_STATUS_SQL)).rows[0];
    return projectPurposeEvaluationStatus(row, checkedAt);
  }, { signal, readOnly: true, timeoutMs: 5000, isolationLevel: 'repeatable_read' });
}
