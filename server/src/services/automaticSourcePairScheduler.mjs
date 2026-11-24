/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createAutomaticSourcePairWorkers } from './automaticSourcePairWorkers.mjs';
import { createSourcePairTaskError } from './automaticSourcePairTaskFailure.mjs';

export const AUTOMATIC_SOURCE_PAIR_TASK = 'automatic-source-pair-evaluation';
export function registerAutomaticSourcePairSchedule(scheduler, {
  worker = createAutomaticSourcePairWorkers(db),
} = {}) {
  scheduler.automaticSourcePairWorker?.stop();
  scheduler.automaticSourcePairWorker = worker;
  const run = async () => {
    const result = await worker.run();
    if (result.status === 'failed') throw createSourcePairTaskError(result);
    return result;
  };
  scheduler.schedule(AUTOMATIC_SOURCE_PAIR_TASK, '* * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial(AUTOMATIC_SOURCE_PAIR_TASK, 180000, run);
}
