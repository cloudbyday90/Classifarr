/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** One capture flight; only a settled repository result can prove non-application. */
export function createAdjudicationBudgetFinalization(budget) {
  let notApplied = false;
  return {
    get notApplied() { return notApplied; },
    async finish(revision, status, fingerprint, signal) {
      const result = await budget.finish(revision, status, fingerprint, signal);
      const count = result?.rowCount;
      if (count === 1) return;
      if (count === 0) {
        // Admission may replace the thrown error. Keep acknowledged evidence in this flight.
        notApplied = true;
        throw new Error('adjudication_finalization_not_applied');
      }
      throw new Error('adjudication_finalization_result_invalid');
    },
  };
}
