/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { upgradeBaseline } from './publishedUpgradeCompose.mjs';
import { assertScheduledInstallationResult, assertScheduledCrashRecovery } from './scheduledInstallationContract.mjs';
import { installationBudgetEvidence } from '../../server/src/scripts/installationBudgetContract.mjs';
export { SCHEDULED_INSTALLATION_EXPECTED } from './scheduledInstallationContract.mjs';

export const INSTALLATION_CHECKS = Object.freeze([
  'published_provenance', 'fresh_install_and_operational_seeds', 'fresh_startup_scheduler_progress', 'fresh_backfill_crash_recovery',
  'published_startup_and_export',
  'persisted_volume_migrations', 'container_killed_during_restore', 'unverified_normal_startup_rejected',
  'rollback_and_explicit_verified_retry', 'movie_tv_recovery_to_learning', 'verified_normal_restart_and_profiles',
  'upgrade_startup_scheduler_progress',
]);
export const INSTALLATION_RECEIPT_PATH = '.tmp/ci/runtime-installation-acceptance.json';
export const INSTALLATION_SUMMARY_PATH = '.tmp/ci/runtime-installation-acceptance.md';
const STAGES = new Set(['preflight', 'build', 'fresh_install', 'fresh_scheduler', 'fresh_backfill_crash', 'published_start', 'candidate_upgrade',
  'restore_interrupt', 'normal_rejection', 'explicit_retry', 'recovery_handoff', 'verified_restart', 'upgrade_scheduler', 'cleanup', 'evidence']);

function database(value) {
  assert.match(value?.version ?? '', /^\d{6}$/);
  assert.ok(Number.isSafeInteger(value.migrations) && value.migrations > 0);
  return { version: value.version, migrations: value.migrations };
}

/** Reconstruct allowlisted fields: never serialize raw probe/error objects. */
export function createRuntimeInstallationReceipt({ sourceRevision = null, worktreeClean = false,
  result = null, resourceBudget = false, failureStage = 'preflight', completedAt = new Date().toISOString() } = {}) {
  assert.ok(sourceRevision === null || /^[a-f0-9]{40,64}$/.test(sourceRevision));
  assert.equal(typeof worktreeClean, 'boolean');
  assert.equal(typeof resourceBudget, 'boolean');
  assert.equal(new Date(completedAt).toISOString(), completedAt);
  const receipt = { schemaVersion: 'classifarr.runtime-installation-acceptance.v3', completedAt,
    sourceRevision, worktreeClean, status: 'blocked', failureStage: STAGES.has(failureStage) ? failureStage : 'evidence',
    baseline: { ...upgradeBaseline }, candidateImageId: null, database: null,
    checks: INSTALLATION_CHECKS.map(id => ({ id, status: 'not_verified' })), cleanup: 'not_verified',
    ...(resourceBudget ? { resourceBudget: { status: 'not_verified' } } : {}) };
  if (!result) return receipt;
  assert.equal(result.status, 'passed');
  assert.equal(result.scope, 'fresh-and-upgrade');
  assertScheduledInstallationResult(result.scheduler?.fresh);
  assertScheduledInstallationResult(result.scheduler?.upgrade);
  assertScheduledCrashRecovery(result.crashRecovery);
  assert.equal(result.cleanup, 'passed');
  assert.deepEqual(result.baseline, upgradeBaseline);
  assert.deepEqual(result.checks, INSTALLATION_CHECKS);
  assert.match(result.candidateImageId, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.fresh?.status, 'passed');
  assert.deepEqual(result.recovery, { rollback: 'passed', explicitRetry: 'passed', maintenance: 'passed' });
  assert.deepEqual(result.handoff, { movie: 'current', tv: 'current', music: 'excluded', routingTasks: 0 });
  const databases = { fresh: database(result.fresh.database), baseline: database(result.database.baseline),
    candidate: database(result.database.candidate) };
  assert.deepEqual(databases.fresh, databases.candidate);
  assert.ok(databases.candidate.migrations > databases.baseline.migrations);
  assert.ok(sourceRevision);
  // Requested extra coverage cannot silently fall back to a normal installation receipt.
  const budget = resourceBudget ? { status: 'passed', fresh: installationBudgetEvidence(result.resourceBudget?.fresh),
    upgrade: installationBudgetEvidence(result.resourceBudget?.upgrade) } : null;
  if (!resourceBudget) assert.equal(result.resourceBudget, undefined);
  return { ...receipt, status: 'passed', failureStage: null, candidateImageId: result.candidateImageId,
    database: databases, checks: INSTALLATION_CHECKS.map(id => ({ id, status: 'passed' })), cleanup: 'passed',
    ...(resourceBudget ? { resourceBudget: budget } : {}) };
}

export function installationFailureStage(error) {
  // Known runner classifications only; arbitrary errors, SQL, logs and payloads are not evidence.
  const message = String(error?.message ?? '');
  if (/^published_upgrade_cleanup_failed:classifarr-upgrade-drill-[a-f0-9]{32}(?::[a-z_]+)?$/.test(message)) return 'cleanup';
  const stage = /^published_upgrade_failed:([a-z_]+)$/.exec(message)?.[1];
  return STAGES.has(stage) ? stage : 'preflight';
}

export function formatRuntimeInstallationSummary(receipt) {
  const passed = receipt.status === 'passed';
  return `## Runtime installation acceptance\n\n` +
    `${passed ? 'Passed' : 'Blocked'}. ${receipt.worktreeClean ? 'Clean checkout.' : 'Local/dirty checkout; not CI acceptance.'}\n\n` +
    '| Check | Result |\n| --- | --- |\n' +
    receipt.checks.map(check => `| ${check.id.replaceAll('_', ' ')} | ${check.status === 'passed' ? 'Passed' : 'Not verified'} |`).join('\n') +
    `\n| Owned resource cleanup | ${receipt.cleanup === 'passed' ? 'Passed' : 'Not verified'} |\n` +
    (receipt.resourceBudget ? `| 2 CPU / 128 PID database and restart recovery (fresh + upgrade) | ${receipt.resourceBudget.status === 'passed' ? 'Passed' : 'Not verified'} |\n` : '') + '\n' +
    (passed ? 'Scope: one published baseline, fresh install and real-scheduler movie/TV progress; not live-provider quality or published-image provenance.\n'
      : `Next: investigate the ${receipt.failureStage} stage and rerun. Publication remains blocked.\n`);
}
