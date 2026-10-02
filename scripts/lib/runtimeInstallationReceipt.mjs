/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { upgradeBaseline } from './publishedUpgradeCompose.mjs';
import { INSTALLATION_CHECKS, installationResultEvidence } from './runtimeInstallationEvidence.mjs';
import { provenanceFailureDiagnostic } from './publishedUpgradeProvenance.mjs';
import { formatInstallationBudgetSummary } from './installationBudgetSummary.mjs';
export { SCHEDULED_INSTALLATION_EXPECTED } from './scheduledInstallationContract.mjs';

export { INSTALLATION_CHECKS } from './runtimeInstallationEvidence.mjs';
export const INSTALLATION_RECEIPT_PATH = '.tmp/ci/runtime-installation-acceptance.json';
export const INSTALLATION_SUMMARY_PATH = '.tmp/ci/runtime-installation-acceptance.md';
const STAGES = new Set(['preflight', 'build', 'fresh_install', 'fresh_scheduler', 'fresh_backfill_crash', 'published_start', 'candidate_upgrade',
  'restore_interrupt', 'normal_rejection', 'explicit_retry', 'recovery_handoff', 'verified_restart', 'upgrade_scheduler', 'cleanup', 'evidence']);

/** Reconstruct allowlisted fields: never serialize raw probe/error objects. */
export function createRuntimeInstallationReceipt({ sourceRevision = null, worktreeClean = false,
  result = null, resourceBudget = false, provenanceFailure = null, failureStage = 'preflight', completedAt = new Date().toISOString() } = {}) {
  assert.ok(sourceRevision === null || /^[a-f0-9]{40,64}$/.test(sourceRevision));
  assert.equal(typeof worktreeClean, 'boolean');
  assert.equal(typeof resourceBudget, 'boolean');
  assert.equal(new Date(completedAt).toISOString(), completedAt);
  const diagnostic = provenanceFailureDiagnostic(provenanceFailure);
  if (diagnostic) { assert.equal(result, null); assert.equal(failureStage, 'preflight'); }
  const receipt = { schemaVersion: 'classifarr.runtime-installation-acceptance.v3', completedAt,
    sourceRevision, worktreeClean, status: 'blocked', failureStage: STAGES.has(failureStage) ? failureStage : 'evidence',
    baseline: { ...upgradeBaseline }, candidateImageId: null, database: null,
    checks: INSTALLATION_CHECKS.map(id => ({ id, status: 'not_verified' })), cleanup: 'not_verified',
    ...(resourceBudget ? { resourceBudget: { status: 'not_verified' } } : {}),
    ...(diagnostic ? { provenanceFailure: diagnostic } : {}) };
  if (!result) return receipt;
  const { database: databases, budget } = installationResultEvidence(result, { resourceBudget });
  assert.ok(sourceRevision);
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
  const diagnostic = provenanceFailureDiagnostic(receipt.provenanceFailure);
  return `## Runtime installation acceptance\n\n` +
    `${passed ? 'Passed' : 'Blocked'}. ${receipt.worktreeClean ? 'Clean checkout.' : 'Local/dirty checkout; not CI acceptance.'}\n\n` +
    '| Check | Result |\n| --- | --- |\n' +
    receipt.checks.map(check => `| ${check.id.replaceAll('_', ' ')} | ${check.status === 'passed' ? 'Passed' : 'Not verified'} |`).join('\n') +
    `\n| Owned resource cleanup | ${receipt.cleanup === 'passed' ? 'Passed' : 'Not verified'} |\n` +
    (receipt.resourceBudget ? `| 2 CPU / 128 PID database and restart recovery (fresh + upgrade) | ${receipt.resourceBudget.status === 'passed' ? 'Passed' : 'Not verified'} |\n` : '') + '\n' +
    formatInstallationBudgetSummary(receipt.resourceBudget) +
    (passed ? 'Scope: one published baseline, fresh install and real-scheduler movie/TV progress; not live-provider quality or published-image provenance.\n'
      : `${diagnostic ? `Provenance: ${diagnostic.reason.replaceAll('_', ' ')} (${diagnostic.credentialSource}).\n\nNext: ${diagnostic.nextStep}`
        : `Next: investigate the ${receipt.failureStage} stage and rerun.`} Publication remains blocked.\n`);
}
