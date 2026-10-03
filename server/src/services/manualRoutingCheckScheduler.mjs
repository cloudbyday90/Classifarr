/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createManualRoutingCheckCoordinator } from './manualRoutingCheckCoordinator.mjs';
import { createLogger } from '../utils/logger.mjs';

export function registerManualRoutingCheckSchedule(scheduler, {
  coordinator = createManualRoutingCheckCoordinator(), logger = createLogger('ManualRoutingBackground'),
} = {}) {
  scheduler.manualRoutingCheckWorker?.stop();
  const controller = new AbortController();
  let active = false, unavailable = false;
  const run = async () => {
    if (controller.signal.aborted || active) return;
    active = true;
    try {
      const id = await coordinator.next();
      if (id && !controller.signal.aborted) await coordinator.check(id, { automatic: true, signal: controller.signal });
      unavailable = false;
    } catch {
      if (!unavailable) logger.warn('Background routing checks unavailable; no add was attempted');
      unavailable = true;
    } finally { active = false; }
  };
  scheduler.manualRoutingCheckWorker = { stop: () => controller.abort() };
  scheduler.schedule('manual-routing-check', '* * * * *', run, null, { noOverlap: true, maxRandomDelay: 5000, quiet: true });
}
