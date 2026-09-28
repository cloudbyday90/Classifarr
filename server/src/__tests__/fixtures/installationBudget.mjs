/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const metrics = () => ({ version: 1, memoryBytes: 512 * 1024 ** 2, limitBytes: 2 * 1024 ** 3,
  oom: null, oomKill: 0, underOom: 0, memoryLimitHits: 0, cpuUsec: 2000, throttledUsec: 100,
  pids: 55, cpuQuotaUsec: 200000, cpuPeriodUsec: 100000, cpuPeriods: 10, cpuThrottledPeriods: 1,
  pidsLimit: 128, pidsLimitHits: 0 });
export const pressure = () => ({ maxConnections: 32, denialCode: '53300', connectionsHeld: 20, connectionsRemaining: 0,
  heldMs: 5000, recoveryMs: 100, freshConnection: 'passed', health: 'healthy',
  initial: metrics(), pressured: metrics(), recovered: metrics() });
export const backlog = () => ({ driver: 'startup_scheduler', checkpoint: 'preserved', committedIngestion: 'preserved',
  inventory: 'unchanged', taskIds: 'unchanged', profiles: 'current', movieItems: 300, tvItems: 300,
  completedTasks: 600, duplicateCompletions: 0, earlyReclaims: 0, routingTasks: 0, music: 'excluded',
  visibilityMs: 600000, siblingProgress: 'before_original_lease_expiry', databaseRestart: 'verified',
  interruptedTasks: 5, pendingTasks: 595, reclaimedTasks: 5, totalStarts: 605, observationMs: 600001,
  beforeCrash: metrics(), afterRecovery: metrics() });
export const evidence = () => ({ budget: 'bounded', dockerLimits: 'verified', pressure: pressure(), restartReadyMs: 12000,
  backfillRecoveryMs: 30000, postRestart: metrics(), backfill: 'completed_original_inventory', unfinishedBackfill: backlog() });
