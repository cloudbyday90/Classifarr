/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createEvaluationFailureTrace, EVALUATION_FAILURE_STAGE as stage, withoutStageObservation } from './automaticEvaluationFailureStage.mjs';

/** Shared lifecycle only. Domain adapters own evidence, grading and publication validation. */
export function createAutomaticEvaluationWorker({ repository, withSessionAdvisoryLock, lock,
  runEvaluation, failureCode, deferredCodes = [], now = Date.now, observeFailure,
  withEvaluation = (callback, signal) => callback(signal) }) {
  const controller = new AbortController();
  let active = null, retryAfter = 0;
  function failed(reason, failureStage, originStage) {
    const result = { status: 'failed', reason };
    observeFailure?.(result, { stage: failureStage, originStage });
    return result;
  }

  async function runOnce() {
    let result = { status: 'busy' };
    const trace = observeFailure ? createEvaluationFailureTrace() : null;
    const during = trace?.during ?? withoutStageObservation;
    let originStage = null;
    try {
      await during(stage.LOCK, () => withSessionAdvisoryLock(lock, async ({ signal: lockSignal } = {}) => {
        const signal = AbortSignal.any([controller.signal, ...[lockSignal].filter(Boolean)]);
        signal.throwIfAborted();
        const state = await during(stage.STATE, () => repository.readState(signal));
        if (state?.cooling_down) { result = { status: 'cooldown' }; return; }
        try {
          await during(stage.ADMISSION, () => withEvaluation(async evaluationSignal => {
            const snapshot = await during(stage.SNAPSHOT, () => repository.readSnapshot(evaluationSignal));
            const evaluation = await during(stage.EVALUATION, () => {
              evaluationSignal.throwIfAborted();
              return trace
                ? runEvaluation(snapshot, state, evaluationSignal, during)
                : runEvaluation(snapshot, state, evaluationSignal);
            });
            const saved = await during(stage.PUBLICATION, () => {
              evaluationSignal.throwIfAborted();
              return repository.save(evaluation.fingerprint, evaluation.report, snapshot.observedAt, evaluationSignal, evaluation);
            });
            result = { status: saved === false ? 'superseded' : evaluation.unchanged ? 'unchanged' : 'evaluated' };
          }, signal));
        } catch (error) {
          signal.throwIfAborted();
          originStage = trace?.takeStage(error);
          const code = await during(stage.FAILURE_RECORD, async () => {
            const code = failureCode(error);
            await repository.fail(code, signal);
            return code;
          });
          result = deferredCodes.includes(code) ? { status: 'deferred', reason: code } : failed(code, originStage);
          originStage = null;
        }
      }));
    } catch (error) {
      retryAfter = now() + 300_000; // Local fallback when the database cannot persist retry state.
      return controller.signal.aborted ? { status: 'stopped', reason: 'evaluation_unavailable' }
        : failed('evaluation_unavailable', trace?.takeStage(error), originStage);
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
