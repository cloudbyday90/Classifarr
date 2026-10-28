/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readInventoryProspectiveSnapshot } from './inventoryProspectiveSnapshot.mjs';
import { INVENTORY_MAINTENANCE_IDLE_SQL } from './inventoryBackgroundReadiness.mjs';
import { GAP_AUDIT_FAILURES, GAP_AUDIT_MAX_REPORT_BYTES, readEvidenceGapAuditReport } from './evidenceGapAuditContract.mjs';
import { READ_GAP_AUDIT_STATE_SQL, SAVE_GAP_AUDIT_SQL, FAIL_GAP_AUDIT_SQL } from './evidenceGapAuditSql.mjs';

// Measure the materialized, bounded projection in PostgreSQL before transferring private payloads.
export { READ_INVENTORY_PROSPECTIVE_INPUT_SQL as READ_GAP_AUDIT_INPUT_SQL } from './inventoryProspectiveSnapshot.mjs';

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
    readSnapshot: signal => read(client => readInventoryProspectiveSnapshot(client, 'evidence_gap_audit'), signal),
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
