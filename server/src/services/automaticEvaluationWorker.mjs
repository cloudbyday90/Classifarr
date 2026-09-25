/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Shared lifecycle only. Domain adapters own evidence, grading and publication validation. */
export function createAutomaticEvaluationWorker({ repository, withSessionAdvisoryLock, lock,
  runEvaluation, failureCode, deferredCodes = [], now = Date.now,
  withEvaluation = (callback, signal) => callback(signal) }) {
  const controller = new AbortController();
  let active = null, retryAfter = 0;
  async function runOnce() {
    let result = { status: 'busy' };
    try {
      await withSessionAdvisoryLock(lock, async ({ signal: lockSignal } = {}) => {
        const signal = AbortSignal.any([controller.signal, ...[lockSignal].filter(Boolean)]);
        signal.throwIfAborted();
        const state = await repository.readState(signal);
        if (state?.cooling_down) { result = { status: 'cooldown' }; return; }
        try {
          await withEvaluation(async evaluationSignal => {
            const snapshot = await repository.readSnapshot(evaluationSignal);
            evaluationSignal.throwIfAborted();
            const evaluation = await runEvaluation(snapshot, state, evaluationSignal);
            evaluationSignal.throwIfAborted();
            const saved = await repository.save(evaluation.fingerprint, evaluation.report,
              snapshot.observedAt, evaluationSignal, evaluation);
            result = { status: saved === false ? 'superseded' : evaluation.unchanged ? 'unchanged' : 'evaluated' };
          }, signal);
        } catch (error) {
          signal.throwIfAborted();
          const code = failureCode(error);
          await repository.fail(code, signal);
          result = { status: deferredCodes.includes(code) ? 'deferred' : 'failed', reason: code };
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
