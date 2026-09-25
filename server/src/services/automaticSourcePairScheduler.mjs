/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { createAutomaticSourcePairEvaluation } from './automaticSourcePairEvaluation.mjs';
import { createAutomaticSourcePairRepository } from './automaticSourcePairRepository.mjs';

export const AUTOMATIC_SOURCE_PAIR_TASK = 'automatic-source-pair-evaluation';
export function registerAutomaticSourcePairSchedule(scheduler, {
  worker = createAutomaticSourcePairEvaluation({ repository: createAutomaticSourcePairRepository(db),
    withSessionAdvisoryLock: db.withSessionAdvisoryLock, withAdmission: createInventoryDiscoveryAdmission(db) }),
} = {}) {
  scheduler.automaticSourcePairWorker?.stop();
  scheduler.automaticSourcePairWorker = worker;
  const run = async () => {
    const result = await worker.run();
    if (result.status === 'failed') throw new Error('automatic_source_pair_evaluation_unavailable');
    return result;
  };
  scheduler.schedule(AUTOMATIC_SOURCE_PAIR_TASK, '* * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial(AUTOMATIC_SOURCE_PAIR_TASK, 180000, run);
}
