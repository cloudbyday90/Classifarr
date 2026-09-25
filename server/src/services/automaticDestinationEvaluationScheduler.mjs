/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createAutomaticDestinationEvaluation } from './automaticDestinationEvaluation.mjs';
import { createAutomaticDestinationEvaluationRepository } from './automaticDestinationEvaluationRepository.mjs';

export const AUTOMATIC_DESTINATION_EVALUATION_TASK = 'automatic-destination-evaluation';
export function registerAutomaticDestinationEvaluationSchedule(scheduler, {
  worker = createAutomaticDestinationEvaluation({ repository: createAutomaticDestinationEvaluationRepository(db),
    withSessionAdvisoryLock: db.withSessionAdvisoryLock }),
} = {}) {
  scheduler.automaticDestinationEvaluationWorker?.stop();
  scheduler.automaticDestinationEvaluationWorker = worker;
  const run = async () => {
    const result = await worker.run();
    if (result.status === 'failed') throw new Error('automatic_destination_evaluation_unavailable');
    return result;
  };
  scheduler.schedule(AUTOMATIC_DESTINATION_EVALUATION_TASK, '* * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial(AUTOMATIC_DESTINATION_EVALUATION_TASK, 120_000, run);
}
