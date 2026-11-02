/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { LOCK_ADJUDICATION_MAINTENANCE_SQL, RESET_ADJUDICATION_DAY_SQL,
  PRUNE_ADJUDICATION_PROGRESS_SQL, READ_ADJUDICATION_BUDGET_SQL } from './adjudicationBudgetSql.mjs';

/** Claimless maintenance; dispatch time-based commands only after row serialization. */
export function readAdjudicationBudget(transaction, signal) {
  return transaction(async client => {
    const locked = await client.query(LOCK_ADJUDICATION_MAINTENANCE_SQL);
    if (locked?.rowCount === 0) throw new Error('adjudication_budget_changed');
    if (locked?.rowCount !== 1) throw new Error('adjudication_maintenance_result_invalid');
    signal?.throwIfAborted();
    await client.query(RESET_ADJUDICATION_DAY_SQL);
    await client.query(PRUNE_ADJUDICATION_PROGRESS_SQL);
    return (await client.query(READ_ADJUDICATION_BUDGET_SQL)).rows[0];
  }, signal);
}
