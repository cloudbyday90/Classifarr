/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { readInstallationSource } from './run-runtime-installation-acceptance.mjs';
import { assertSourceRevision, parsePublishedImageReference } from './lib/publishedDigestConsumerSmoke.mjs';
import { assertReleaseTag } from './lib/releaseCandidateEvidence.mjs';
import { routingWorkflowIdentity, validatePublishedRoutingReceipt } from './lib/publishedRoutingReceipt.mjs';
import { PUBLISHED_SCHEDULED_RECOVERY_SCHEMA, validatePublishedScheduledRecovery } from './lib/publishedScheduledRecoveryReceipt.mjs';
import { runPublishedUpgradeCompose } from './lib/publishedUpgradeCompose.mjs';
import { freshInstallationFailureStage, validateFreshInstallationRecovery } from './lib/freshInstallationRecovery.mjs';

const DIRECTORY = new URL('../.tmp/published-routing/', import.meta.url);
const ROUTING_PATH = new URL('arm64.json', DIRECTORY);
const RECEIPT_PATH = new URL('arm64-scheduled-recovery.json', DIRECTORY);

function readRouting() {
  const file = statSync(ROUTING_PATH);
  assert.ok(file.isFile() && file.size <= 16 * 1024);
  return JSON.parse(readFileSync(ROUTING_PATH, 'utf8'));
}

export async function runReleaseArm64Recovery({ env = process.env, platform = process.platform, arch = process.arch,
  source = readInstallationSource, routing = readRouting, drill = runPublishedUpgradeCompose,
  now = () => new Date().toISOString() } = {}) {
  let stage = 'preflight';
  try {
    assert.equal(`${platform}/${arch}`, 'linux/arm64');
    const tag = assertReleaseTag(env.GITHUB_REF_NAME);
    assert.equal(env.GITHUB_REF, `refs/tags/${tag}`);
    assert.equal(env.GITHUB_EVENT_NAME, 'push');
    const sourceRevision = assertSourceRevision(env.GITHUB_SHA);
    const workflow = routingWorkflowIdentity(env);
    const image = parsePublishedImageReference(`ghcr.io/cloudbyday90/classifarr@${env.IMAGE_DIGEST}`).image;
    const checkSource = () => {
      const checkout = source();
      assert.equal(checkout.sourceRevision, sourceRevision);
      assert.equal(checkout.worktreeClean, true);
    };
    checkSource();
    stage = 'routing';
    const verified = validatePublishedRoutingReceipt(routing(), { image, sourceRevision, workflow, platform: 'linux/arm64', now: now() });
    const candidateImageId = verified.subject.imageId;
    stage = 'installation';
    const result = await drill({ candidateImageId, freshOnly: true, deploymentProfile: 'unraid' });
    stage = 'evidence';
    const crashRecovery = validateFreshInstallationRecovery(result, candidateImageId);
    checkSource();
    const completedAt = now();
    return validatePublishedScheduledRecovery({
      schemaVersion: PUBLISHED_SCHEDULED_RECOVERY_SCHEMA, status: 'passed', tag, completedAt, workflow,
      subject: verified.subject, deploymentProfile: 'unraid', crashRecovery, cleanup: 'passed',
    }, { tag, routing: verified, now: completedAt });
  } catch (error) {
    return { schemaVersion: PUBLISHED_SCHEDULED_RECOVERY_SCHEMA, status: 'blocked',
      failureStage: stage === 'installation' ? freshInstallationFailureStage(error) : stage };
  }
}

if (import.meta.main) {
  try {
    const receipt = await runReleaseArm64Recovery();
    mkdirSync(DIRECTORY, { recursive: true, mode: 0o700 });
    writeFileSync(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`Release arm64 scheduled recovery ${receipt.status}.\n`);
    if (receipt.status !== 'passed') process.exitCode = 1;
  } catch {
    process.stderr.write('Release arm64 scheduled recovery could not save evidence.\n');
    process.exitCode = 1;
  }
}
