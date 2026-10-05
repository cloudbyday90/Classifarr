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
import { describeLiveMultiScaleRetry } from './liveMultiScaleDiagnostics.mjs';
import { diagnoseLiveMultiScaleFailure } from './liveMultiScaleFailure.mjs';

export function createLiveMultiScaleRuntime(database = db) {
  return withInventoryBackgroundReadiness(createLiveMultiScaleRefresh({ repository: createInventoryRepresentativeProfileRepository(database),
    withAdmission: createInventoryDiscoveryAdmission(database),
    readState: createInventoryDescriptionRefreshRepository(database).readState,
    createEmbedder: createLocalStudyEmbeddingClient, getRevision: getInventoryDescriptionRefreshRevision }), database,
    undefined, error => diagnoseLiveMultiScaleFailure('readiness', error));
}

export function registerLiveMultiScaleSchedule(scheduler, { worker = createLiveMultiScaleRuntime(),
  log = createLogger('LibraryComparisonContext') } = {}) {
  scheduler.liveMultiScaleWorker?.stop();
  const disconnect = installLiveMultiScaleContext(worker);
  scheduler.liveMultiScaleWorker = { stop() { disconnect(); worker.stop(); } };
  let last = null;
  const run = async () => {
    const report = await worker.run();
    const diagnostic = describeLiveMultiScaleRetry(report);
    const state = diagnostic ? `${diagnostic.status}:${diagnostic.reason}:${diagnostic.stage || ''}:${diagnostic.code || ''}`
      : ['ready', 'revalidated'].includes(report.status) ? 'ready' : null;
    if (state && state !== last) {
      if (diagnostic) {
        if (diagnostic.reason === 'busy') log.info('Library comparison context is waiting for other background work', diagnostic);
        else log.warn('Library comparison context is retrying automatically; ordinary retrieval remains available', diagnostic);
      } else if (last && last !== 'ready') log.info('Library comparison context recovered automatically');
      last = state;
    }
    return report;
  };
  scheduler.schedule('inventory-multi-scale-context', '45 * * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial('inventory-multi-scale-context', 180_000, run);
}
