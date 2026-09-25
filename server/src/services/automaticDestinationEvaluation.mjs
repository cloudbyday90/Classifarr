/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { evaluateDestinationOutcomes } from './destinationOutcomeEvaluation.mjs';
import { readAutomaticDestinationEvaluationReport } from './automaticDestinationEvaluationReport.mjs';

// Independent of inventory discovery: bounded saved projections, no model work.
export const AUTOMATIC_DESTINATION_EVALUATION_LOCK = 0x41444556;
const REVISION = 'automatic_destination_evaluation.v1:destination_outcomes.v2';
function failureCode(error) {
  if (['saved_decisions_row_budget', 'saved_decisions_intake_budget'].includes(error?.message)) return 'evidence_budget';
  return error?.message === 'saved_decisions_feedback_invalid' ? 'invalid_feedback' : 'evaluation_unavailable';
}

export function createAutomaticDestinationEvaluation({ repository, withSessionAdvisoryLock,
  evaluate = evaluateDestinationOutcomes, now = Date.now }) {
  const controller = new AbortController();
  let active = null, retryAfter = 0;
  async function runOnce() {
    let result = { status: 'busy' };
    try {
      await withSessionAdvisoryLock(AUTOMATIC_DESTINATION_EVALUATION_LOCK, async ({ signal: lockSignal } = {}) => {
        const signal = AbortSignal.any([controller.signal, ...[lockSignal].filter(Boolean)]);
        signal.throwIfAborted();
        const state = await repository.readState(signal);
        if (state?.cooling_down) { result = { status: 'cooldown' }; return; }
        try {
          const snapshot = await repository.readSnapshot(signal);
          signal.throwIfAborted();
          // Preserve even malformed JSON keys (including __proto__) in change detection.
          const canonical = JSON.stringify({ revision: REVISION, ...snapshot.inputs }, (_key, value) => {
            if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('automatic_evaluation_invalid_input');
            return value && typeof value === 'object' && !Array.isArray(value)
              ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value;
          });
          const fingerprint = createHash('sha256').update(canonical).digest('hex');
          const unchanged = state?.status === 'complete' && state.input_fingerprint === fingerprint &&
            readAutomaticDestinationEvaluationReport(state.report) !== null;
          const report = unchanged ? state.report : evaluate(snapshot.inputs.rows, snapshot.inputs.intake);
          signal.throwIfAborted();
          const saved = await repository.save(fingerprint, report, snapshot.observedAt, signal);
          result = { status: saved === false ? 'superseded' : unchanged ? 'unchanged' : 'evaluated' };
        } catch (error) {
          signal.throwIfAborted();
          const code = failureCode(error);
          await repository.fail(code, signal);
          result = { status: 'failed', reason: code };
        }
      });
    } catch {
      retryAfter = now() + 300_000; // Local fallback when the database cannot persist retry state.
      return { status: controller.signal.aborted ? 'stopped' : 'failed', reason: 'evaluation_unavailable' };
    }
    return result;
  }
  return {
    run() {
      if (controller.signal.aborted) return Promise.resolve({ status: 'stopped' });
      if (now() < retryAfter) return Promise.resolve({ status: 'cooldown' });
      active ??= runOnce().finally(() => { active = null; });
      return active;
    },
    stop() { controller.abort(new Error('automatic_evaluation_stopped')); },
  };
}
