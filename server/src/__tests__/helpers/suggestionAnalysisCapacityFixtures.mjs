/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { createBackgroundResourceAdmission } from '../../services/backgroundResourceAdmission.mjs';
import { MediaSyncService } from '../../services/mediaSync.mjs';
import { QueueService } from '../../services/queueService.mjs';
import { QueueTaskProcessorService } from '../../services/queueTaskProcessorService.mjs';
import { createResourceStudyFixture, seedResourceStudyLibraries } from '../../scripts/resourceStudyFixtures.mjs';

const FEEDBACK_ROWS = 128;
const QUEUE_ITEMS = 20;
const INGESTION_ITEMS = 40;

export async function seedSuggestionAnalysisProfiles(db, { policies, keywords }, originalLibraryId) {
  const terms = Array.from({ length: keywords }, (_, index) => `Study keyword ${index + 1}`);
  const { rows: libraries } = await db.query(`INSERT INTO libraries(external_id,name,media_type,is_active)
    SELECT 'analysis-study-'||n,'Fixture policy library '||n,'movie',true
    FROM generate_series(1,$1::integer) n RETURNING id`, [policies]);
  const { rows: created } = await db.query(`INSERT INTO library_policies(library_id,name,enabled,auto_classify_threshold,prompt_threshold)
    SELECT id,name,true,85,60 FROM libraries WHERE id=ANY($1::integer[]) RETURNING id`, [libraries.map(row => row.id)]);
  assert.equal(created.length, policies);
  const ids = created.map(row => row.id);
  const feedback = await db.query(`INSERT INTO policy_feedback_log(tmdb_id,selected_policy_id,selected_library_id,was_correction,
    item_metadata,original_scores,prompt_type,top_suggestion_score,prompted_at,top_suggestion_library_id)
    SELECT n,p.id,p.library_id,n%2=0,$2::jsonb,'{"preset":85}','auto_classify',85,
      NOW() - INTERVAL '1 minute',CASE WHEN n%2=0 THEN $3::integer ELSE p.library_id END
    FROM library_policies p CROSS JOIN generate_series(1,$4::integer) n WHERE p.id=ANY($1::integer[])`,
  [ids, { keywords: terms }, originalLibraryId, FEEDBACK_ROWS]);
  assert.equal(feedback.rowCount, policies * FEEDBACK_ROWS);
  return { ids, feedbackRows: FEEDBACK_ROWS };
}

/** Production scan, queue and ownership paths with bounded synthetic providers. */
export async function prepareSuggestionAnalysisBackground(db) {
  const libraries = await seedResourceStudyLibraries(db);
  const [queueLibrary, ingestionLibrary] = libraries;
  const fixture = createResourceStudyFixture();
  const admission = createBackgroundResourceAdmission();
  const resume = Promise.withResolvers();
  const scanReady = Promise.withResolvers();
  const queueReady = Promise.withResolvers();
  const queueCompletedAt = [];
  let serviceErrors = 0, scanActive = false, scanCompletedAt, scan, worker;
  const provider = {
    ...fixture.provider,
    async getMovieDetails(id) {
      queueReady.resolve(performance.now());
      await resume.promise;
      return fixture.provider.getMovieDetails(id);
    },
  };
  const adapter = {
    ...fixture.adapter,
    async getLibraryPage(...args) {
      if (scanActive) {
        scanReady.resolve(performance.now());
        await resume.promise;
      }
      return fixture.adapter.getLibraryPage(...args);
    },
  };
  const logger = { info() {}, debug() {}, warn() {}, error() { serviceErrors++; } };
  const sync = new MediaSyncService({ resourceAdmission: admission,
    mediaServerServices: { getMediaServerService: async () => adapter } });
  const queue = new QueueService({ db, logger, resourceAdmission: admission, tmdbService: provider,
    aiRouterService: { checkAvailability: async () => false },
    classificationService: { classifyQueueTask() { throw new Error('analysis_capacity_routing_forbidden'); } } });
  queue.queueTaskProcessorService = new QueueTaskProcessorService({ db, logger, tmdbService: provider,
    omdbService: { getByTitle: async () => ({ type: 'movie', rated: 'PG' }) },
    queueWebSearchEnrichmentService: { enrich: async () => {} },
    completeTask: (...args) => queue.completeTask(...args),
    failTask: (...args) => queue.failTask(...args),
  });
  const processTask = queue.processTask.bind(queue);
  queue.processTask = async task => {
    await processTask(task);
    queueCompletedAt.push(performance.now());
  };
  await db.query("INSERT INTO omdb_config(api_key,is_active,daily_limit) VALUES ('synthetic-only',true,10000)");
  fixture.grow(QUEUE_ITEMS);
  assert.equal((await sync.syncLibrary(queueLibrary.id, { batchSize: 100 })).success, true);
  await queue.refillQueue();
  fixture.grow(INGESTION_ITEMS - QUEUE_ITEMS);

  async function readCounts() {
    return (await db.query(`SELECT
      (SELECT count(*)::integer FROM media_server_items WHERE library_id=$1) AS inventory,
      (SELECT count(*)::integer FROM task_queue WHERE task_type='metadata_enrichment' AND status='completed') AS completed,
      (SELECT count(*)::integer FROM media_server_items WHERE library_id=$2 AND
        metadata->'content_analysis' IS NOT NULL AND metadata->'omdb' IS NOT NULL) AS enriched,
      (SELECT count(*)::integer FROM task_queue WHERE status='failed' OR task_type<>'metadata_enrichment') AS unexpected`,
    [ingestionLibrary.id, queueLibrary.id])).rows[0];
  }

  function start() {
    scanActive = true;
    worker = queue.startWorker();
    scan = sync.syncLibrary(ingestionLibrary.id, { batchSize: 100 }).then(result => {
      assert.equal(result.success, true);
      scanCompletedAt = performance.now();
    });
    const timeout = new AbortController();
    return Promise.race([
      Promise.all([scanReady.promise, queueReady.promise]),
      scan.then(() => { throw new Error('analysis_capacity_scan_ended_before_overlap'); }),
      worker.then(() => { throw new Error('analysis_capacity_worker_ended_before_overlap'); }),
      delay(15_000, null, { signal: timeout.signal }).then(() => { throw new Error('analysis_capacity_overlap_readiness_timeout'); }),
    ]).finally(() => timeout.abort());
  }

  async function finish() {
    if (!scan) return readCounts();
    await scan;
    const deadline = performance.now() + 30_000;
    while (performance.now() < deadline) {
      const counts = await readCounts();
      assert.equal(counts.unexpected, 0);
      if (counts.completed === QUEUE_ITEMS) {
        assert.equal(counts.inventory, INGESTION_ITEMS);
        assert.equal(counts.enriched, QUEUE_ITEMS);
        return counts;
      }
      await delay(50);
    }
    throw new Error('analysis_capacity_queue_completion_missing');
  }

  async function close() {
    resume.resolve();
    queue.stopWorker();
    const settled = await Promise.allSettled([scan, worker]);
    const deadline = performance.now() + 30_000;
    while (queue.processing > 0 && performance.now() < deadline) await delay(50);
    assert.equal(queue.processing, 0);
    assert.equal(serviceErrors, 0);
    const failure = settled.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }

  return { originalLibraryId: queueLibrary.id, start, resume: () => resume.resolve(), finish, close,
    completions: () => ({ scanCompletedAt, queueCompletedAt }) };
}
