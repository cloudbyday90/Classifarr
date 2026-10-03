/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { upgradeBaseline } from './publishedUpgradeProvenance.mjs';
import { INSTALLATION_CHECKS } from './runtimeInstallationEvidence.mjs';
import { validateRoutingRehearsalEvidence } from './routingRehearsalEvidence.mjs';
import { installationBudgetEvidence } from '../../server/src/scripts/installationBudgetContract.mjs';

/** Same-run CI artifact, not an attestation or permission to publish/deploy. */
export function validateRuntimeInstallationGate(receipt, { sourceRevision, candidateImageId, runId, runAttempt,
  now = Date.now() } = {}) {
  assert.match(sourceRevision ?? '', /^[a-f0-9]{40,64}$/);
  assert.match(candidateImageId ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.match(runId ?? '', /^[1-9][0-9]{0,19}$/);
  assert.match(runAttempt ?? '', /^[1-9][0-9]{0,9}$/);
  assert.equal(receipt?.schemaVersion, 'classifarr.runtime-installation-acceptance.v4');
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.failureStage, null);
  assert.equal(receipt.provenanceFailure, undefined);
  assert.equal(receipt.worktreeClean, true);
  assert.equal(receipt.sourceRevision, sourceRevision);
  assert.equal(receipt.candidateImageId, candidateImageId);
  assert.deepEqual(receipt.workflow, { runId, runAttempt });
  const completed = Date.parse(receipt.completedAt);
  assert.ok(Number.isFinite(now) && Number.isFinite(completed));
  assert.equal(new Date(completed).toISOString(), receipt.completedAt);
  assert.ok(completed <= now + 300_000 && completed >= now - 6 * 60 * 60 * 1000);
  assert.equal(receipt.cleanup, 'passed');
  assert.deepEqual(receipt.baseline, upgradeBaseline);
  assert.deepEqual(receipt.checks, INSTALLATION_CHECKS.map(id => ({ id, status: 'passed' })));
  for (const name of ['fresh', 'baseline', 'candidate']) {
    const database = receipt.database?.[name];
    assert.match(database?.version ?? '', /^\d{6}$/);
    assert.ok(Number.isSafeInteger(database.migrations) && database.migrations > 0);
  }
  assert.deepEqual(receipt.database.fresh, receipt.database.candidate);
  assert.ok(receipt.database.candidate.migrations > receipt.database.baseline.migrations);
  if (receipt.resourceBudget !== undefined) {
    assert.equal(receipt.resourceBudget.status, 'passed');
    installationBudgetEvidence(receipt.resourceBudget.fresh);
    installationBudgetEvidence(receipt.resourceBudget.upgrade);
  }
  validateRoutingRehearsalEvidence(receipt.routing, { sourceRevision, candidateImageId });
  return { sourceRevision, candidateImageId, status: 'passed' };
}
