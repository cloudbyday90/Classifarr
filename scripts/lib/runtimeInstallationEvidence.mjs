/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { upgradeBaseline } from './publishedUpgradeProvenance.mjs';
import { publishedUpgradeDeployment } from './publishedUpgradeDeployment.mjs';
import { assertScheduledInstallationResult, assertScheduledCrashRecovery } from './scheduledInstallationContract.mjs';
import { installationBudgetEvidence } from '../../server/src/scripts/installationBudgetContract.mjs';

export const INSTALLATION_CHECKS = Object.freeze([
  'published_provenance', 'fresh_install_and_operational_seeds', 'fresh_startup_scheduler_progress', 'fresh_backfill_crash_recovery',
  'published_startup_and_export',
  'persisted_volume_migrations', 'container_killed_during_restore', 'unverified_normal_startup_rejected',
  'rollback_and_explicit_verified_retry', 'movie_tv_recovery_to_learning', 'verified_normal_restart_and_profiles',
  'upgrade_startup_scheduler_progress',
]);

function database(value) {
  assert.match(value?.version ?? '', /^\d{6}$/);
  assert.ok(Number.isSafeInteger(value.migrations) && value.migrations > 0);
  return { version: value.version, migrations: value.migrations };
}

/** Shared validation; callers select the expected profile, never the result. */
export function installationResultEvidence(result, { resourceBudget = false, deploymentProfile = 'standard', requireDeployment = false } = {}) {
  publishedUpgradeDeployment(deploymentProfile);
  assert.equal(result.status, 'passed');
  assert.equal(result.scope, 'fresh-and-upgrade');
  if (requireDeployment || deploymentProfile !== 'standard') assert.ok(result.deployment);
  let deployment;
  if (result.deployment) {
    assert.equal(result.deployment.profile, deploymentProfile);
    assert.equal(result.deployment.unchanged, true);
    assert.match(result.deployment.configurationDigest, /^[a-f0-9]{64}$/);
    deployment = { profile: deploymentProfile, unchanged: true, configurationDigest: result.deployment.configurationDigest };
  }
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
  const budget = resourceBudget ? { status: 'passed', fresh: installationBudgetEvidence(result.resourceBudget?.fresh),
    upgrade: installationBudgetEvidence(result.resourceBudget?.upgrade) } : null;
  if (!resourceBudget) assert.equal(result.resourceBudget, undefined);
  return { database: databases, deployment, budget };
}
