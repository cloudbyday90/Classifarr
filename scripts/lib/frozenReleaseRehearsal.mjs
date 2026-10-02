/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readInstallationSource } from '../run-runtime-installation-acceptance.mjs';
import { runPublishedUpgradeCompose } from './publishedUpgradeCompose.mjs';
import { upgradeBaseline, readProvenanceFailure, verifyPublishedUpgradeProvenance } from './publishedUpgradeProvenance.mjs';
import { installationResultEvidence, INSTALLATION_CHECKS } from './runtimeInstallationEvidence.mjs';
import { installationFailureStage } from './runtimeInstallationReceipt.mjs';
import { withFrozenUpgradeCandidate } from './frozenUpgradeCandidate.mjs';

export const REHEARSAL_PROFILES = Object.freeze(['standard', 'unraid', 'custom']);

/** This is test orchestration, not a production worker or publication approval. */
export async function runFrozenReleaseRehearsal({ source = readInstallationSource, candidate = withFrozenUpgradeCandidate,
  drill = runPublishedUpgradeCompose, verify = verifyPublishedUpgradeProvenance, noCache = false,
  report = message => process.stdout.write(`${message}\n`), now = () => new Date().toISOString() } = {}) {
  const receipt = { schemaVersion: 'classifarr.frozen-release-rehearsal.v1', status: 'blocked', completedAt: null,
    sourceRevision: null, worktreeClean: false, candidateImageId: null, baseline: { ...upgradeBaseline },
    resourceBudget: 'bounded', buildCache: noCache ? 'disabled' : 'enabled', failureStage: 'preflight',
    profiles: REHEARSAL_PROFILES.map(profile => ({ profile, status: 'not_verified' })), candidateCleanup: 'not_verified' };
  const assertSource = () => {
    const identity = source();
    assert.match(identity.sourceRevision, /^[a-f0-9]{40,64}$/);
    assert.equal(identity.worktreeClean, true);
    if (receipt.sourceRevision !== null) assert.equal(identity.sourceRevision, receipt.sourceRevision);
    receipt.sourceRevision = identity.sourceRevision;
  };
  let stage = 'preflight';
  try {
    assert.equal(typeof noCache, 'boolean');
    assertSource();
    // Verify before spending time on a build. Each drill also retains its own gate.
    verify();
    stage = 'build';
    report('BUILD frozen candidate');
    await candidate(async imageId => {
      assert.match(imageId, /^sha256:[a-f0-9]{64}$/);
      receipt.candidateImageId = imageId;
      for (const [index, profile] of REHEARSAL_PROFILES.entries()) {
        stage = 'source';
        assertSource();
        stage = profile;
        report(`REHEARSE ${profile}`);
        const result = await drill({ deploymentProfile: profile, candidateImageId: imageId, resourceBudget: true });
        stage = 'evidence';
        assert.equal(result.candidateImageId, imageId);
        const evidence = installationResultEvidence(result, { deploymentProfile: profile, resourceBudget: true, requireDeployment: true });
        if (index > 0) assert.deepEqual(evidence.database, receipt.profiles[0].database);
        stage = 'source';
        assertSource();
        receipt.profiles[index] = { profile, status: 'passed', candidateImageId: imageId,
          deployment: evidence.deployment, database: evidence.database, resourceBudget: evidence.budget,
          checks: INSTALLATION_CHECKS.map(id => ({ id, status: 'passed' })), cleanup: 'passed' };
      }
    }, { noCache, sourceRevision: receipt.sourceRevision });
    receipt.candidateCleanup = 'passed';
    stage = 'source';
    assertSource();
    receipt.worktreeClean = true;
    receipt.status = 'passed';
    receipt.failureStage = null;
  } catch (error) {
    receipt.failureStage = error?.message === 'frozen_candidate_cleanup_failed' ? 'cleanup' : stage;
    if (REHEARSAL_PROFILES.includes(stage)) receipt.scenarioFailureStage = installationFailureStage(error);
    const diagnostic = readProvenanceFailure(error);
    if (diagnostic) receipt.provenanceFailure = diagnostic;
  }
  receipt.completedAt = now();
  return receipt;
}

export function formatFrozenRehearsalSummary(receipt) {
  return '# Frozen release rehearsal\n\n' +
    `${receipt.status === 'passed' ? 'Passed' : 'Blocked'}; no release or deployment authorized.\n\n` +
    `Source: ${receipt.sourceRevision ?? 'not verified'}.\n\nImage ID: ${receipt.candidateImageId ?? 'not verified'}.\n\n` +
    '| Saved deployment | Fresh + upgrade + recovery | Resource budget |\n| --- | --- | --- |\n' +
    receipt.profiles.map(row => `| ${row.profile} | ${row.status} | ${row.resourceBudget?.status ?? 'not_verified'} |`).join('\n') +
    `\n\nCandidate tag cleanup: ${receipt.candidateCleanup}.\n\n` +
    (receipt.failureStage ? `Next: investigate ${receipt.failureStage} and rerun the entire matrix.\n\n` : '') +
    'Scope: synthetic providers and saved templates on one local platform; not a real Unraid host, long soak, published manifest digest or AI accuracy evaluation.\n';
}
