/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Session } from 'node:inspector/promises';
import { performance } from 'node:perf_hooks';
import { summarizeComparisonHeapProfile } from './heapSampling.mjs';
import { ALLOCATION_PHASES } from './allocationContract.mjs';
import { createVectorReadObservation } from './vectorReadObservation.mjs';

/** Synthetic main-isolate windows; never queue competing work to obtain a sample. */
export function createComparisonAllocationWindows({ enabled = false, context = () => null,
  now = () => Math.round(performance.now()), memory = process.memoryUsage,
  createSession = () => new Session(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (typeof enabled !== 'boolean') throw new Error('comparison_allocation_scope_invalid');
  const windows = [];
  let active = null, failed = false;
  const invalid = () => { failed = true; throw new Error('comparison_allocation_failed'); };
  const check = () => { if (failed) invalid(); };
  async function begin(phase) {
    if (!enabled) return async () => {};
    let identity;
    try { identity = context(); } catch { invalid(); }
    if (failed || active || windows.length >= 128 || !Object.hasOwn(ALLOCATION_PHASES, phase) ||
        identity?.worker !== ALLOCATION_PHASES[phase] || !Number.isSafeInteger(identity.attempt) ||
        identity.attempt < 1 || identity.attempt > 60) invalid();
    const token = {}; active = token;
    let session, observation, timer, disconnected = false, finished = false, startMs, before;
    const disconnect = () => {
      if (disconnected) return;
      disconnected = true;
      try { observation?.close(); } catch { failed = true; }
      try { session?.disconnect(); } catch { failed = true; }
    };
    try {
      session = createSession(); session.connect();
      timer = setTimer(() => { failed = true; disconnect(); }, 360_000); timer?.unref?.();
      await session.post('HeapProfiler.startSampling', { samplingInterval: 524288,
        includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
      check(); startMs = now(); before = memory();
      observation = createVectorReadObservation(identity, context);
    } catch {
      clearTimer(timer); disconnect(); active = null; invalid();
    }
    return async (completed = true) => {
      if (finished) invalid();
      finished = true;
      try {
        if (!completed || active !== token) invalid();
        check();
        const endMs = now(), after = memory();
        observation.close();
        const vectorReads = observation.read();
        const { profile } = await session.post('HeapProfiler.stopSampling');
        check();
        windows.push({ phase, worker: identity.worker, attempt: identity.attempt, startMs, endMs,
          heapStart: before.heapUsed, heapEnd: after.heapUsed, rssStart: before.rss, rssEnd: after.rss,
          profile: summarizeComparisonHeapProfile(profile), vectorReads });
      } catch { invalid(); }
      finally { clearTimer(timer); disconnect(); active = null; }
      check();
    };
  }
  return {
    begin,
    async run(phase, work) {
      if (!enabled) return work();
      const finish = await begin(phase);
      let completed = false;
      try { const value = await work(); completed = true; return value; }
      finally { await finish(completed); }
    },
    check,
    read() {
      if (!enabled) return null;
      check(); if (active) invalid();
      return { version: 2, mode: 'allocations', intervalBytes: 524288, windows: structuredClone(windows) };
    },
  };
}
