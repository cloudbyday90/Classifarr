/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { installationBudgetEvidence } from '../../server/src/scripts/installationBudgetContract.mjs';

/** Render only validated aggregate evidence; never interpolate probe logs or payloads. */
export function formatInstallationBudgetSummary(budget) {
  if (!budget) return '';
  if (budget.status === 'not_verified') {
    return '### Installation resource budget\n\nNot verified. No resource-enforcement or recovery claim is available.\n\n';
  }
  assert.equal(budget.status, 'passed');
  const scenarios = [budget.fresh, budget.upgrade].map(installationBudgetEvidence);
  const seconds = value => `${(value / 1000).toFixed(3)} s`;
  const rows = [
    ['Cgroup during pressure / after restart', value => `v${value.pressure.initial.version} / v${value.postRestart.version}`],
    ['Verified CPU / PID / memory limits', value => `${value.postRestart.cpuQuotaUsec / value.postRestart.cpuPeriodUsec} CPUs / ${value.postRestart.pidsLimit} / ${value.postRestart.limitBytes / 1024 ** 3} GiB`],
    ['Database connection limit / rejection', value => `${value.pressure.maxConnections} / SQLSTATE ${value.pressure.denialCode}`],
    ['Injector connections held / remaining', value => `${value.pressure.connectionsHeld} / ${value.pressure.connectionsRemaining}`],
    ['Connection pressure held', value => seconds(value.pressure.heldMs)],
    ['New connection and HTTP recovery', value => seconds(value.pressure.recoveryMs)],
    ['Restart readiness', value => seconds(value.restartReadyMs)],
    ['Backfill completion after readiness', value => seconds(value.backfillRecoveryMs)],
    ['Memory observation during pressure', value => `${(value.pressure.pressured.memoryBytes / 1024 ** 2).toFixed(2)} MiB`],
    ['PID/thread observation during pressure', value => String(value.pressure.pressured.pids)],
    ['Restart backlog: movie / TV items', value => `${value.unfinishedBackfill.movieItems} / ${value.unfinishedBackfill.tvItems}`],
    ['Pending / interrupted at crash', value => `${value.unfinishedBackfill.pendingTasks} / ${value.unfinishedBackfill.interruptedTasks}`],
    ['Original visibility lease', value => seconds(value.unfinishedBackfill.visibilityMs)],
    ['Reclaimed / completed original tasks', value => `${value.unfinishedBackfill.reclaimedTasks} / ${value.unfinishedBackfill.completedTasks}`],
    ['Restart backlog observation', value => seconds(value.unfinishedBackfill.observationMs)],
    ['Backlog memory before crash / after recovery', value => `${(value.unfinishedBackfill.beforeCrash.memoryBytes / 1024 ** 2).toFixed(2)} / ${(value.unfinishedBackfill.afterRecovery.memoryBytes / 1024 ** 2).toFixed(2)} MiB`],
    ['Early reclaims / duplicate completions', value => `${value.unfinishedBackfill.earlyReclaims} / ${value.unfinishedBackfill.duplicateCompletions}`],
  ];
  return '### Installation resource budget\n\n' +
    'Passed. Limits and recovery verified separately for fresh and upgraded data.\n\n' +
    '| Measurement | Fresh installation | Published-data upgrade |\n| --- | --- | --- |\n' +
    rows.map(([label, read]) => `| ${label} | ${scenarios.map(read).join(' | ')} |`).join('\n') + '\n\n' +
    'All six snapshots per scenario report zero memory-limit events, OOM kills and PID denials. ' +
    'Original inventory backfill completed in both scenarios. TV work progressed before interrupted movie leases expired. ' +
    'Each interrupted task was claimed once more after expiry; this is necessary redelivery, not exactly-once execution.\n\n' +
    'Memory and PID values are point observations, not peaks or safe minimums. ' +
    'Counters are not subtracted across container restarts. These results do not authorize live limits.\n\n';
}
