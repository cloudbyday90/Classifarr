/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertStudyCgroup } from './resourceStudyMetrics.mjs';
import { assertStudyBudget, summarizeBudgetEnforcement } from './resourceStudyBudget.mjs';
import { backlogRecoveryEvidence } from './installationBacklogContract.mjs';

const metricKeys = ['version', 'memoryBytes', 'limitBytes', 'oom', 'oomKill', 'underOom', 'memoryLimitHits',
  'cpuUsec', 'throttledUsec', 'pids', 'cpuQuotaUsec', 'cpuPeriodUsec', 'cpuPeriods', 'cpuThrottledPeriods',
  'pidsLimit', 'pidsLimitHits'];

export function installationBudgetSnapshot(metrics) {
  assertStudyCgroup(metrics);
  assertStudyBudget(metrics, 'bounded');
  assert.equal(metrics.memoryLimitHits, 0);
  assert.equal(metrics.oomKill, 0);
  assert.ok(metrics.oom === null || metrics.oom === 0);
  assert.ok(metrics.pids > 0 && metrics.pids <= 128);
  return Object.fromEntries(metricKeys.map(key => [key, metrics[key]]));
}

function duration(value, minimum, maximum) {
  assert.ok(Number.isFinite(value) && value >= minimum && value <= maximum);
  return value;
}

/** Reconstruct aggregate fields only; errors, SQL, tokens and media never enter receipts. */
export function installationPressureEvidence(value) {
  assert.equal(value?.maxConnections, 32);
  assert.equal(value.denialCode, '53300');
  assert.ok(Number.isSafeInteger(value.connectionsHeld) && value.connectionsHeld > 0 && value.connectionsHeld < 32);
  assert.equal(value.connectionsRemaining, 0);
  assert.equal(value.freshConnection, 'passed');
  assert.equal(value.health, 'healthy');
  for (const snapshot of [value.pressured, value.recovered]) {
    assert.equal(snapshot?.version, value.initial?.version);
    assert.equal(snapshot?.cpuPeriodUsec, value.initial?.cpuPeriodUsec);
  }
  summarizeBudgetEnforcement(value.initial, value.pressured);
  summarizeBudgetEnforcement(value.pressured, value.recovered);
  return { maxConnections: 32, denialCode: '53300', connectionsHeld: value.connectionsHeld, connectionsRemaining: 0,
    heldMs: duration(value.heldMs, 5000, 15000), recoveryMs: duration(value.recoveryMs, 0, 15000),
    freshConnection: 'passed', health: 'healthy', initial: installationBudgetSnapshot(value.initial),
    pressured: installationBudgetSnapshot(value.pressured), recovered: installationBudgetSnapshot(value.recovered) };
}

export function installationBudgetEvidence(value) {
  assert.equal(value?.budget, 'bounded');
  assert.equal(value.dockerLimits, 'verified');
  assert.equal(value.backfill, 'completed_original_inventory');
  return { budget: 'bounded', dockerLimits: 'verified', pressure: installationPressureEvidence(value.pressure),
    restartReadyMs: duration(value.restartReadyMs, 0, 240000),
    backfillRecoveryMs: duration(value.backfillRecoveryMs, 0, 900000),
    postRestart: installationBudgetSnapshot(value.postRestart), backfill: 'completed_original_inventory',
    unfinishedBackfill: { ...backlogRecoveryEvidence(value.unfinishedBackfill),
      beforeCrash: installationBudgetSnapshot(value.unfinishedBackfill.beforeCrash),
      afterRecovery: installationBudgetSnapshot(value.unfinishedBackfill.afterRecovery) } };
}
