/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { MediaSyncService } from '../../services/mediaSync.mjs';
import { QueueService } from '../../services/queueService.mjs';
import { QueueTaskProcessorService } from '../../services/queueTaskProcessorService.mjs';
import { createResourceStudyFixture, seedResourceStudyLibraries } from '../resourceStudyFixtures.mjs';
import { assertStudyProviderEnvironment } from '../resourceStudyProviderFixture.mjs';

/** Fixed synthetic providers, production ingestion/metadata and one shared admission pool. */
export async function createComparisonStudyLoad(db, admission, {
  createFixture = createResourceStudyFixture, seed = seedResourceStudyLibraries,
  createSync = options => new MediaSyncService(options), createQueue = options => new QueueService(options),
  createProcessor = options => new QueueTaskProcessorService(options), wait = delay, now = () => performance.now(),
} = {}) {
  assertStudyProviderEnvironment();
  const fixture = createFixture(), libraries = await seed(db);
  let failure, producer, worker, stopped = false;
  const controller = new AbortController();
  const counts = { waves: 0, scans: 0, scanDeferrals: 0, serviceErrors: 0 };
  const logger = { info() {}, debug() {}, warn() {}, error() { counts.serviceErrors++; } };
  const sync = createSync({ resourceAdmission: admission,
    mediaServerServices: { getMediaServerService: async () => fixture.adapter } });
  const queue = createQueue({ db, logger, resourceAdmission: admission, tmdbService: fixture.provider,
    aiRouterService: { checkAvailability: async () => false },
    classificationService: { classifyQueueTask() { throw new Error('comparison_study_routing_forbidden'); } } });
  queue.queueTaskProcessorService = createProcessor({ db, logger, tmdbService: fixture.provider,
    omdbService: { getByTitle: async (_title, _year, type) => ({ type: type === 'tv' ? 'series' : 'movie', rated: 'PG' }) },
    queueWebSearchEnrichmentService: { enrich: async () => {} },
    completeTask: (...args) => queue.completeTask(...args), failTask: (...args) => queue.failTask(...args) });
  const scan = async () => {
    for (let i = 0; i < libraries.length; i += 2) {
      const results = await Promise.allSettled(libraries.slice(i, i + 2).map(async library => {
        const result = await sync.syncLibrary(library.id, { batchSize: 100 });
        if (result.deferred) counts.scanDeferrals++;
        else { assert.equal(result.success, true); counts.scans++; }
      }));
      const rejected = results.find(result => result.status === 'rejected');
      if (rejected) throw rejected.reason;
    }
  };
  const check = () => { if (failure) throw failure; assert.equal(counts.serviceErrors, 0, 'comparison_study_service_errors'); };
  const observe = promise => { promise.catch(error => { failure ??= error; }); return promise; };
  const read = async () => (await db.query(`SELECT
    (SELECT count(*)::integer FROM media_server_items) AS inventory,
    (SELECT count(*)::integer FROM media_server_items WHERE metadata->'content_analysis' IS NOT NULL AND metadata->'omdb' IS NOT NULL) AS completed,
    (SELECT count(*)::integer FROM task_queue WHERE status IN ('pending','processing')) AS pending,
    (SELECT count(*)::integer FROM task_queue WHERE status='failed') AS failed,
    (SELECT count(*)::integer FROM task_queue WHERE task_type<>'metadata_enrichment') AS routing,
    (SELECT count(*)::integer FROM library_ingestion_state WHERE phase<>'complete'
      OR backfill_run_id IS DISTINCT FROM run_id OR backfill_completed_at IS NULL) AS handoffs`)).rows[0];
  return {
    counts, check,
    start() {
      if (producer || stopped) return;
      worker = observe(queue.startWorker());
      producer = observe((async () => {
        const start = now();
        for (let wave = 0; wave < 20 && !stopped; wave++) {
          check(); fixture.grow(20); counts.waves++; await scan(); await queue.refillQueue();
          try { await wait(Math.max(1, start + (wave + 1) * 30_000 - now()), undefined, { signal: controller.signal }); }
          catch (error) { if (!controller.signal.aborted) throw error; }
        }
      })());
    },
    async drain() {
      assert.ok(producer, 'comparison_study_load_not_started');
      await producer; check();
      const deadline = now() + 240_000;
      for (let attempt = 0; attempt < 240 && now() < deadline; attempt++) {
        await scan(); await queue.refillQueue(); check();
        const result = await read();
        assert.equal(result.failed, 0); assert.equal(result.routing, 0);
        if (result.inventory === 1600 && result.completed === 1600 && !result.pending && !result.handoffs) return { ...counts, ...result };
        await wait(1000);
      }
      throw new Error('comparison_study_drain_incomplete');
    },
    async close() {
      stopped = true; controller.abort();
      // Join a scan before stopping its metadata consumer; never orphan an admitted task.
      await Promise.allSettled([producer]); queue.stopWorker(); await Promise.allSettled([worker]);
      const deadline = now() + 30_000;
      for (let attempt = 0; queue.processing > 0 && attempt < 600 && now() < deadline; attempt++) await wait(50);
      assert.equal(queue.processing, 0, 'comparison_study_queue_not_settled'); check();
    },
  };
}
