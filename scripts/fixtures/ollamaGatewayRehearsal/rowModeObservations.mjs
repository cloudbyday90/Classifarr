/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance, PerformanceObserver, constants } from 'node:perf_hooks';
import { RESTORE_METRICS } from './restoreStudyMetrics.mjs';

/** Bounded in-process observer; its allocations and elapsed reads are not subtracted. */
export async function observeRowRun(work, readSample) {
  const memory = {}, gc = { events: 0, major: 0, forced: 0, durationMs: 0 };
  let pending, timer, samples = 0, failed = false, last, maxGapMs = 0, observationMs = 0;
  const observer = new PerformanceObserver(list => record(list.getEntries()));
  const record = entries => {
    for (const entry of entries) {
      if (!Number.isFinite(entry.duration) || entry.duration < 0 || gc.events >= 100000) { failed = true; continue; }
      gc.events++; gc.durationMs += entry.duration;
      if (entry.detail.kind === constants.NODE_PERFORMANCE_GC_MAJOR) gc.major++;
      if (entry.detail.flags & constants.NODE_PERFORMANCE_GC_FLAGS_FORCED) gc.forced++;
    }
  };
  const tick = async () => {
    if (pending) return;
    const at = performance.now(); if (last !== undefined) maxGapMs = Math.max(maxGapMs, at-last); last = at;
    if (++samples > 512) { failed = true; return; }
    pending = (async () => {
      try {
        const values = await readSample();
        for (const key of RESTORE_METRICS.slice(0,10)) assert.ok(Number.isFinite(values[key]) && values[key] >= 0);
        for (const key of RESTORE_METRICS) if (values[key] !== undefined) {
          const value = values[key]; assert.ok(Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER);
          const item = memory[key] ??= { first: value, last: value, min: value, max: value, count: 0 };
          item.last = value; item.min = Math.min(item.min,value); item.max = Math.max(item.max,value); item.count++;
        }
      } catch { failed = true; }
      finally { observationMs += performance.now()-at; }
    })();
    try { await pending; } finally { pending = null; }
  };
  try {
    observer.observe({ entryTypes: ['gc'] }); await tick();
    const cpu = process.cpuUsage(), started = performance.now();
    timer = setInterval(() => { void tick(); }, 250);
    const value = await work();
    const elapsedMs = performance.now()-started, usage = process.cpuUsage(cpu);
    clearInterval(timer); await pending; await tick(); record(observer.takeRecords());
    assert.equal(failed,false); assert.ok(samples >= 2 && samples <= 512 && maxGapMs <= 2000);
    assert.equal(gc.forced,0);
    return { value, elapsedMs, processCpuUs: usage.user+usage.system, observations: { samples, maxGapMs, observationMs, memory }, gc };
  } finally { clearInterval(timer); await pending; observer.disconnect(); }
}
