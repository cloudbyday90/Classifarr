/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { createBackgroundResourceAdmission } from '../../services/backgroundResourceAdmission.mjs';
import { readStudyCgroup } from '../resourceStudyMetrics.mjs';
import { assertStudyBudget } from '../resourceStudyBudget.mjs';
import { assertStudyProviderEnvironment } from '../resourceStudyProviderFixture.mjs';
import { createComparisonMemoryFixture } from './fixture.mjs';
import { createComparisonMemoryMetrics } from './metrics.mjs';
import { measureRefreshCycles } from './refresh.mjs';
import { createComparisonStudyLoad } from './load.mjs';
import { assertComparisonConcurrentReceipt } from './contract.mjs';
import { observeComparisonStudyAdmission } from './admission.mjs';

export async function runComparisonConcurrentStudy(db, profile, budget, emit) {
  assertStudyProviderEnvironment(); assert.equal(budget, 'bounded');
  assert.ok(['comparison-control', 'comparison-concurrent'].includes(profile));
  const started = performance.now(), initial = await readStudyCgroup();
  assertStudyBudget(initial, budget);
  const admission = observeComparisonStudyAdmission(createBackgroundResourceAdmission());
  const metrics = createComparisonMemoryMetrics({ emit });
  let fixture, load, refresh, work = null, measurement, failure;
  const idle = [];
  try {
    await metrics.start();
    fixture = await createComparisonMemoryFixture();
    load = await createComparisonStudyLoad(db, admission);
    refresh = await measureRefreshCycles({ fixture, metrics, elapsed: true, cycles: 3, resourceAdmission: admission,
      onBuild: () => { if (profile === 'comparison-concurrent') load.start(); }, onCycle: () => load.check() });
    if (profile === 'comparison-concurrent') work = await load.drain();
    await load.close();
    const until = performance.now() + 300_000;
    await metrics.settled('post_stop_idle');
    while (performance.now() < until) {
      await delay(Math.min(30_000, until - performance.now()));
      const memory = process.memoryUsage(), cgroup = await readStudyCgroup();
      idle.push({ elapsedMs: Math.round(performance.now() - started), heapUsed: memory.heapUsed,
        rss: memory.rss, containerBytes: cgroup.memoryBytes });
      await metrics.settled('post_stop_idle');
    }
  } catch (error) { failure = error; }
  finally {
    try { await load?.close(); }
    catch (error) { failure ??= error; }
    try { await fixture?.close(); }
    catch (error) { failure ??= error; }
    try { measurement = await metrics.close(); }
    catch (error) { failure ??= error; }
  }
  if (failure) throw failure;
  const result = { version: 'comparison_concurrent.v1', status: 'measured', profile, budget,
    durationMs: Math.round(performance.now() - started), initial, final: await readStudyCgroup(),
    admission: admission.classes, overlap: admission.overlap, refresh, work, measurement, idle };
  assertComparisonConcurrentReceipt(result, budget); return result;
}
