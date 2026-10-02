/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resourceStudyProfile } from '../../scripts/resourceStudyProfiles.mjs';
import { resourceStudyBudget } from '../../scripts/resourceStudyBudget.mjs';
import { summarizeStudyTrend } from '../../scripts/resourceStudyTrend.mjs';

export function resourceStudyStartupFixture(budget = 'baseline') {
  return { budget, metrics: resourceStudyReceiptFixture('smoke', budget).initial };
}

export function resourceStudyReceiptFixture(mode = 'smoke', budget = 'baseline') {
  const profile = resourceStudyProfile(mode), limits = resourceStudyBudget(budget);
  const initial = { version: 2, memoryBytes: 1000, limitBytes: limits.memoryBytes ?? 2 * 1024 ** 3, oom: 0, oomKill: 0,
    memoryLimitHits: 0, cpuUsec: 100, cpuQuotaUsec: limits.cpus ? limits.cpus * 100000 : -1,
    cpuPeriodUsec: 100000, cpuPeriods: 0, cpuThrottledPeriods: 0, throttledUsec: 0,
    pids: 10, pidsLimit: limits.pids, pidsLimitHits: 0 };
  const timing = { steady: [profile.durationMs * 0.2, profile.durationMs * 0.2],
    recovery: [profile.durationMs * 0.6, profile.durationMs * 0.4], idle: [profile.durationMs + 100, profile.idleMs] };
  const samples = ['steady', 'recovery', 'idle'].flatMap(phase =>
    Array.from({ length: 6 }, (_, index) => ({ phase, atMs: timing[phase][0] + index * timing[phase][1] / 5,
      rssBytes: 1000, heapBytes: 500, externalBytes: 100, arrayBufferBytes: 50, containerBytes: 2000,
      pending: 0, failed: 0, routing: 0, completed: 20, oldestPendingSeconds: 0 })));
  return { status: 'passed', version: 'resource_study.v6', profile: mode, budget,
    inventory: profile.growth * 80, uniqueCompleted: profile.growth * 80,
    providerRecovery: { cohortSize: 8, uniqueCompleted: 8, pending: 0, chargedAttempts: 2,
      httpAttempts: 11, successes: 8, authentication: 1, throttled: 1, unavailable: 1, unexpected: 0,
      resets: 1, repairs: 1, peakPending: 8, preservedWaitChecks: 4, pressureDeferrals: 2, passes: 30,
      transientMinWaitMs: 31000, recoveryMs: 80000, httpDuringPressure: 0, maxActive: 1 },
    requestedDurationMs: profile.durationMs, durationMs: profile.durationMs + profile.idleMs + 100,
    trend: summarizeStudyTrend(samples, profile.idleMs),
    evaluationRows: profile.rows, vectorDimensions: profile.dimensions, initial, final: { ...initial },
    backlog: { completed: 1620, pending: 0, failed: 0, routing: 0 },
    counters: { evaluations: 1, providerFailures: 1, preservedOutages: 1 }, drainMs: 100,
    metrics: { containerBytes: { max: 1024 }, containerCores: { p95: 1 }, eventLoopP99Ms: { max: 20 }, pids: { max: 10 } },
    queueRecovery: { cohortSize: 20, started: 20, completed: 20, startedDuringPressure: 0,
      holdChecks: 5, heldMs: 10000, firstDispatchMs: 500, completedMs: 2000 } };
}
