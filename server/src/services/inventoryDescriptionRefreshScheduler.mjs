/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createInventoryDescriptionRefreshRepository } from './inventoryDescriptionRefreshRepository.mjs';
import { createInventoryDescriptionVectorCache } from './inventoryDescriptionVectorCache.mjs';
import { createInventoryDescriptionRefreshWorker } from './inventoryDescriptionRefreshWorker.mjs';
import { createLocalStudyEmbeddingClient } from './localStudyEmbeddingClient.mjs';
import { getInventoryDescriptionRefreshRevision } from './inventoryDescriptionRefreshSignal.mjs';

export const INVENTORY_DESCRIPTION_REFRESH_TASK = 'inventory-description-refresh';

export function createInventoryDescriptionRefreshRuntime(database = db) {
  const repository = createInventoryDescriptionRefreshRepository(database);
  return createInventoryDescriptionRefreshWorker({
    repository, cache: createInventoryDescriptionVectorCache(repository),
    createEmbedder: createLocalStudyEmbeddingClient,
    withSessionAdvisoryLock: database.withSessionAdvisoryLock,
    getRevision: getInventoryDescriptionRefreshRevision,
  });
}

export function registerInventoryDescriptionRefreshSchedule(scheduler, {
  worker = createInventoryDescriptionRefreshRuntime(), log = createLogger('InventoryDescriptionRefresh'),
} = {}) {
  scheduler.inventoryDescriptionRefreshWorker?.stop();
  scheduler.inventoryDescriptionRefreshWorker = worker;
  const run = async () => {
    const report = await worker.run();
    if (report.status === 'failed') {
      // The worker deliberately omits raw provider, database and media details.
      log.warn('Inventory description refresh unavailable; automatic retry is delayed');
      throw new Error('inventory_description_refresh_unavailable');
    }
    if (['up_to_date', 'warming_cache', 'empty_corpus'].includes(report.status)) {
      log.info('Inventory description refresh completed', report);
    }
    return report;
  };
  // The worker owns the lock shared with the CLI; do not acquire it twice here.
  scheduler.schedule(INVENTORY_DESCRIPTION_REFRESH_TASK, '* * * * *', run, null, { noOverlap: true });
  scheduler.scheduleInitial(INVENTORY_DESCRIPTION_REFRESH_TASK, 60_000, run);
}
