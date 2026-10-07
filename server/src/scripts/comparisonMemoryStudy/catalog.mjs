/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { createBackgroundResourceAdmission } from '../../services/backgroundResourceAdmission.mjs';
import { withInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
import { registerLiveMultiScaleSchedule } from '../../services/liveMultiScaleScheduler.mjs';
import { registerInventoryRepresentativeProfileSchedule } from '../../services/inventoryRepresentativeProfileScheduler.mjs';
import { readStudyCgroup } from '../resourceStudyMetrics.mjs';
import { assertStudyBudget } from '../resourceStudyBudget.mjs';
import { assertStudyProviderEnvironment } from '../resourceStudyProviderFixture.mjs';
import { createComparisonCatalogFixture } from './catalogFixture.mjs';
import { createComparisonStudyLoad } from './load.mjs';
import { createComparisonMemoryMetrics } from './metrics.mjs';
import { createComparisonStudyRefreshers } from './refresh.mjs';
import { createComparisonStudyConsumers } from './consumers.mjs';
import { observeComparisonStudyAdmission } from './admission.mjs';
import { createComparisonStudySchedule } from './schedule.mjs';
import { COMPARISON_RECOVERY_PROFILE, comparisonRecoveryEvidence } from './recoveryContract.mjs';
import { comparisonCatalogCompletion, assertComparisonCatalogReceipt } from './catalogContract.mjs';
import { createComparisonAllocationWindows } from './allocationWindows.mjs';

export async function runComparisonCatalogStudy(database, budget, emit, { profileAllocations = false, observePostStopGc = false } = {}) {
  assertStudyProviderEnvironment(); assert.equal(budget, 'bounded');
  assert.equal(typeof observePostStopGc, 'boolean'); assert.ok(!observePostStopGc || !profileAllocations);
  const started = performance.now(), initial = await readStudyCgroup(), scope = new AsyncLocalStorage();
  assertStudyBudget(initial, budget);
  const attempts = [], decisions = [], elapsed = () => Math.round(performance.now() - started);
  const allocations = createComparisonAllocationWindows({ enabled: profileAllocations, context: () => scope.getStore(), now: elapsed });
  let observerFailed = false;
  const admission = observeComparisonStudyAdmission(createBackgroundResourceAdmission({ onDecision: decision => {
    if (decision.kind !== 'discovery') return;
    const context = scope.getStore();
    if (!context || decisions.length >= 128) { observerFailed = true; return; }
    const row = { ...decision, ...context, elapsedMs: elapsed() };
    decisions.push(row); emit({ phase: 'recovery_admission', ...row });
  } }));
  const metrics = createComparisonMemoryMetrics({ emit }), controller = new AbortController();
  let refreshers, schedule, load, drain, measurement, failure, work, coverage, consumers, beforeStop, drainedAtMs = null;
  let postStopGc, postStopResidency, workloadDurationMs;
  const stopWorkers = () => {
    controller.abort(); schedule?.liveMultiScaleWorker?.stop(); schedule?.inventoryRepresentativeProfileWorker?.stop();
    refreshers?.comparison.stop(); refreshers?.representative.stop();
    consumers?.stop();
  };
  try {
    await metrics.start();
    const fixture = await createComparisonCatalogFixture(database);
    load = await createComparisonStudyLoad(database, admission, { expectedItems: 5776,
      seed: async () => fixture.libraries, createFixture: () => fixture.transport,
      afterScan: async () => { coverage = await fixture.cacheDescriptions(); } });
    consumers = createComparisonStudyConsumers({ metrics, getRevision: fixture.getRevision });
    refreshers = createComparisonStudyRefreshers({ fixture, metrics, consumers,
      resourceAdmission: admission, phase: () => 'recovery', allocations: profileAllocations ? allocations : null });
    schedule = createComparisonStudySchedule({ execute: (worker, attempt, callback) => scope.run({ worker, attempt }, async () => {
      const report = await callback();
      allocations.check();
      const row = { worker, attempt, elapsedMs: elapsed(), status: report.status, reason: report.reason ?? null };
      attempts.push(row);
      const consumerState = consumers.read();
      assert.equal(consumerState.errors, 0, 'comparison_consumer_observer_failed');
      await metrics.settled(`recovery_${worker}`, { ...row, ...refreshers.counts(),
        shadowProcessed: consumerState.processed, readinessGroups: consumerState.groups });
    }) });
    const log = { info() {}, warn() {} };
    const wrap = worker => withInventoryBackgroundReadiness({ stop: () => worker.stop(),
      run: () => worker.run({ signal: controller.signal }) }, database);
    registerInventoryRepresentativeProfileSchedule(schedule, { worker: wrap(refreshers.representative), log });
    registerLiveMultiScaleSchedule(schedule, { worker: wrap(refreshers.comparison), log });
    load.start();
    drain = load.drain().then(async result => {
      work = result; drainedAtMs = elapsed();
      await metrics.mark('catalog_drained', { inventory: work.inventory, completed: work.completed,
        descriptions: coverage.descriptions, cached: coverage.cached });
    }).catch(error => { failure ??= error; });
    const deadline = performance.now() + COMPARISON_RECOVERY_PROFILE.durationMs;
    while (performance.now() < deadline) {
      if (failure) throw failure;
      schedule.check(); load.check(); assert.equal(observerFailed, false, 'comparison_catalog_observer_failed');
      if (comparisonCatalogCompletion(attempts, drainedAtMs)) break;
      await delay(1000);
    }
  } catch (error) { failure ??= error; }
  finally {
    beforeStop = consumers?.read();
    try { if (schedule) await schedule.close(stopWorkers); else stopWorkers(); }
    catch (error) { failure ??= error; }
    try { await load?.close(); } catch (error) { failure ??= error; }
    await drain;
    try { await metrics.settled('stopped'); }
    catch (error) { failure ??= error; }
    workloadDurationMs = elapsed();
    try {
      if (!failure && observePostStopGc) {
        const check = () => {
          const stopped = consumers.read();
          assert.equal(stopped.stopped, true); assert.equal(stopped.pending, 0); assert.equal(stopped.groups, 0);
          for (const kind of ['ingestion', 'queue', 'discovery']) assert.equal(admission.classes[kind].active, 0);
        };
        check();
        postStopGc = await metrics.observePostStopGc();
        check();
        if (postStopGc.status === 'observed') postStopResidency = await metrics.observePostStopResidency(check);
      }
    } catch (error) { failure ??= error; }
    try { measurement = await metrics.close(); }
    catch (error) { failure ??= error; }
    scope.disable();
  }
  if (failure) throw failure;
  const result = { version: 'comparison_catalog.v2', status: 'measured', profile: 'comparison-catalog', budget,
    durationMs: elapsed(), initial, final: await readStudyCgroup(), drainedAtMs, work, coverage, attempts, decisions,
    ...(observePostStopGc ? { postStopGc, workloadDurationMs } : {}),
    ...(postStopResidency ? { postStopResidency } : {}),
    pressureRecoveryObserved: Boolean(comparisonRecoveryEvidence(attempts, decisions, drainedAtMs).revalidated),
    measurement, ...(profileAllocations ? { allocations: allocations.read() } : {}), consumers: { beforeStop, afterStop: consumers.read() },
    admission: admission.classes, overlap: admission.overlap, refresh: refreshers.counts() };
  assertComparisonCatalogReceipt(result, budget); return result;
}
