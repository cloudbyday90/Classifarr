/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createInventoryDescriptionRefreshRepository } from './inventoryDescriptionRefreshRepository.mjs';
import { createLocalStudyEmbeddingClient } from './localStudyEmbeddingClient.mjs';
import { getInventoryDescriptionRefreshRevision } from './inventoryDescriptionRefreshSignal.mjs';
import { createInventoryRepresentativeProfileRepository } from './inventoryRepresentativeProfileRepository.mjs';
import { createInventoryRepresentativeProfileRefresh } from './inventoryRepresentativeProfileRefresh.mjs';
import { fitInventoryRepresentativeProfile } from './inventoryRepresentativeProfileFit.mjs';
import { createInventoryRepresentativeShadow } from './inventoryRepresentativeShadow.mjs';
import { installRepresentativeShadow } from './inventoryRepresentativeShadowRuntime.mjs';

export const INVENTORY_REPRESENTATIVE_PROFILE_TASK = 'inventory-representative-profile-refresh';

export function createInventoryRepresentativeProfileRuntime(database = db) {
  const observer = createInventoryRepresentativeShadow();
  const worker = createInventoryRepresentativeProfileRefresh({
    repository: createInventoryRepresentativeProfileRepository(database),
    readState: createInventoryDescriptionRefreshRepository(database).readState,
    createEmbedder: createLocalStudyEmbeddingClient, fit: fitInventoryRepresentativeProfile,
    getRevision: getInventoryDescriptionRefreshRevision, observer,
  });
  return { ...worker, observer };
}

export function registerInventoryRepresentativeProfileSchedule(scheduler, {
  worker = createInventoryRepresentativeProfileRuntime(), log = createLogger('InventoryRepresentativeProfile'),
} = {}) {
  scheduler.inventoryRepresentativeProfileWorker?.stop();
  const disconnect = installRepresentativeShadow(worker.observer ?? null);
  scheduler.inventoryRepresentativeProfileWorker = { ...worker, stop() { disconnect(); worker.stop(); } };
  const run = async () => {
    const report = await worker.run();
    if (report.status === 'failed') throw new Error('inventory_representative_refresh_unavailable');
    if (report.status === 'published') log.info('Library representative profiles refreshed automatically', report);
    return report;
  };
  scheduler.schedule(INVENTORY_REPRESENTATIVE_PROFILE_TASK, '30 * * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial(INVENTORY_REPRESENTATIVE_PROFILE_TASK, 90_000, run);
}
