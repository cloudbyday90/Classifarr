/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

export function parseResourceCounter(text) {
  if (typeof text !== 'string' || !/^\d+\s*$/.test(text)) return null;
  const value = Number(text.trim());
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function parseResourceFields(text) {
  const result = Object.create(null);
  if (typeof text !== 'string') return result;
  for (const line of text.trim().split('\n')) {
    const [key, value, extra] = line.trim().split(/\s+/);
    if (key && !extra && !Object.hasOwn(result, key)) result[key] = parseResourceCounter(value);
  }
  return result;
}

// Paths below are fixed application-owned cgroup counters; no CLI or provider input.
// eslint-disable-next-line security/detect-non-literal-fs-filename
export async function readStudyCgroup(read = path => readFile(path, 'utf8')) {
  const readMany = paths => Promise.all(paths.map(async name => {
    try { return await read(`/sys/fs/cgroup/${name}`); } catch { return null; }
  }));
  const [controllers] = await readMany(['cgroup.controllers']);
  if (typeof controllers !== 'string') {
    const values = await readMany(['memory/memory.usage_in_bytes', 'memory/memory.limit_in_bytes',
      'memory/memory.oom_control', 'cpuacct/cpuacct.usage', 'cpu/cpu.stat', 'pids/pids.current', 'memory/memory.failcnt']);
    const memory = parseResourceFields(values[2]), cpu = parseResourceFields(values[4]);
    const toUsec = value => value === null || value === undefined ? null : value / 1000;
    return { version: 1, memoryBytes: parseResourceCounter(values[0]), limitBytes: parseResourceCounter(values[1]),
      oom: null, oomKill: memory.oom_kill ?? null, underOom: memory.under_oom ?? null,
      memoryLimitHits: parseResourceCounter(values[6]), cpuUsec: toUsec(parseResourceCounter(values[3])),
      throttledUsec: toUsec(cpu.throttled_time), pids: parseResourceCounter(values[5]) };
  }
  const values = await readMany(['memory.current', 'memory.max', 'memory.events', 'cpu.stat', 'pids.current']);
  const memory = parseResourceFields(values[2]), cpu = parseResourceFields(values[3]);
  return { version: 2, memoryBytes: parseResourceCounter(values[0]), limitBytes: parseResourceCounter(values[1]),
    underOom: null, memoryLimitHits: memory.max ?? null,
    oom: memory.oom ?? null, oomKill: memory.oom_kill ?? null, cpuUsec: cpu.usage_usec ?? null,
    throttledUsec: cpu.throttled_usec ?? null, pids: parseResourceCounter(values[4]) };
}

export function assertStudyCgroup(metrics) {
  if (![1, 2].includes(metrics.version) ||
    !['memoryBytes', 'limitBytes', 'memoryLimitHits', 'oomKill', 'cpuUsec', 'throttledUsec', 'pids']
      .every(key => Number.isFinite(metrics[key]) && metrics[key] >= 0) ||
    (metrics.version === 1 && metrics.underOom !== 0) || (metrics.version === 2 && !Number.isFinite(metrics.oom))) {
    throw new Error('resource_study_metrics_unavailable');
  }
}

export function summarizeStudySamples(samples) {
  const numeric = key => samples.map(row => row[key]).filter(Number.isFinite).sort((a, b) => a - b);
  return Object.fromEntries(['rssBytes', 'heapBytes', 'containerBytes', 'processCores', 'containerCores',
    'eventLoopP99Ms', 'pending', 'oldestPendingSeconds', 'pids'].map(key => {
    const values = numeric(key);
    return [key, values.length ? { samples: values.length, min: values[0],
      p50: values[Math.ceil(values.length * 0.5) - 1], p95: values[Math.ceil(values.length * 0.95) - 1], max: values.at(-1) } : null];
  }));
}

/** Explicit lifetime; no production timer, no unbounded per-task telemetry. */
export async function createStudySampler({ cgroup = readStudyCgroup } = {}) {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  const initial = await cgroup();
  assertStudyCgroup(initial);
  let previous = { at: performance.now(), cpu: process.cpuUsage(), cgroup: initial };
  const samples = [];
  histogram.enable();
  return {
    initial, samples,
    async sample(phase, backlog) {
      if (samples.length >= 2000) throw new Error('resource_study_sample_budget');
      const current = await cgroup(), at = performance.now(), cpu = process.cpuUsage();
      assertStudyCgroup(current);
      if (current.version !== initial.version || current.limitBytes !== initial.limitBytes ||
        current.oomKill !== initial.oomKill || current.memoryLimitHits !== initial.memoryLimitHits ||
        current.oom !== initial.oom) throw new Error('resource_study_container_pressure_or_drift');
      const elapsedUsec = (at - previous.at) * 1000;
      const usage = process.memoryUsage();
      samples.push({ phase, atMs: Math.round(at), rssBytes: usage.rss, heapBytes: usage.heapUsed,
        containerBytes: current.memoryBytes, pids: current.pids,
        processCores: elapsedUsec > 0 ? (cpu.user + cpu.system - previous.cpu.user - previous.cpu.system) / elapsedUsec : null,
        containerCores: Number.isFinite(current.cpuUsec) && Number.isFinite(previous.cgroup.cpuUsec) &&
          current.cpuUsec >= previous.cgroup.cpuUsec && elapsedUsec > 0
          ? (current.cpuUsec - previous.cgroup.cpuUsec) / elapsedUsec : null,
        eventLoopP99Ms: histogram.count ? histogram.percentile(99) / 1e6 : null, ...backlog });
      histogram.reset(); previous = { at, cpu, cgroup: current };
    },
    close() { histogram.disable(); },
  };
}

/** Admission attempts are not unique jobs. Waits end at the next successful admission. */
export function observeStudyAdmission(admission, now = () => performance.now()) {
  const classes = Object.fromEntries(['ingestion', 'queue', 'discovery'].map(kind => [kind,
    { allowed: 0, busy: 0, memory_pressure: 0, memory_unknown: 0, active: 0, peakActive: 0,
      waitMs: 0, maxWaitMs: 0, waitingSince: null }]));
  return {
    classes,
    tryAcquire(kind) {
      const permit = admission.tryAcquire(kind), row = classes[kind];
      if (!permit.allowed) {
        row[permit.reason]++; row.waitingSince ??= now(); return permit;
      }
      if (row.waitingSince !== null) {
        const wait = now() - row.waitingSince;
        row.waitMs += wait; row.maxWaitMs = Math.max(row.maxWaitMs, wait); row.waitingSince = null;
      }
      row.allowed++; row.active++; row.peakActive = Math.max(row.peakActive, row.active);
      let released = false;
      return { allowed: true, release() { if (!released) { released = true; row.active--; permit.release(); } } };
    },
  };
}
