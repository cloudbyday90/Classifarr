/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Session } from 'node:inspector/promises';
import { setImmediate } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';
import { readStudyCgroup, assertStudyCgroup } from '../resourceStudyMetrics.mjs';
import { assertStudyBudget } from '../resourceStudyBudget.mjs';
import { readComparisonResidentMemory } from './residentMemory.mjs';

/** Aggregate-only observer. Weak references never own the measured snapshots. */
export function createComparisonMemoryMetrics({ collect = false, emit = value => process.stdout.write(`${JSON.stringify(value)}\n`) } = {}) {
  const workers = new Map(), references = [], phases = new Map();
  const started = performance.now();
  let created = 0, exited = 0, phase = 'setup', sampling = null, residentSampling = null, sampleError = null, timer, cgroupVersion;
  const session = collect ? new Session() : null;
  session?.connect();
  const onWorker = worker => {
    created++; workers.set(worker.threadId, worker);
    const id = worker.threadId;
    worker.once('exit', () => { exited++; workers.delete(id); });
  };
  process.on('worker', onWorker);
  const sample = async () => {
    const name = phase, usage = process.memoryUsage(), cgroup = await readStudyCgroup();
    assertStudyCgroup(cgroup); assertStudyBudget(cgroup, 'bounded');
    cgroupVersion = cgroup.version;
    const mainHeap = getHeapStatistics();
    const heaps = await Promise.all([...workers.values()].map(worker => worker.getHeapStatistics().catch(error => {
      if (error.code !== 'ERR_WORKER_NOT_RUNNING') throw error;
      return null;
    })));
    const current = { ...usage, containerBytes: cgroup.memoryBytes, kernelPeakBytes: cgroup.memoryPeakBytes, pids: cgroup.pids,
      activeWorkers: workers.size, workerHeapUsed: heaps.reduce((sum, row) => sum + (row?.used_heap_size ?? 0), 0),
      mainHeapPhysicalBytes: mainHeap.total_physical_size,
      mainV8MallocBytes: mainHeap.malloced_memory,
      workerHeapPhysicalBytes: heaps.reduce((sum, row) => sum + (row?.total_physical_size ?? 0), 0),
      memoryLimitHits: cgroup.memoryLimitHits, oomKill: cgroup.oomKill };
    if (!phases.has(name) && phases.size >= 128) throw new Error('comparison_memory_phase_budget');
    const peak = phases.get(name) ?? { samples: 0 };
    peak.samples++;
    for (const [key, value] of Object.entries(current)) {
      peak[key] = Number.isFinite(value) ? Math.max(peak[key] ?? 0, value) : (peak[key] ?? null);
    }
    phases.set(name, peak);
    return current;
  };
  const sampleOnce = () => {
    sampling ??= sample().finally(() => { sampling = null; });
    return sampling;
  };
  return {
    track(kind, value) {
      if (references.length >= 256) throw new Error('comparison_memory_reference_budget');
      references.push({ kind, ref: new WeakRef(value) });
    },
    async start() {
      await sampleOnce();
      timer = setInterval(() => {
        if (!sampling) void sampleOnce().catch(error => { sampleError = error; });
      }, 1000);
      timer.unref();
    },
    async mark(name, extra = {}) {
      await sampling;
      if (sampleError) throw sampleError;
      phase = name;
      const current = await sampleOnce();
      // Concurrent phase callbacks share this observation, never start overlapping proc walks.
      residentSampling ??= readComparisonResidentMemory(cgroupVersion).finally(() => { residentSampling = null; });
      const resident = await residentSampling;
      emit({ phase: name, elapsedMs: Math.round(performance.now() - started), ...current, resident,
        createdWorkers: created, exitedWorkers: exited, ...extra });
    },
    async settled(name, extra = {}) {
      // Separate turns before collection avoid WeakRef's same-job keep-alive guarantee.
      await setImmediate();
      if (session) { await session.post('HeapProfiler.collectGarbage'); await setImmediate(); }
      const alive = {};
      for (const { kind, ref } of references) alive[kind] = (alive[kind] ?? 0) + Number(Boolean(ref.deref()));
      await this.mark(name, { ...extra, diagnosticGc: collect, alive });
    },
    async close() {
      clearInterval(timer); await sampling; await residentSampling;
      process.off('worker', onWorker); session?.disconnect();
      const summary = { phase: 'summary', createdWorkers: created, exitedWorkers: exited, activeWorkers: workers.size,
        peaks: Object.fromEntries(phases) };
      emit(summary);
      if (sampleError) throw sampleError;
      if (workers.size || created !== exited) throw new Error('comparison_memory_worker_not_settled');
      return summary;
    },
  };
}
