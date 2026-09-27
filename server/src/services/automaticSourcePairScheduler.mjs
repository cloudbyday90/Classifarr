/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createAutomaticSourcePairWorkers } from './automaticSourcePairWorkers.mjs';

export const AUTOMATIC_SOURCE_PAIR_TASK = 'automatic-source-pair-evaluation';
export function registerAutomaticSourcePairSchedule(scheduler, {
  worker = createAutomaticSourcePairWorkers(db),
} = {}) {
  scheduler.automaticSourcePairWorker?.stop();
  scheduler.automaticSourcePairWorker = worker;
  const run = async () => {
    const result = await worker.run();
    if (result.status === 'failed') {
      const reason = ['evidence_budget', 'deadline'].includes(result.reason) ? result.reason : 'evaluation_unavailable';
      throw new Error(`automatic_source_pair_evaluation_unavailable:${reason}`);
    }
    return result;
  };
  scheduler.schedule(AUTOMATIC_SOURCE_PAIR_TASK, '* * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial(AUTOMATIC_SOURCE_PAIR_TASK, 180000, run);
}
