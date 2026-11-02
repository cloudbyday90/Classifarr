/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

function classify(error, notApplied) {
  if (notApplied) return 'deferred';
  const message = error?.message;
  if (message === 'adjudication_budget_exhausted') return 'budget_exhausted';
  return ['inventory_discovery_deferred', 'evaluation_workload_deferred', 'disabled', 'busy',
    'unsupported_provider', 'representation_unavailable', 'adjudication_budget_changed'].includes(message) ? 'deferred' : 'unavailable';
}

/** Record one fixed outcome; only the admitted callback may settle durable cleanup. */
export function createAdjudicationCaptureFailure({ finalization, stopSignal, now, onRetry }) {
  let outcome;
  const record = (error, admissionSignal) => {
    if (stopSignal.aborted) return { status: 'stopped' };
    if (!outcome) {
      outcome = { status: classify(admissionSignal?.aborted ? admissionSignal.reason : error, finalization.notApplied) };
      onRetry(now() + 300000);
    }
    return outcome;
  };
  return {
    async settleAdmitted(error, state, admissionSignal) {
      if (outcome || stopSignal.aborted) return;
      const result = record(error, admissionSignal);
      if (state && finalization.claimed && !finalization.notApplied && !stopSignal.aborted) {
        try { await finalization.finish(state.revision, result.status, null, stopSignal); }
        catch { /* Best-effort cleanup preserves the first observed failure and local cooldown. */ }
      }
    },
    result(error) { return stopSignal.aborted ? { status: 'stopped' } : outcome ?? record(error); },
  };
}
