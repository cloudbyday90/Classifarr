/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isFinalizationAttemptId } from './adjudicationFinalizationClaim.mjs';

/** One capture flight; only a settled repository result can prove non-application. */
export function createAdjudicationBudgetFinalization(budget) {
  let notApplied = false;
  let claim, attempted = false;
  return {
    get notApplied() { return notApplied; },
    get claimed() { return !!claim; },
    async claim(revision, operation) {
      if (attempted || typeof operation !== 'function') throw Error('adjudication_claim_missing');
      attempted = true;
      const result = await operation(revision);
      if (result === null) { notApplied = true; throw Error('adjudication_claim_not_applied'); }
      if (result?.revision !== revision || !isFinalizationAttemptId(result?.attemptId)) throw Error('adjudication_claim_result_invalid');
      claim = Object.freeze({ revision, attemptId: result.attemptId });
    },
    async finish(revision, status, fingerprint, signal) {
      if (!claim || claim.revision !== revision) throw Error('adjudication_claim_missing');
      const result = await budget.finish(revision, status, fingerprint, signal, claim.attemptId);
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
