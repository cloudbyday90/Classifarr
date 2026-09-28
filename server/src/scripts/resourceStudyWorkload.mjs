/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { MediaSyncService } from '../services/mediaSync.mjs';
import { QueueService } from '../services/queueService.mjs';
import { QueueTaskProcessorService } from '../services/queueTaskProcessorService.mjs';
import { createBackgroundResourceAdmission } from '../services/backgroundResourceAdmission.mjs';
import { readRuntimeMemory } from '../services/runtimeMemoryBudget.mjs';
import { createInventoryDiscoveryAdmission } from '../services/inventoryDiscoveryAdmission.mjs';
import { runAutomaticSourcePairThread } from '../services/automaticSourcePairThreadClient.mjs';
import { LibraryInventoryProfileRefreshPlanner } from '../services/libraryInventoryProfileRefreshPlanner.mjs';
import { PolicyProfileRefreshOutboxWorker } from '../services/policyProfileRefreshOutboxWorker.mjs';
import { createLibraryProfileService } from '../services/libraryProfileService.mjs';
import { readLibraryProfileRefreshStatus } from '../services/libraryProfileRefreshStatus.mjs';
import { createResourceStudyFixture, seedResourceStudyLibraries, resourceStudyEvaluationSnapshot, studyPhase } from './resourceStudyFixtures.mjs';
import { createStudySampler, readStudyCgroup, assertStudyCgroup, summarizeStudySamples, observeStudyAdmission } from './resourceStudyMetrics.mjs';
import { resourceStudyProfile, assertResourceStudyReceipt } from './resourceStudyProfiles.mjs';
import { createStudyQueueRecovery } from './resourceStudyQueueRecovery.mjs';
import { assertStudyBudget, summarizeBudgetEnforcement, resourceStudyBudget } from './resourceStudyBudget.mjs';

export async function readStudyBacklog(db) {
  return (await db.query(`SELECT count(*) FILTER (WHERE status IN ('pending','processing'))::integer AS pending,
    count(*) FILTER (WHERE status='failed')::integer AS failed,
    count(*) FILTER (WHERE task_type<>'metadata_enrichment')::integer AS routing,
    count(*) FILTER (WHERE status='completed')::integer AS completed,
    COALESCE(max(EXTRACT(EPOCH FROM clock_timestamp()-created_at)) FILTER (WHERE status='pending'),0)::float AS "oldestPendingSeconds"
    FROM task_queue`)).rows[0];
}

