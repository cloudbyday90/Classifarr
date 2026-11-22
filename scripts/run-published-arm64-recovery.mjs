/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readInstallationSource } from './run-runtime-installation-acceptance.mjs';
import { assertSourceRevision } from './lib/publishedDigestConsumerSmoke.mjs';
import { assertReleaseTag } from './lib/releaseCandidateEvidence.mjs';
import { loadPromotionAuthority } from './lib/releasePromotionAuthority.mjs';
import { createPromotionCommand } from './lib/releasePromotionCommand.mjs';
import { routingWorkflowIdentity } from './lib/publishedRoutingReceipt.mjs';
import { resolvePublishedRoutingSubject } from './lib/publishedRoutingSubject.mjs';
import { runPublishedUpgradeCompose } from './lib/publishedUpgradeCompose.mjs';
import { freshInstallationFailureStage, validateFreshInstallationRecovery } from './lib/freshInstallationRecovery.mjs';

const PLATFORM = 'linux/arm64';
const RECEIPT_PATH = new URL('../.tmp/ci/published-arm64-recovery.json', import.meta.url);
const DIGEST = /^sha256:[a-f0-9]{64}$/;

export async function runPublishedArm64Recovery({ env = process.env, platform = process.platform, arch = process.arch,
  command = createPromotionCommand(), source = readInstallationSource, verifyRelease = loadPromotionAuthority,
  resolveSubject = resolvePublishedRoutingSubject, drill = runPublishedUpgradeCompose } = {}) {
  const receipt = { schemaVersion: 1, harnessRevision: null, workflow: null, platform: PLATFORM, deploymentProfile: 'unraid',
    release: null, subject: null, status: 'blocked', failureStage: 'preflight', crashRecovery: null, cleanup: 'not_verified' };
  let stage = 'preflight';
  try {
    assert.equal(`${platform}/${arch}`, PLATFORM);
    assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
    assert.equal(env.GITHUB_REF, 'refs/heads/main');
    const workflow = routingWorkflowIdentity(env);
    const harnessRevision = assertSourceRevision(env.GITHUB_SHA);
    const checkSource = () => {
      const { sourceRevision, worktreeClean } = source();
      assert.equal(sourceRevision, harnessRevision);
      assert.equal(worktreeClean, true);
    };
    checkSource();
    receipt.harnessRevision = harnessRevision;
    receipt.workflow = workflow;

    stage = 'release';
    const tag = assertReleaseTag(env.RELEASE_TAG);
    const release = verifyRelease({ tag, command });
    assert.equal(release.tag, tag);
    const sourceRevision = assertSourceRevision(release.sourceRevision);
    assert.match(release.digest, DIGEST);
    assert.ok(Number.isSafeInteger(release.releaseId) && release.releaseId > 0);
    receipt.release = { id: release.releaseId, tag, indexDigest: release.digest, sourceRevision };

    stage = 'image';
    const image = `ghcr.io/cloudbyday90/classifarr@${release.digest}`;
    const subject = resolveSubject({ image, sourceRevision, platform: PLATFORM });
    assert.equal(subject.image, image);
    assert.equal(subject.sourceRevision, sourceRevision);
    assert.equal(subject.platform, PLATFORM);
    assert.match(subject.manifestDigest, DIGEST);
    assert.match(subject.configDigest, DIGEST);
    assert.ok([subject.manifestDigest, subject.configDigest].includes(subject.imageId));
    receipt.subject = { image, manifestDigest: subject.manifestDigest, configDigest: subject.configDigest, imageId: subject.imageId };

    stage = 'installation';
    const result = await drill({ candidateImageId: subject.imageId, freshOnly: true, deploymentProfile: 'unraid' });
    stage = 'evidence';
    const crashRecovery = validateFreshInstallationRecovery(result, subject.imageId);
    checkSource();
    return { ...receipt, status: 'passed', failureStage: null, crashRecovery, cleanup: 'passed' };
  } catch (error) {
    if (stage === 'installation') stage = freshInstallationFailureStage(error);
    return { ...receipt, failureStage: stage };
  }
}

if (import.meta.main) {
  try {
    const receipt = await runPublishedArm64Recovery();
    mkdirSync(new URL('.', RECEIPT_PATH), { recursive: true, mode: 0o700 });
    writeFileSync(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`Published arm64 recovery ${receipt.status}.\n`);
    if (receipt.status !== 'passed') process.exitCode = 1;
  } catch {
    process.stderr.write('Published arm64 recovery could not save evidence.\n');
    process.exitCode = 1;
  }
}
