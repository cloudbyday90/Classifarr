/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_DISCOVERY_LOCK } from './inventoryDiscoveryAdmission.mjs';
import { EVALUATION_WINDOW_OPEN_SQL } from './evaluationWorkloadSql.mjs';

const lockSql = `SELECT singleton FROM adjudication_capture_budget WHERE singleton=true AND revision=$1 FOR UPDATE`;
const claimSql = `UPDATE adjudication_capture_budget SET finalization_attempt_id=gen_random_uuid()
  WHERE singleton=true AND revision=$1 AND daily_calls>0 AND ${EVALUATION_WINDOW_OPEN_SQL}
    AND NOT (next_check_at>statement_timestamp() AND next_check_at<=statement_timestamp()+interval '60 minutes')
    AND EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()
      AND database=(SELECT oid FROM pg_database WHERE datname=current_database())
      AND classid=0 AND objid=$2::oid AND objsubid=1 AND mode='ExclusiveLock' AND granted)
  RETURNING revision,finalization_attempt_id`;

export const isFinalizationAttemptId = value => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

/** One use, on the actual advisory owner; no pool lookup or authority recovery. */
export function createAdjudicationFinalizationClaim({ query, signal }) {
  let attempted = false;
  return async revision => {
    if (attempted) throw Error('adjudication_claim_already_attempted');
    attempted = true;
    if (!Number.isSafeInteger(revision) || revision < 0 || typeof query !== 'function') throw Error('adjudication_claim_invalid');
    signal?.throwIfAborted();
    await query('BEGIN');
    try {
      await query("SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='1s'");
      await query(lockSql, [revision]);
      signal?.throwIfAborted();
      // A new command anchor follows row-lock serialization, including cooldown checks.
      const result = await query(claimSql, [revision, INVENTORY_DISCOVERY_LOCK]);
      let claim = null;
      if (result.rowCount === 1 && result.rows.length === 1 && result.rows[0].revision === revision &&
          isFinalizationAttemptId(result.rows[0].finalization_attempt_id)) {
        claim = Object.freeze({ revision, attemptId: result.rows[0].finalization_attempt_id });
      } else if (result.rowCount !== 0 || result.rows.length !== 0) throw Error('adjudication_claim_result_invalid');
      signal?.throwIfAborted();
      await query('COMMIT');
      signal?.throwIfAborted();
      return claim;
    } catch (error) {
      try { await query('ROLLBACK'); } catch { /* Lost sessions cannot recover claim authority. */ }
      throw error;
    }
  };
}
