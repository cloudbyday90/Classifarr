/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { MediaSyncService } from '../services/mediaSync.mjs';
import { QueueService } from '../services/queueService.mjs';
import { QueueTaskProcessorService } from '../services/queueTaskProcessorService.mjs';
import { createResourceStudyFixture, seedResourceStudyLibraries } from './resourceStudyFixtures.mjs';
import { assertStudyProviderEnvironment } from './resourceStudyProviderFixture.mjs';

export function summarizeMixedLatency(values) {
  assert(values.length > 0 && values.length <= 400);
  assert(values.every(n => Number.isFinite(n) && n >= 0));
  const sorted = [...values].sort((a, b) => a - b);
  return { count: sorted.length, p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], maxMs: sorted.at(-1) };
}

/** Real ingestion/enrichment, synthetic providers and retrieval; no AI or routing. */
export async function createImageIndexMixedForeground(db) {
  assertStudyProviderEnvironment();
  const fixture = createResourceStudyFixture(), libraries = await seedResourceStudyLibraries(db);
  await db.query("INSERT INTO omdb_config(api_key,is_active,daily_limit) VALUES ('synthetic-only',true,10000)");
  let errors = 0;
  const logger = { info() {}, debug() {}, warn() {}, error() { errors++; } };
  const sync = new MediaSyncService({ mediaServerServices: { getMediaServerService: async () => fixture.adapter } });
  const queue = new QueueService({ db, logger, tmdbService: fixture.provider,
    aiRouterService: { checkAvailability: async () => false },
    classificationService: { classifyQueueTask() { throw new Error('mixed_study_routing_forbidden'); } } });
  queue.queueTaskProcessorService = new QueueTaskProcessorService({ db, logger, tmdbService: fixture.provider,
    omdbService: { getByTitle: async (_title, _year, type) => ({ type: type === 'tv' ? 'series' : 'movie', rated: 'PG' }) },
    queueWebSearchEnrichmentService: { enrich: async () => {} },
    completeTask: (...args) => queue.completeTask(...args), failTask: (...args) => queue.failTask(...args) });
  const vector = JSON.stringify(Array.from({ length: 2000 }, (_, i) => Math.sin(i + 1)));
  return async function foreground(onRetrieval = () => {}) {
    assertStudyProviderEnvironment();
    const started = performance.now(), scans = [], retrievals = [];
    const reader = await db.pool.connect();
    let refill, stopped = false, failure;
    const worker = queue.startWorker();
    worker.catch(error => { failure = error; });
    try {
      await reader.query("SET statement_timeout='5s'; SET lock_timeout='2s'; SET max_parallel_workers_per_gather=0");
      refill = (async () => {
        while (!stopped) { await queue.refillQueue(); await delay(250); }
      })();
      refill.catch(error => { failure = error; });
      fixture.grow(20);
      for (const library of libraries) {
        const time = performance.now();
        const result = await sync.syncLibrary(library.id, { batchSize: 100 });
        assert.equal(result.success, true); scans.push(performance.now() - time);
      }
      for (let n = 0; n < 40; n++) {
        if (failure) throw failure;
        const time = performance.now();
        const result = await reader.query(`SELECT id FROM classification_embeddings
          WHERE image_embedding IS NOT NULL ORDER BY image_embedding <=> $1::public.vector LIMIT 5`, [vector]);
        assert.equal(result.rows.length, 5); retrievals.push(performance.now() - time);
        onRetrieval(); await delay(250);
      }
      const deadline = performance.now() + 60000;
      while (true) {
        if (failure) throw failure;
        const row = (await db.query(`SELECT
          (SELECT count(*)::integer FROM task_queue WHERE task_type<>'rebuild_hnsw_index' AND status<>'completed') AS pending,
          (SELECT count(*)::integer FROM library_ingestion_state WHERE phase<>'complete'
            OR backfill_run_id IS DISTINCT FROM run_id OR backfill_completed_at IS NULL) AS unfinished`)).rows[0];
        if (!row.pending && !row.unfinished && queue.processing === 0) break;
        assert(performance.now() < deadline, 'mixed_study_foreground_drain_timeout');
        await delay(250);
      }
      const inventory = (await db.query(`SELECT count(*)::integer AS count,
        count(*) FILTER (WHERE media_type NOT IN ('movie','tv'))::integer AS unsupported,
        count(*) FILTER (WHERE metadata->'content_analysis' IS NOT NULL AND metadata->'omdb' IS NOT NULL)::integer AS enriched
        FROM media_server_items`)).rows[0];
      assert.equal(inventory.count, fixture.count * 4, 'mixed_study_inventory_incomplete');
      assert.equal(inventory.enriched, inventory.count, 'mixed_study_enrichment_incomplete');
      assert.equal(inventory.unsupported, 0); assert.equal(errors, 0);
      return { durationMs: performance.now() - started, inventory: inventory.count,
        scans: summarizeMixedLatency(scans), retrievals: summarizeMixedLatency(retrievals) };
    } finally {
      stopped = true; queue.stopWorker();
      await Promise.allSettled([refill, worker]);
      const deadline = performance.now() + 10000;
      while (queue.processing > 0 && performance.now() < deadline) await delay(50);
      reader.release(true);
      assert.equal(queue.processing, 0, 'mixed_study_foreground_still_active');
      if (failure) throw failure;
    }
  };
}
