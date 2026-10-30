/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readPurposeOutcomeSnapshotInput } from './purposeOutcomeSnapshotInput.mjs';
import { INVENTORY_MAINTENANCE_IDLE_SQL } from './inventoryBackgroundReadiness.mjs';
import { PURPOSE_EVALUATION_FAILURES, PURPOSE_EVALUATION_MAX_REPORT_BYTES, readPurposeEvaluationReport } from './purposeEvaluationContract.mjs';
import { READ_PURPOSE_EVALUATION_STATE_SQL, SAVE_PURPOSE_EVALUATION_SQL, FAIL_PURPOSE_EVALUATION_SQL } from './purposeEvaluationSql.mjs';

// Measure the materialized, bounded projection in PostgreSQL before transferring private payloads.
const SOURCE_READINESS_SQL = `SELECT bool_and(to_regclass(name) IS NOT NULL) AS installed FROM unnest(ARRAY[
  'public.classification_history','public.libraries','public.policy_feedback_sources',
  'public.policy_authorized_outcome_source_event_receipts','public.policy_authorized_outcome_evaluation_snapshots',
  'public.policy_purpose_outcome_supplements','public.classification_policy_evaluation_captures']) AS sources(name)`;

export function createPurposeEvaluationRepository(database) {
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
    readState: signal => read(async client => (await client.query(READ_PURPOSE_EVALUATION_STATE_SQL)).rows[0] ?? null, signal),
    assertIdle: signal => read(async client => {
      const value = (await client.query(INVENTORY_MAINTENANCE_IDLE_SQL, [null])).rows[0]?.readiness;
      if (['ingesting', 'backfilling'].includes(value)) throw new Error('purpose_evaluation_busy');
      if (value !== 'ready') throw new Error('purpose_evaluation_unavailable');
    }, signal, 3000),
    readSnapshot: signal => read(async client => {
      if ((await client.query(SOURCE_READINESS_SQL)).rows[0]?.installed !== true) throw new Error('purpose_evaluation_sources_unavailable');
      const { input } = await readPurposeOutcomeSnapshotInput(client, signal);
      return { observedAt: input.observedAt, inputs: input };
    }, signal),
    save: (fingerprint, report, observedAt, signal) => {
      if (!/^[a-f0-9]{64}$/.test(fingerprint) || !readPurposeEvaluationReport(report) || report.window.until !== observedAt ||
          Buffer.byteLength(JSON.stringify(report)) > PURPOSE_EVALUATION_MAX_REPORT_BYTES) throw new Error('purpose_evaluation_invalid_report');
      return write(SAVE_PURPOSE_EVALUATION_SQL, [fingerprint, JSON.stringify(report), observedAt], signal).then(result => result.rowCount === 1);
    },
    fail: (code, signal) => {
      if (!PURPOSE_EVALUATION_FAILURES.includes(code)) throw new Error('purpose_evaluation_invalid_failure');
      return write(FAIL_PURPOSE_EVALUATION_SQL, [code], signal);
    },
  };
}
