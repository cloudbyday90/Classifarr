/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import * as db from '../config/database.mjs';
import { createAutomaticPurposeEvaluation } from './automaticPurposeEvaluation.mjs';

export const PURPOSE_EVALUATION_TASK = 'purpose-evaluation';
export const PURPOSE_EVALUATION_STARTUP_MS = 240000;
export function registerPurposeEvaluationSchedule(scheduler, {
  worker = createAutomaticPurposeEvaluation(db), steadyNow = () => performance.now(),
} = {}) {
  scheduler.purposeEvaluationWorker?.stop();
  scheduler.purposeEvaluationWorker = worker;
  const start = steadyNow();
  const run = async () => {
    // Cron may tick before the delayed initial task. Gate both entry points.
    if (steadyNow() - start < PURPOSE_EVALUATION_STARTUP_MS) return { status: 'deferred', reason: 'startup' };
    const result = await worker.run();
    if (result.status === 'failed') throw new Error('purpose_evaluation_unavailable');
    return result;
  };
  scheduler.schedule(PURPOSE_EVALUATION_TASK, '* * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial(PURPOSE_EVALUATION_TASK, PURPOSE_EVALUATION_STARTUP_MS, run);
}
