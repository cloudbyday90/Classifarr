/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { PerformanceObserver, performance, constants } from 'node:perf_hooks';
import { isMainThread } from 'node:worker_threads';
import { setImmediate } from 'node:timers/promises';

export const POST_STOP_GC_WAIT_MS = 300_000;

/** Observe, never request collection. No referents or unbounded event history are held here. */
export async function observeNaturalMajorGc({ Observer = PerformanceObserver, now = () => performance.now(),
  nextTurn = setImmediate, setTimer = setTimeout, clearTimer = clearTimeout, mainThread = isMainThread } = {}) {
  assert.equal(mainThread, true, 'comparison_gc_main_thread_required');
  // The preceding weak-reference sample must leave its kept-objects job first.
  await nextTurn();
  const windowStartMs = now(), deadline = windowStartMs + POST_STOP_GC_WAIT_MS;
  return new Promise((resolve, reject) => {
    let timer, done = false;
    const finish = (event = null, error = null) => {
      if (done) return;
      done = true; clearTimer(timer); observer.disconnect();
      if (error) reject(error);
      else resolve({ status: event ? 'observed' : 'not_observed', scope: 'main_thread_major_gc_event',
        windowStartMs, windowEndMs: now(), waitBudgetMs: POST_STOP_GC_WAIT_MS, event });
    };
    const accept = entries => {
      try {
        for (const entry of entries) {
          if (done) return;
          if (entry.entryType !== 'gc' || entry.detail?.kind !== constants.NODE_PERFORMANCE_GC_MAJOR) continue;
          const { startTime, duration } = entry, { kind, flags } = entry.detail;
          assert.ok(Number.isFinite(startTime) && startTime >= 0 && Number.isFinite(duration) && duration >= 0);
          if (startTime < windowStartMs || startTime + duration > deadline) continue;
          assert.ok(startTime + duration <= now(), 'comparison_gc_future_event');
          assert.ok(Number.isSafeInteger(flags) && flags >= 0 && flags <= 126 && (flags & 1) === 0, 'comparison_gc_flags_invalid');
          assert.equal(flags & constants.NODE_PERFORMANCE_GC_FLAGS_FORCED, 0, 'comparison_gc_forced');
          finish({ startMs: startTime, durationMs: duration, kind, flags });
        }
      } catch (error) { finish(null, error); }
    };
    const observer = new Observer(list => {
      try { accept(list.getEntries()); } catch (error) { finish(null, error); }
    });
    try {
      observer.observe({ entryTypes: ['gc'] });
      timer = setTimer(() => {
        try { accept(observer.takeRecords()); finish(); }
        catch (error) { finish(null, error); }
      }, POST_STOP_GC_WAIT_MS);
    } catch (error) { finish(null, error); }
  });
}
