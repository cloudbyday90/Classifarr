/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resourceStudyProfile } from '../../scripts/resourceStudyProfiles.mjs';
import { resourceStudyBudget } from '../../scripts/resourceStudyBudget.mjs';

export function resourceStudyStartupFixture(budget = 'baseline') {
  return { budget, metrics: resourceStudyReceiptFixture('smoke', budget).initial };
}

export function resourceStudyReceiptFixture(mode = 'smoke', budget = 'baseline') {
  const profile = resourceStudyProfile(mode), limits = resourceStudyBudget(budget);
  const initial = { version: 2, memoryBytes: 1000, limitBytes: 2 * 1024 ** 3, oom: 0, oomKill: 0,
    memoryLimitHits: 0, cpuUsec: 100, cpuQuotaUsec: limits.cpus ? limits.cpus * 100000 : -1,
    cpuPeriodUsec: 100000, cpuPeriods: 0, cpuThrottledPeriods: 0, throttledUsec: 0,
    pids: 10, pidsLimit: limits.pids, pidsLimitHits: 0 };
  return { status: 'passed', version: 'resource_study.v3', profile: mode, budget,
    requestedDurationMs: profile.durationMs, durationMs: profile.durationMs + 100,
    evaluationRows: profile.rows, vectorDimensions: profile.dimensions, initial, final: { ...initial },
    backlog: { completed: 1620, pending: 0, failed: 0, routing: 0 }, counters: { evaluations: 1 }, drainMs: 100,
    metrics: { containerBytes: { max: 1024 }, containerCores: { p95: 1 }, eventLoopP99Ms: { max: 20 }, pids: { max: 10 } },
    queueRecovery: { cohortSize: 20, started: 20, completed: 20, startedDuringPressure: 0,
      holdChecks: 5, heldMs: 10000, firstDispatchMs: 500, completedMs: 2000 } };
}
