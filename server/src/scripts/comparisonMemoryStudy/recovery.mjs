/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { createBackgroundResourceAdmission } from '../../services/backgroundResourceAdmission.mjs';
import { registerLiveMultiScaleSchedule } from '../../services/liveMultiScaleScheduler.mjs';
import { registerInventoryRepresentativeProfileSchedule } from '../../services/inventoryRepresentativeProfileScheduler.mjs';
import { readStudyCgroup } from '../resourceStudyMetrics.mjs';
import { assertStudyBudget } from '../resourceStudyBudget.mjs';
import { assertStudyProviderEnvironment } from '../resourceStudyProviderFixture.mjs';
import { createComparisonMemoryFixture } from './fixture.mjs';
import { createComparisonMemoryMetrics } from './metrics.mjs';
import { createComparisonStudyRefreshers } from './refresh.mjs';
import { observeComparisonStudyAdmission } from './admission.mjs';
import { createComparisonStudySchedule } from './schedule.mjs';
import { COMPARISON_RECOVERY_PROFILE, comparisonRecoveryEvidence, assertComparisonRecoveryReceipt } from './recoveryContract.mjs';

export async function runComparisonRecoveryStudy(budget, emit) {
  assertStudyProviderEnvironment(); assert.equal(budget, 'bounded');
  const started = performance.now(), initial = await readStudyCgroup(), scope = new AsyncLocalStorage();
  assertStudyBudget(initial, budget);
  const attempts = [], decisions = [], elapsed = () => Math.round(performance.now() - started);
  let observerFailed = false;
  const admission = observeComparisonStudyAdmission(createBackgroundResourceAdmission({ onDecision: decision => {
    const context = scope.getStore();
    if (!context || decisions.length >= 128) { observerFailed = true; return; }
    const row = { ...decision, ...context, elapsedMs: elapsed() };
    decisions.push(row); emit({ phase: 'recovery_admission', ...row });
  } }));
  const metrics = createComparisonMemoryMetrics({ emit }), controller = new AbortController();
  let fixture, refreshers, schedule, measurement, failure, firstReadyAt = null, sourceChanges = 0, sourceChangedAtMs = null;
  const stopWorkers = () => {
    controller.abort(); schedule?.liveMultiScaleWorker?.stop(); schedule?.inventoryRepresentativeProfileWorker?.stop();
    refreshers?.comparison.stop(); refreshers?.representative.stop();
  };
  try {
    await metrics.start(); fixture = await createComparisonMemoryFixture();
    refreshers = createComparisonStudyRefreshers({ fixture, metrics, resourceAdmission: admission, phase: () => 'recovery' });
    schedule = createComparisonStudySchedule({ execute: (worker, attempt, callback) => scope.run({ worker, attempt }, async () => {
      const report = await callback();
      const row = { worker, attempt, elapsedMs: elapsed(), status: report.status, reason: report.reason ?? null };
      attempts.push(row);
      if (worker === 'comparison' && ['ready', 'revalidated'].includes(row.status)) firstReadyAt ??= performance.now();
      await metrics.settled(`recovery_${worker}`, { ...row, ...refreshers.counts() });
    }) });
    const log = { info() {}, warn() {} };
    const wrap = worker => ({ stop: () => worker.stop(), run: () => worker.run({ signal: controller.signal }) });
    registerInventoryRepresentativeProfileSchedule(schedule, { worker: wrap(refreshers.representative), log });
    registerLiveMultiScaleSchedule(schedule, { worker: wrap(refreshers.comparison), log });
    const deadline = performance.now() + COMPARISON_RECOVERY_PROFILE.durationMs;
    while (performance.now() < deadline) {
      schedule.check(); assert.equal(observerFailed, false, 'comparison_recovery_observer_failed');
      if (!sourceChanges && firstReadyAt !== null && performance.now() - firstReadyAt >= 300_000 && !schedule.active) {
        await fixture.changeDescription(1); sourceChanges++; sourceChangedAtMs = elapsed();
        await metrics.mark('recovery_source_changed');
      }
      if (sourceChanges && comparisonRecoveryEvidence(attempts, decisions, sourceChangedAtMs).revalidated) break;
      await delay(1000);
    }
  } catch (error) { failure = error; }
  finally {
    try { if (schedule) await schedule.close(stopWorkers); else stopWorkers(); }
    catch (error) { failure ??= error; }
    try { await metrics.settled('stopped'); await fixture?.close(); }
    catch (error) { failure ??= error; }
    try { measurement = await metrics.close(); }
    catch (error) { failure ??= error; }
    scope.disable();
  }
  if (failure) throw failure;
  const result = { version: 'comparison_recovery.v1', status: 'measured', profile: 'comparison-recovery', budget,
    durationMs: elapsed(), initial, final: await readStudyCgroup(), sourceChanges, sourceChangedAtMs, attempts, decisions,
    measurement, admission: admission.classes, refresh: refreshers.counts() };
  assertComparisonRecoveryReceipt(result, budget); return result;
}
