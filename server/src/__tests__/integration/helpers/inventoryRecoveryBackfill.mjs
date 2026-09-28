/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { QueueService } from '../../../services/queueService.mjs';
import { QueueRefillService } from '../../../services/queueRefillService.mjs';
import { QueueTaskProcessorService } from '../../../services/queueTaskProcessorService.mjs';
import { createLibraryProfileService } from '../../../services/libraryProfileService.mjs';
import { LibraryInventoryProfileRefreshPlanner } from '../../../services/libraryInventoryProfileRefreshPlanner.mjs';
import { PolicyProfileRefreshOutboxWorker } from '../../../services/policyProfileRefreshOutboxWorker.mjs';

export function createInventoryRecoveryBackfill(db) {
  let providerCalls = 0, routingCalls = 0;
  const log = { info() {}, debug() {}, warn() {}, error() { throw new Error('synthetic_backfill_failed'); } };
  const details = async id => {
    providerCalls++;
    return { id, original_language: 'en', production_companies: [{ id: 12, name: 'Synthetic producer' }],
      keywords: { keywords: [{ name: 'space' }], results: [{ name: 'space' }] } };
  };
  const tmdbService = { getApiKey: async () => 'synthetic-only', getMovieDetails: details, getTVDetails: details };
  const classificationService = { classifyQueueTask() { routingCalls++; throw new Error('routing_not_allowed'); } };
  const queue = new QueueService({ db, logger: log, tmdbService, classificationService });
  queue.queueRefillService = new QueueRefillService({ db, logger: log, enqueueTask: (...args) => queue.enqueue(...args) });
  queue.queueTaskProcessorService = new QueueTaskProcessorService({ db, logger: log, tmdbService, classificationService,
    queueOmdbEnrichmentService: { enrich: async () => {} }, queueWebSearchEnrichmentService: { enrich: async () => {} },
    completeTask: (...args) => queue.completeTask(...args) });
  const planner = new LibraryInventoryProfileRefreshPlanner({ dbClient: db });
  const profileWorker = new PolicyProfileRefreshOutboxWorker({ dbClient: db,
    profileService: createLibraryProfileService({ dbClient: db }), loggerInstance: log });
  return {
    queue,
    get providerCalls() { return providerCalls; },
    get routingCalls() { return routingCalls; },
    async processNext() {
      const task = await queue.dequeue({ onlyTaskTypes: ['metadata_enrichment'], excludeClassification: true });
      if (!task) throw new Error('expected_metadata_backfill_task');
      await queue.queueTaskProcessorService.processMetadataEnrichmentTask(task);
    },
    async refreshProfiles() { await planner.run(); return profileWorker.run(); },
  };
}
