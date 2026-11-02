/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isFinalizationAttemptId } from './adjudicationFinalizationClaim.mjs';
import { createAdjudicationAdvanceRefusal } from './adjudicationAdvanceRefusal.mjs';
import { LOCK_OWNED_ADJUDICATION_BUDGET_SQL, ADVANCE_ADJUDICATION_BUDGET_SQL } from './adjudicationBudgetSql.mjs';

/** Advance once inside the existing transaction, retaining this flight's UUID. */
export function advanceAdjudicationBudget(transaction, revision, eligible, signal, attemptId) {
  if (!isFinalizationAttemptId(attemptId)) throw new Error('adjudication_claim_invalid');
  return transaction(async client => {
    if (!Number.isInteger(eligible) || eligible < 0 || eligible > 300) throw new Error('adjudication_rotation_invalid');
    const owner = await client.query(LOCK_OWNED_ADJUDICATION_BUDGET_SQL, [revision, attemptId]);
    if (owner?.rowCount === 0) throw createAdjudicationAdvanceRefusal();
    if (owner?.rowCount !== 1) throw new Error('adjudication_advance_result_invalid');
    signal?.throwIfAborted();
    const result = await client.query(ADVANCE_ADJUDICATION_BUDGET_SQL, [revision, eligible, attemptId]);
    if (result?.rowCount === 0) throw new Error('adjudication_budget_changed');
    if (result?.rowCount !== 1) throw new Error('adjudication_advance_result_invalid');
  }, signal);
}