/** Runs only inside the separately guarded disposable study process. */
export async function runResourceStudyWorkload(db, mode, progress = () => {}, budget = 'baseline') {
  resourceStudyBudget(budget);
  const profile = resourceStudyProfile(mode), { durationMs } = profile;
  const start = performance.now(), fixture = createResourceStudyFixture();
  let phase = 'warmup', stopped = false, serviceErrors = 0;
  const readMemory = () => {
    const memory = readRuntimeMemory();
    return phase === 'telemetry_pressure' ? { ...memory, available: 256 * 1024 * 1024 } : memory;
  };
  const admission = observeStudyAdmission(createBackgroundResourceAdmission({ readMemory }));
  const logger = { info() {}, debug() {}, warn() {}, error() { serviceErrors++; } };
  const libraries = await seedResourceStudyLibraries(db), ids = libraries.map(row => row.id);
  const sync = new MediaSyncService({ resourceAdmission: admission,
    mediaServerServices: { getMediaServerService: async () => fixture.adapter } });
  const queue = new QueueService({ db, logger, resourceAdmission: admission, tmdbService: fixture.provider,
    aiRouterService: { checkAvailability: async () => false },
    classificationService: { classifyQueueTask() { throw new Error('resource_study_routing_forbidden'); } } });
  queue.queueTaskProcessorService = new QueueTaskProcessorService({ db, logger, tmdbService: fixture.provider,
    queueOmdbEnrichmentService: { enrich: async () => {} }, queueWebSearchEnrichmentService: { enrich: async () => {} },
    completeTask: (...args) => queue.completeTask(...args), failTask: (...args) => queue.failTask(...args) });
  const recovery = createStudyQueueRecovery({ db, queue, admission });
  const processTask = queue.processTask.bind(queue);
  queue.processTask = task => { recovery.onStart(task); return processTask(task); };
  const planner = new LibraryInventoryProfileRefreshPlanner({ dbClient: db });
  const profiles = new PolicyProfileRefreshOutboxWorker({ dbClient: db,
    profileService: createLibraryProfileService({ dbClient: db }), loggerInstance: logger });
  const evaluate = createInventoryDiscoveryAdmission({ withSessionAdvisoryLock: db.withSessionAdvisoryLock,
    readMemory, resourceAdmission: admission });
  // Verify limits before allocating the sampler's event-loop histogram.
  assertStudyBudget(await readStudyCgroup(), budget);
  const sampler = await createStudySampler();
  assert.equal(sampler.initial.limitBytes, 2 * 1024 ** 3);
  assertStudyCgroup(sampler.initial);
  const counters = { scans: 0, scanDeferrals: 0, providerFailures: 0, preservedOutages: 0, evaluations: 0,
    evaluationDeferrals: 0, ignoredMusic: 0, growthWaves: 0 };
  const countInventory = async () => (await db.query('SELECT count(*)::integer AS count FROM media_server_items')).rows[0].count;
  const scan = async () => {
    let complete = true;
    const expectedOutage = phase === 'provider_outage', before = await countInventory();
    fixture.setPhase(expectedOutage ? 'provider_outage' : 'recovery');
    for (let offset = 0; offset < libraries.length; offset += 2) {
      await Promise.all(libraries.slice(offset, offset + 2).map(async library => {
        const result = await sync.syncLibrary(library.id, { batchSize: 100 });
        if (result.deferred) {
          complete = false;
          counters.scanDeferrals++;
          if (expectedOutage && result.reason === 'source_preflight_unavailable' && result.detail === 'unavailable') counters.providerFailures++;
          return;
        }
        assert.equal(result.success, true); counters.scans++; counters.ignoredMusic += result.ignoredItems;
      }));
    }
    if (expectedOutage) { assert.equal(await countInventory(), before); counters.preservedOutages++; }
    return complete;
  };
  const refresh = async () => {
    await planner.run(); const result = await profiles.run();
    assert.equal(result.failed, 0); assert.equal(result.retried, 0);
  };
  const worker = queue.startWorker();
  let producer, evaluator;
  try {
    // Bounded, non-overlapping loops; all started promises are joined before exit.
    producer = (async () => {
      for (let wave = 0; wave < 20 && !stopped; wave++) {
        fixture.grow(profile.growth); counters.growthWaves++; await scan();
        await delay(Math.max(0, start + (wave + 1) * durationMs / 20 - performance.now()));
      }
    })();
    evaluator = (async () => {
      while (!stopped) {
        try {
          await evaluate(async signal => {
            const result = await runAutomaticSourcePairThread(resourceStudyEvaluationSnapshot(profile), null, signal);
            assert.equal(result.report.status, 'complete'); counters.evaluations++;
          }, { signal: AbortSignal.timeout(120000) });
        } catch (error) {
          if (error.message !== 'inventory_discovery_deferred') throw error;
          counters.evaluationDeferrals++;
        }
        await delay(profile.evaluationIntervalMs);
      }
    })();
    // Observe loop failures immediately without orphaning the other loop.
    let failure;
    producer.catch(error => { failure = error; }); evaluator.catch(error => { failure = error; });
    while (performance.now() - start < durationMs) {
      if (failure) throw failure;
      const nextPhase = studyPhase(performance.now() - start, durationMs);
      if (nextPhase !== phase) {
        if (phase === 'telemetry_pressure') { await recovery.checkHeld(); recovery.clear(); }
        phase = nextPhase;
        if (phase === 'telemetry_pressure') await recovery.hold();
      }
      await queue.refillQueue(); await refresh();
      if (phase === 'telemetry_pressure') await recovery.checkHeld();
      await recovery.checkRecovery();
      await sampler.sample(phase, await readStudyBacklog(db));
      if (sampler.samples.length % 15 === 1) progress({ phase, elapsedSeconds: Math.round((performance.now() - start) / 1000), ...counters });
      await delay(2000);
    }
    stopped = true; await Promise.all([producer, evaluator]);
    phase = 'drain'; fixture.setPhase(phase); let finalScanComplete = await scan();
    const drainStart = performance.now();
    let complete = false;
    while (performance.now() - drainStart < 120000) {
      if (!finalScanComplete) finalScanComplete = await scan();
      await queue.refillQueue(); await refresh();
      await recovery.checkRecovery();
      const backlog = await readStudyBacklog(db);
      await sampler.sample(phase, backlog);
      const states = (await readLibraryProfileRefreshStatus(db)).libraries.filter(row => ids.includes(row.libraryId));
      if (finalScanComplete && !backlog.pending && states.length === 4 && states.every(row => row.statusId === 'current' &&
        row.profileRevision === row.sourceRevision && row.acknowledgedRevision === row.sourceRevision)) { complete = true; break; }
      await delay(1000);
    }
    assert.equal(complete, true, 'study_drain_incomplete');
    const backlog = await readStudyBacklog(db), final = await readStudyCgroup();
    assertStudyCgroup(final);
    assertStudyBudget(final, budget);
    assert.equal(backlog.failed, 0); assert.equal(backlog.routing, 0); assert.equal(serviceErrors, 0);
    assert.equal(await countInventory(), fixture.count * 4);
    assert.equal((await db.query("SELECT count(*)::integer AS count FROM media_server_items WHERE media_type NOT IN ('movie','tv')")).rows[0].count, 0);
    assert.equal((await db.query("SELECT count(*)::integer AS count FROM library_ingestion_state WHERE library_id=ANY($1::integer[]) AND (phase<>'complete' OR backfill_run_id IS DISTINCT FROM run_id OR backfill_completed_at IS NULL)", [ids])).rows[0].count, 0);
    assert.equal(final.oom, sampler.initial.oom); assert.equal(final.oomKill, sampler.initial.oomKill);
    assert.equal(final.memoryLimitHits, sampler.initial.memoryLimitHits);
    assert.ok(counters.evaluations > 0 && counters.providerFailures > 0 && counters.preservedOutages > 0);
    for (const row of Object.values(admission.classes)) assert.ok(row.memory_pressure > 0);
    const result = { version: 'resource_study.v3', profile: mode, budget, evaluationRows: profile.rows,
      vectorDimensions: profile.dimensions, queueRecovery: recovery.receipt,
      status: 'passed', durationMs: Math.round(performance.now() - start),
      requestedDurationMs: durationMs, scope: 'synthetic_services_not_model_accuracy', pressure: 'injected_telemetry_not_physical',
      inventory: fixture.count * 4, backlog, counters, drainMs: Math.round(performance.now() - drainStart),
      admission: admission.classes, initial: sampler.initial, final,
      enforcement: summarizeBudgetEnforcement(sampler.initial, final),
      metrics: summarizeStudySamples(sampler.samples), phases: Object.fromEntries([...new Set(sampler.samples.map(row => row.phase))]
        .map(name => [name, summarizeStudySamples(sampler.samples.filter(row => row.phase === name))])) };
    assertResourceStudyReceipt(result, mode, budget);
    return result;
  } finally {
    stopped = true; queue.stopWorker();
    await Promise.allSettled([producer, evaluator, worker]);
    const deadline = performance.now() + 30000;
    while (queue.processing > 0 && performance.now() < deadline) await delay(50);
    sampler.close();
    assert.equal(queue.processing, 0, 'study_workers_did_not_settle');
    assert.equal(serviceErrors, 0, 'study_service_errors');
    for (const row of Object.values(admission.classes)) assert.equal(row.active, 0, 'study_permit_leak');
  }
}
