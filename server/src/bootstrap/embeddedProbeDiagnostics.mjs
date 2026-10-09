/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { cpuUsage, memoryUsage, availableMemory, constrainedMemory } from 'node:process';

const stages = new Set(['identity_before', 'status_spawn', 'status_wait', 'identity_after', 'complete']);
const states = new Set(['ok', 'failed', 'transient', 'unjoined', 'cancelled']);
const number = value => Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), Number.MAX_SAFE_INTEGER) : null;

/** Diagnostics must never change a lifecycle decision, even when a sink fails. */
export function observeProbe(observer, event, value) {
  try { observer?.(event, value); } catch { /* best effort */ }
}

export function supervisorProbeResources() {
  const read = getter => { try { return number(getter()); } catch { return null; } };
  return { scope: 'supervisor', rssBytes: read(memoryUsage.rss),
    availableMemoryBytes: read(availableMemory), constrainedMemoryBytes: read(constrainedMemory) };
}

/**
 * Fixed-size numeric trace; never retain errors, PID-file contents or child output.
 * @param {{ timeoutMs: number, sequence: number, now?: () => number,
 *   cpu?: typeof cpuUsage,
 *   elu?: (previous?: import('node:perf_hooks').EventLoopUtilization) => import('node:perf_hooks').EventLoopUtilization }} options
 */
export function createEmbeddedProbeTrace({ timeoutMs, sequence, now = () => performance.now(),
  cpu = cpuUsage, elu = value => performance.eventLoopUtilization(value),
}) {
  const started = now();
  const startedAt = new Date().toISOString();
  let stage = 'check', since = started, helperStarted, joinStarted, outcome;
  let helperTimeout, deadline, joinElapsedMs;
  const durations = {};
  const read = getter => { try { return getter(); } catch { return undefined; } };
  const initialCpu = read(() => cpu());
  const initialElu = read(() => elu());
  const closeStage = time => { if (stage !== 'complete') durations[stage] = number(time - since); };
  const observe = (event, value) => {
    if (outcome) return;
    const time = now();
    if (stages.has(event)) {
      if (event === stage) return;
      closeStage(time); stage = event; since = time;
      if (event === 'status_spawn') helperStarted = time;
    } else if (event === 'helper_timeout' && !helperTimeout) {
      helperTimeout = { stage, elapsedMs: number(time - helperStarted), overshootMs: number(Math.max(0, time - helperStarted - 2000)) };
    } else if (event === 'deadline' && !deadline) {
      deadline = { stage, elapsedMs: number(time - started), overshootMs: number(Math.max(0, time - started - timeoutMs)) };
    } else if (event === 'join_start') joinStarted = time;
    else if (event === 'outcome') {
      closeStage(time);
      if (joinStarted !== undefined) joinElapsedMs = number(time - joinStarted);
      const usage = initialCpu && read(() => cpu(initialCpu));
      const utilization = initialElu && read(() => elu(initialElu));
      outcome = { sequence: number(sequence), startedAt, elapsedMs: number(time - started), timeoutMs: number(timeoutMs),
        state: states.has(value?.state) ? value.state : 'unknown', joined: value?.joined === true,
        lastStage: stage, stages: { ...durations },
        helperTimeout: helperTimeout ?? null, deadline: deadline ?? null, joinElapsedMs: joinElapsedMs ?? null,
        supervisorCpuUserMicros: number(usage?.user), supervisorCpuSystemMicros: number(usage?.system),
        supervisorEluPermille: number(utilization?.utilization * 1000) };
    }
  };
  return { observe, snapshot: () => outcome ?? null };
}
