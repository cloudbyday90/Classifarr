/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { reclassificationService } from './reclassificationService.mjs';

export function registerReclassificationMoveSchedule(scheduler, service = reclassificationService) {
  const run = () => service.recoverDue();
  // The service owns the same cross-process lock as foreground moves.
  scheduler.schedule('reclassification-move-recovery', '*/5 * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial('reclassification-move-recovery', 120_000, run);
}
