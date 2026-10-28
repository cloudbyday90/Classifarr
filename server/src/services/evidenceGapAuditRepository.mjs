/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_PROSPECTIVE_OUTCOME_SQL } from './inventoryProspectiveOutcomeRepository.mjs';
import { INVENTORY_PROSPECTIVE_ACTIVITY_SQL } from './inventoryProspectiveActivityRepository.mjs';
import { INVENTORY_MAINTENANCE_IDLE_SQL } from './inventoryBackgroundReadiness.mjs';
import { GAP_AUDIT_FAILURES, GAP_AUDIT_MAX_INPUT_BYTES, GAP_AUDIT_MAX_REPORT_BYTES,
  gapAuditTime, readEvidenceGapAuditReport } from './evidenceGapAuditContract.mjs';
import { READ_GAP_AUDIT_STATE_SQL, SAVE_GAP_AUDIT_SQL, FAIL_GAP_AUDIT_SQL } from './evidenceGapAuditSql.mjs';

// Measure the materialized, bounded projection in PostgreSQL before transferring private payloads.
export const READ_GAP_AUDIT_INPUT_SQL = `WITH audit_rows AS MATERIALIZED (${INVENTORY_PROSPECTIVE_OUTCOME_SQL}),
  budget AS (SELECT COUNT(*)::int AS captures,COALESCE(SUM(pg_column_size(to_jsonb(r))),0)::text AS payload_bytes FROM audit_rows r)
  SELECT to_jsonb(r)||jsonb_build_object('classification_id',r.classification_id::text) AS input,b.captures,b.payload_bytes
  FROM audit_rows r CROSS JOIN budget b WHERE b.captures<=5000 AND b.payload_bytes::bigint<=$3::bigint
  UNION ALL SELECT NULL,b.captures,b.payload_bytes FROM budget b
  WHERE b.captures=0 OR b.captures>5000 OR b.payload_bytes::bigint>$3::bigint`;

export function createEvidenceGapAuditRepository(database) {
  const read = (callback, signal = new AbortController().signal, timeoutMs = 15000) => database.withTransaction(async client => {
    signal?.throwIfAborted();
    await client.query("SET LOCAL statement_timeout='12s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='15s'; SET LOCAL TIME ZONE 'UTC'");
    const result = await callback(client);
    signal?.throwIfAborted(); return result;
  }, { signal, readOnly: true, timeoutMs, isolationLevel: 'repeatable_read' });
  const write = (sql, values, signal) => {
    signal?.throwIfAborted();
    return database.withTransaction(async client => {
      signal?.throwIfAborted();
      await client.query("SET LOCAL statement_timeout='3s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='5s'");
      signal?.throwIfAborted();
      const result = await client.query(sql, values);
      signal?.throwIfAborted(); return result;
    });
  };
  return {
    readState: signal => read(async client => (await client.query(READ_GAP_AUDIT_STATE_SQL)).rows[0] ?? null, signal),
    assertIdle: signal => read(async client => {
      const value = (await client.query(INVENTORY_MAINTENANCE_IDLE_SQL, [null])).rows[0]?.readiness;
      if (['ingesting', 'backfilling'].includes(value)) throw new Error('evidence_gap_audit_busy');
      if (value !== 'ready') throw new Error('evidence_gap_audit_unavailable');
    }, signal, 3000),
    readSnapshot: signal => read(async client => {
      const clock = (await client.query("SELECT date_trunc('milliseconds',transaction_timestamp()) AS observed_at")).rows[0]?.observed_at;
      const observedAt = clock instanceof Date && Number.isFinite(clock.getTime()) ? clock.toISOString() : clock;
      if (!gapAuditTime(observedAt)) throw new Error('evidence_gap_audit_invalid_clock');
      const window = { since: new Date(Date.parse(observedAt) - 30 * 86400000).toISOString(), until: observedAt };
      const params = [window.since, window.until];
      const activity = (await client.query(INVENTORY_PROSPECTIVE_ACTIVITY_SQL, params)).rows[0];
      const result = await client.query(READ_GAP_AUDIT_INPUT_SQL, [...params, GAP_AUDIT_MAX_INPUT_BYTES]);
      const header = result.rows[0];
      if (!header || !Number.isSafeInteger(header.captures) || !/^[0-9]{1,12}$/.test(header.payload_bytes)) throw new Error('evidence_gap_audit_invalid_input');
      if (header.captures > 5000 || Number(header.payload_bytes) > GAP_AUDIT_MAX_INPUT_BYTES) throw new Error('evidence_gap_audit_input_budget');
      const rows = result.rows.filter(row => row.input !== null).map(row => row.input);
      if (rows.length !== header.captures) throw new Error('evidence_gap_audit_invalid_input');
      return { observedAt, inputs: { observedAt, window, activity, rows } };
    }, signal),
    save: (fingerprint, report, observedAt, signal) => {
      if (!/^[a-f0-9]{64}$/.test(fingerprint) || !readEvidenceGapAuditReport(report) || report.window.until !== observedAt ||
          Buffer.byteLength(JSON.stringify(report)) > GAP_AUDIT_MAX_REPORT_BYTES) throw new Error('evidence_gap_audit_invalid_report');
      return write(SAVE_GAP_AUDIT_SQL, [fingerprint, JSON.stringify(report), observedAt], signal).then(result => result.rowCount === 1);
    },
    fail: (code, signal) => {
      if (!GAP_AUDIT_FAILURES.includes(code)) throw new Error('evidence_gap_audit_invalid_failure');
      return write(FAIL_GAP_AUDIT_SQL, [code], signal);
    },
  };
}
