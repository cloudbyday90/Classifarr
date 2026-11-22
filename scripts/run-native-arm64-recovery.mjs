/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readInstallationSource } from './run-runtime-installation-acceptance.mjs';
import { runDockerCheckCommand } from './lib/dockerCheckCommand.mjs';
import { withFrozenUpgradeCandidate } from './lib/frozenUpgradeCandidate.mjs';
import { runPublishedUpgradeCompose } from './lib/publishedUpgradeCompose.mjs';
import { freshInstallationFailureStage, validateFreshInstallationRecovery } from './lib/freshInstallationRecovery.mjs';

const PLATFORM = 'linux/arm64';
const RECEIPT_PATH = new URL('../.tmp/ci/native-arm64-recovery.json', import.meta.url);

export async function runNativeArm64Recovery({ env = process.env, platform = process.platform, arch = process.arch,
  source = readInstallationSource, docker = runDockerCheckCommand, candidate = withFrozenUpgradeCandidate,
  drill = runPublishedUpgradeCompose } = {}) {
  const { GITHUB_SHA: revision, GITHUB_RUN_ID: runId, GITHUB_RUN_ATTEMPT: runAttempt } = env;
  const receipt = { schemaVersion: 1, sourceRevision: null, workflow: null, platform: PLATFORM, deploymentProfile: 'unraid',
    status: 'blocked', failureStage: 'preflight', candidateImageId: null, crashRecovery: null, cleanup: 'not_verified' };
  let stage = 'preflight';
  try {
    assert.equal(`${platform}/${arch}`, PLATFORM);
    assert.match(revision, /^[a-f0-9]{40}$/);
    assert.match(runId, /^[1-9][0-9]{0,19}$/);
    assert.match(runAttempt, /^[1-9][0-9]{0,9}$/);
    const checkSource = () => {
      const { sourceRevision, worktreeClean } = source();
      assert.equal(sourceRevision, revision);
      assert.equal(worktreeClean, true);
    };
    checkSource();
    receipt.sourceRevision = revision;
    receipt.workflow = { runId, runAttempt };
    const daemon = docker(['info', '--format', '{{.OSType}}/{{.Architecture}}']);
    assert.equal(daemon.ok, true);
    assert.match(daemon.stdout.trim(), /^linux\/(?:aarch64|arm64)$/);

    stage = 'build';
    const crashRecovery = await candidate(async candidateImageId => {
      stage = 'image';
      assert.match(candidateImageId, /^sha256:[a-f0-9]{64}$/);
      const image = docker(['image', 'inspect', '--format', '{{.Os}}/{{.Architecture}}', candidateImageId]);
      assert.equal(image.ok, true);
      assert.equal(image.stdout.trim(), PLATFORM);
      receipt.candidateImageId = candidateImageId;

      stage = 'installation';
      const result = await drill({ candidateImageId, freshOnly: true, deploymentProfile: 'unraid' });
      stage = 'evidence';
      return validateFreshInstallationRecovery(result, candidateImageId);
    }, { sourceRevision: revision });
    checkSource();
    return { ...receipt, status: 'passed', failureStage: null, crashRecovery, cleanup: 'passed' };
  } catch (error) {
    if (error?.message === 'frozen_candidate_cleanup_failed') stage = 'cleanup';
    if (stage === 'installation') stage = freshInstallationFailureStage(error);
    return { ...receipt, failureStage: stage };
  }
}

if (import.meta.main) {
  try {
    const receipt = await runNativeArm64Recovery();
    mkdirSync(new URL('.', RECEIPT_PATH), { recursive: true, mode: 0o700 });
    writeFileSync(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`Native arm64 recovery ${receipt.status}. Receipt ${fileURLToPath(RECEIPT_PATH)}\n`);
    if (receipt.status !== 'passed') process.exitCode = 1;
  } catch {
    process.stderr.write('Native arm64 recovery could not save evidence.\n');
    process.exitCode = 1;
  }
}
