/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { httpGet } from '../utils/httpClient.mjs';
import { rateLimiters } from '../utils/rateLimiter.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createQueueMetadataCheckProvider } from './queueMetadataCheckProvider.mjs';
import { createQueueMetadataRecoveryRepository } from './queueMetadataRecoveryRepository.mjs';
import { createQueueMetadataRecoveryService } from './queueMetadataRecoveryService.mjs';

export function registerQueueMetadataRecoverySchedule(scheduler, {
  service = createQueueMetadataRecoveryService({
    repository: createQueueMetadataRecoveryRepository(db),
    readProvider: createQueueMetadataCheckProvider({ db, httpGet,
      executeRateLimited: (fn, options) => rateLimiters.tmdb.execute(fn, options) }),
  }), logger = createLogger('QueueMetadataRecovery'),
} = {}) {
  scheduler.queueMetadataRecoveryWorker?.stop();
  const controller = new AbortController();
  let busy = false;
  scheduler.queueMetadataRecoveryWorker = { stop: () => controller.abort() };
  scheduler.schedule('queue-metadata-recovery', '*/5 * * * *', async () => {
    if (busy || controller.signal.aborted) return;
    busy = true;
    try {
      const result = await service.run(controller.signal);
      if (result.queued) logger.info('Missing metadata record returned; original task resumed', { count: result.queued });
    } catch {
      if (!controller.signal.aborted) logger.warn('Metadata recovery check unavailable; saved cooldowns remain in effect',
        { reasonCode: 'metadata_recovery_unavailable' }, { dedupeKey: 'metadata-recovery', dedupeWindowMs: 3600000 });
    } finally { busy = false; }
  }, null, { noOverlap: true, maxRandomDelay: 5000, quiet: true });
}
