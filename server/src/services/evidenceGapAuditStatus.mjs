/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { GAP_AUDIT_DEFERRALS, GAP_AUDIT_FAILURES, gapAuditTime, readEvidenceGapAuditReport } from './evidenceGapAuditContract.mjs';
import { READ_GAP_AUDIT_STATUS_SQL } from './evidenceGapAuditSql.mjs';

const time = value => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() :
  gapAuditTime(value) ? value : null;
export function projectEvidenceGapAuditStatus(row, checkedAt) {
  const checked = time(checkedAt);
  if (!checked) throw new Error('evidence_gap_audit_invalid_clock');
  const base = { version: 'evidence_gap_audit_status.v1', status: 'never_run', reason: null,
    checkedAt: checked, observedAt: null, nextCheckAt: null, report: null };
  if (!row) return base;
  const observed = time(row.observed_at), next = time(row.next_check_at);
  if (!observed || observed > checked || !next || next <= observed || Date.parse(next) > Date.parse(checked) + 60 * 60000) {
    return { ...base, status: 'invalid' };
  }
  Object.assign(base, { observedAt: observed, nextCheckAt: next });
  if (row.status === 'failed' && GAP_AUDIT_FAILURES.includes(row.failure_code)) return { ...base,
    status: GAP_AUDIT_DEFERRALS.includes(row.failure_code) ? 'deferred' : 'failed', reason: row.failure_code };
  if (row.status !== 'complete') return { ...base, status: 'invalid' };
  if (Date.parse(checked) - Date.parse(observed) >= 15 * 60000) return { ...base, status: 'stale' };
  const report = readEvidenceGapAuditReport(row.report);
  return report?.window.until === observed ? { ...base, status: 'complete', report } : { ...base, status: 'invalid' };
}

/** Saved state only. Never invoke source readers, admission, pruning or the worker here. */
export async function readEvidenceGapAuditStatus(database, { signal = new AbortController().signal } = {}) {
  return database.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout='3s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='5s'");
    const checkedAt = (await client.query("SELECT date_trunc('milliseconds',statement_timestamp()) AS checked_at")).rows[0]?.checked_at;
    const installed = (await client.query("SELECT to_regclass('public.automatic_evidence_gap_audit') IS NOT NULL AS installed")).rows[0]?.installed;
    if (installed !== true) return { ...projectEvidenceGapAuditStatus(null, checkedAt), status: 'unavailable' };
    const row = (await client.query(READ_GAP_AUDIT_STATUS_SQL)).rows[0];
    return projectEvidenceGapAuditStatus(row, checkedAt);
  }, { signal, readOnly: true, timeoutMs: 5000, isolationLevel: 'repeatable_read' });
}
