/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { captureCachedAdjudication } from './cachedAdjudicationCapture.mjs';
import { remainingAdjudicationCalls } from './adjudicationBudgetContract.mjs';
import { fingerprintAutomaticSourcePairInputs } from './automaticSourcePairComputation.mjs';
import { readAutomaticSourcePairReport } from './automaticSourcePairReport.mjs';

/** Private capture owns no routing capabilities. Shared admission spans all provider/checkpoint work. */
export function createAdjudicationBudgetWorker({ budget, repository, withAdmission, readConfig, createClient,
  capture = captureCachedAdjudication, now = Date.now }) {
  const controller = new AbortController();
  let active, retryAfter = 0;
  async function runOnce() {
    let state;
    try {
      state = await budget.read(controller.signal); // Retention runs even while disabled.
      if (!state?.daily_calls) return { status: 'disabled' };
      if (state.cooling_down) return { status: 'cooldown' };
      return await withAdmission(async signal => {
        state = await budget.read(signal);
        if (!state.daily_calls || state.cooling_down) return { status: state.daily_calls ? 'cooldown' : 'disabled' };
        const evaluation = await repository.readState(signal);
        if (evaluation?.status !== 'complete' || !readAutomaticSourcePairReport(evaluation.report) ||
            evaluation.report.policyReplay?.status !== 'complete') {
          await budget.finish(state.revision,'deferred',null,signal); return { status: 'deferred' };
        }
        if (state.published_fingerprint) {
          if (evaluation.input_fingerprint !== state.published_fingerprint) {
            // A source change must not wedge rotation behind an obsolete publication forever.
            const snapshot = await repository.readSnapshot(signal);
            const current = fingerprintAutomaticSourcePairInputs(snapshot,
              { cohort: evaluation.cohort, cohortCreatedAt: evaluation.cohort_created_at });
            if (current === state.published_fingerprint) {
              await budget.finish(state.revision,'waiting_for_replay',null,signal); return { status: 'waiting_for_replay' };
            }
          } else await budget.advance(state.revision,evaluation.report.aiReplay.eligible,signal);
        }
        const maxCalls = remainingAdjudicationCalls(state);
        if (!maxCalls) { await budget.finish(state.revision,'budget_exhausted',null,signal); return { status: 'budget_exhausted' }; }
        const checkpoint = budget.checkpoint(state.revision);
        const result = await capture({ maxCalls }, { repository, readConfig, createClient, signal,
          withAdmission: (callback, { signal: inner }) => callback(AbortSignal.any([signal,inner])),
          checkpoint: { ...checkpoint, reserve: abort => budget.reserve(state.revision,abort) }, save: checkpoint.publish,
          onPublished: (fingerprint, complete, abort) => budget.finish(state.revision,'captured',complete ? fingerprint : null,abort),
        });
        return { status: 'captured', calls: result.calls, reused: result.reused, stored: result.stored };
      }, { signal: AbortSignal.any([controller.signal,AbortSignal.timeout(20 * 60000)]) });
    } catch (error) {
      if (controller.signal.aborted) return { status: 'stopped' };
      const status = error?.message === 'adjudication_budget_exhausted' ? 'budget_exhausted'
        : error?.message === 'inventory_discovery_deferred' ||
          ['disabled','busy','unsupported_provider','representation_unavailable','adjudication_budget_changed'].includes(error?.message)
          ? 'deferred' : 'unavailable';
      retryAfter = now() + 300000;
      if (state) { try { await budget.finish(state.revision,status); } catch { /* Database recovery retains the local cooldown. */ } }
      return { status };
    }
  }
  return {
    run() {
      if (controller.signal.aborted) return Promise.resolve({ status: 'stopped' });
      if (now() < retryAfter) return Promise.resolve({ status: 'cooldown' });
      active ??= runOnce().finally(() => { active = null; }); return active;
    },
    stop() { controller.abort(new Error('adjudication_capture_stopped')); },
  };
}
