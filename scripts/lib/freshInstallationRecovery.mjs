/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertScheduledCrashRecovery, SCHEDULED_CRASH_RECOVERY } from './scheduledInstallationContract.mjs';
import { installationFailureStage } from './runtimeInstallationReceipt.mjs';

const FRESH_CHECKS = ['fresh_install_and_operational_seeds', 'fresh_startup_scheduler_progress', 'fresh_backfill_crash_recovery'];

export function validateFreshInstallationRecovery(result, candidateImageId) {
  assert.equal(result.status, 'passed');
  assert.equal(result.scope, 'fresh-only');
  assert.equal(result.candidateImageId, candidateImageId);
  assert.equal(result.fresh?.status, 'passed');
  assert.equal(result.cleanup, 'passed');
  assert.deepEqual(result.checks, FRESH_CHECKS);
  assertScheduledCrashRecovery(result.crashRecovery);
  return SCHEDULED_CRASH_RECOVERY;
}

export function freshInstallationFailureStage(error) {
  const failureStage = installationFailureStage(error);
  return failureStage === 'preflight' ? 'installation' : failureStage;
}
