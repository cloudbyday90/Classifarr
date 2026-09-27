/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createInventoryRepresentativeProfileRepository } from './inventoryRepresentativeProfileRepository.mjs';
import { createInventoryDescriptionRefreshRepository } from './inventoryDescriptionRefreshRepository.mjs';
import { createLocalStudyEmbeddingClient } from './localStudyEmbeddingClient.mjs';
import { getInventoryDescriptionRefreshRevision } from './inventoryDescriptionRefreshSignal.mjs';
import { createLiveMultiScaleRefresh } from './liveMultiScaleRefresh.mjs';
import { installLiveMultiScaleContext } from './liveMultiScaleRuntime.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createInventoryDiscoveryAdmission } from './inventoryDiscoveryAdmission.mjs';
import { withInventoryBackgroundReadiness } from './inventoryBackgroundReadiness.mjs';

export function createLiveMultiScaleRuntime(database = db) {
  return withInventoryBackgroundReadiness(createLiveMultiScaleRefresh({ repository: createInventoryRepresentativeProfileRepository(database),
    withAdmission: createInventoryDiscoveryAdmission(database),
    readState: createInventoryDescriptionRefreshRepository(database).readState,
    createEmbedder: createLocalStudyEmbeddingClient, getRevision: getInventoryDescriptionRefreshRevision }), database);
}

export function registerLiveMultiScaleSchedule(scheduler, { worker = createLiveMultiScaleRuntime(),
  log = createLogger('LibraryComparisonContext') } = {}) {
  scheduler.liveMultiScaleWorker?.stop();
  const disconnect = installLiveMultiScaleContext(worker);
  scheduler.liveMultiScaleWorker = { stop() { disconnect(); worker.stop(); } };
  let last = null;
  const run = async () => {
    const report = await worker.run();
    if (report.status === 'deferred' && ['disabled', 'waiting_for_libraries', 'waiting_for_inventory', 'ingesting', 'backfilling'].includes(report.reason)) return report;
    const state = ['unavailable', 'invalidated', 'capacity', 'degraded', 'deferred'].includes(report.status) ? 'retrying'
      : ['ready', 'revalidated'].includes(report.status) ? 'ready' : null;
    if (state && state !== last) {
      if (state === 'retrying') log.warn('Library comparison context is retrying automatically; ordinary retrieval remains available', { status: report.status });
      else if (last === 'retrying') log.info('Library comparison context recovered automatically');
      last = state;
    }
    return report;
  };
  scheduler.schedule('inventory-multi-scale-context', '45 * * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial('inventory-multi-scale-context', 180_000, run);
}
