/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createBatchCoordinator } from './reclassificationBatchCoordinator.mjs';

export function registerReclassificationBatchSchedule(scheduler, coordinator = createBatchCoordinator()) {
  const run = () => coordinator.runOnce();
  scheduler.schedule('reclassification-batch-coordinator', '*/30 * * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial('reclassification-batch-coordinator', 30_000, run);
}
