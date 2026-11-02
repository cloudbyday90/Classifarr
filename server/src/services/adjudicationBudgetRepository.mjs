/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateAdjudicationBudget } from './adjudicationBudgetContract.mjs';
import { isFinalizationAttemptId } from './adjudicationFinalizationClaim.mjs';
import { createAdjudicationReservationRefusal } from './adjudicationReservationRefusal.mjs';
import { createAdjudicationCheckpoint } from './adjudicationCheckpointRepository.mjs';
import { advanceAdjudicationBudget } from './adjudicationAdvanceRepository.mjs';
import { READ_ADJUDICATION_BUDGET_SQL, RESET_ADJUDICATION_DAY_SQL, PRUNE_ADJUDICATION_PROGRESS_SQL,
  LOCK_OWNED_ADJUDICATION_BUDGET_SQL, FINISH_ADJUDICATION_BUDGET_SQL,
  RESET_ADJUDICATION_RESERVATION_DAY_SQL,
  RESERVE_ADJUDICATION_SQL } from './adjudicationBudgetSql.mjs';

const requireWrite = result => { if (result.rowCount !== 1) throw new Error('adjudication_budget_changed'); };
export function createAdjudicationBudgetRepository(database) {
  const transaction = (callback, signal) => database.withTransaction(async client => {
    signal?.throwIfAborted();
    await client.query("SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='1s'");
    // Schema snapshots contain structure only; fresh installations start disabled too.
    await client.query('INSERT INTO adjudication_capture_budget(singleton) VALUES(true) ON CONFLICT DO NOTHING');
    const value = await callback(client); signal?.throwIfAborted(); return value;
  });
  return {
    read: signal => transaction(async client => {
      await client.query(RESET_ADJUDICATION_DAY_SQL);
      await client.query(PRUNE_ADJUDICATION_PROGRESS_SQL);
      return (await client.query(READ_ADJUDICATION_BUDGET_SQL)).rows[0];
    }, signal),
    configure: options => {
      const { dailyCalls, dailyTokens } = validateAdjudicationBudget(options);
      return transaction(async client => {
        requireWrite(await client.query(`UPDATE adjudication_capture_budget SET daily_calls=$1,daily_tokens=$2,
          revision=revision+1,finalization_attempt_id=NULL,status=CASE WHEN $1=0 THEN 'disabled' ELSE 'ready' END
          WHERE singleton=true`, [dailyCalls,dailyTokens]));
        return (await client.query(READ_ADJUDICATION_BUDGET_SQL)).rows[0];
      });
    },
    reserve: (revision, signal, attemptId) => {
      if (!isFinalizationAttemptId(attemptId)) throw new Error('adjudication_claim_invalid');
      return transaction(async client => {
        const parameters = [revision,attemptId];
        const owner = await client.query(LOCK_OWNED_ADJUDICATION_BUDGET_SQL, parameters);
        if (owner.rowCount === 0) throw createAdjudicationReservationRefusal();
        if (owner.rowCount !== 1) throw new Error('adjudication_reservation_result_invalid');
        signal?.throwIfAborted();
        const reset = await client.query(RESET_ADJUDICATION_RESERVATION_DAY_SQL, parameters);
        if (reset.rowCount !== 0 && reset.rowCount !== 1) throw new Error('adjudication_reservation_result_invalid');
        const charged = await client.query(RESERVE_ADJUDICATION_SQL, parameters);
        if (charged.rowCount === 0) throw new Error('adjudication_budget_exhausted');
        if (charged.rowCount !== 1) throw new Error('adjudication_reservation_result_invalid');
      }, signal);
    },
    finish: (revision, status, fingerprint = null, signal, attemptId) => {
      if (!['captured','waiting_for_replay','budget_exhausted','deferred','unavailable'].includes(status) ||
          fingerprint !== null && !/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('adjudication_budget_status_invalid');
      if (!isFinalizationAttemptId(attemptId)) throw new Error('adjudication_claim_invalid');
      return transaction(async client => {
        await client.query(LOCK_OWNED_ADJUDICATION_BUDGET_SQL, [revision,attemptId]);
        signal?.throwIfAborted();
        return client.query(FINISH_ADJUDICATION_BUDGET_SQL, [revision,status,fingerprint,attemptId]);
      }, signal);
    },
    advance: (revision, eligible, signal, attemptId) => advanceAdjudicationBudget(transaction, revision, eligible, signal, attemptId),
    checkpoint: (revision, attemptId) => createAdjudicationCheckpoint(transaction, revision, attemptId),
  };
}
