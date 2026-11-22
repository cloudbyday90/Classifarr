/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runPublishedArm64Recovery } from '../run-published-arm64-recovery.mjs';
import { SCHEDULED_CRASH_RECOVERY } from '../lib/scheduledInstallationContract.mjs';

const harnessRevision = 'a'.repeat(40);
const sourceRevision = 'b'.repeat(40);
const digest = `sha256:${'c'.repeat(64)}`;
const manifestDigest = `sha256:${'d'.repeat(64)}`;
const configDigest = `sha256:${'e'.repeat(64)}`;
const image = `ghcr.io/cloudbyday90/classifarr@${digest}`;
const tag = 'v0.49.4-beta';
const release = { tag, digest, sourceRevision, releaseId: 123 };
const subject = { image, platform: 'linux/arm64', sourceRevision, manifestDigest, configDigest, imageId: configDigest };
const result = { status: 'passed', scope: 'fresh-only', candidateImageId: configDigest, cleanup: 'passed', fresh: { status: 'passed' },
  checks: ['fresh_install_and_operational_seeds', 'fresh_startup_scheduler_progress', 'fresh_backfill_crash_recovery'],
  crashRecovery: SCHEDULED_CRASH_RECOVERY };

function fixture() {
  const calls = [];
  return { calls, options: {
    env: { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'cloudbyday90/Classifarr', GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/main', GITHUB_SHA: harnessRevision, GITHUB_RUN_ID: '1234', GITHUB_RUN_ATTEMPT: '2', RELEASE_TAG: tag },
    platform: 'linux', arch: 'arm64', command() { throw new Error('unexpected command in fixture'); },
    source: () => { calls.push('checkout'); return { sourceRevision: harnessRevision, worktreeClean: true }; },
    verifyRelease: input => { calls.push(['release', input.tag]); return release; },
    resolveSubject: input => { calls.push(['subject', input]); return subject; },
    drill: async input => { calls.push(['drill', input]); return result; },
  } };
}

test('rehearses the attested published child with an independent harness revision', async () => {
  const { options, calls } = fixture();
  assert.deepEqual(await runPublishedArm64Recovery(options), {
    schemaVersion: 1, harnessRevision, workflow: { runId: '1234', runAttempt: '2' }, platform: 'linux/arm64', deploymentProfile: 'unraid',
    release: { id: 123, tag, indexDigest: digest, sourceRevision }, subject: { image, manifestDigest, configDigest, imageId: configDigest },
    status: 'passed', failureStage: null, crashRecovery: SCHEDULED_CRASH_RECOVERY, cleanup: 'passed',
  });
  assert.deepEqual(calls, ['checkout', ['release', tag], ['subject', { image, sourceRevision, platform: 'linux/arm64' }],
    ['drill', { candidateImageId: configDigest, freshOnly: true, deploymentProfile: 'unraid' }], 'checkout']);
});

test('refuses non-native hosts, other refs/events and wrong or dirty sources before release inspection', async () => {
  for (const { env, ...change } of [{ arch: 'x64' }, { platform: 'win32' }, { env: { GITHUB_REF: 'refs/tags/v0.49.4-beta' } },
    { env: { GITHUB_EVENT_NAME: 'push' } }, { env: { GITHUB_REPOSITORY: 'other/Classifarr' } }, { env: { GITHUB_SHA: sourceRevision } },
    { source: () => ({ sourceRevision: harnessRevision, worktreeClean: false }) }]) {
    const { options, calls } = fixture();
    const receipt = await runPublishedArm64Recovery({ ...options, ...change, env: { ...options.env, ...env } });
    assert.equal(receipt.failureStage, 'preflight');
    assert.ok(calls.every(call => call === 'checkout'));
  }
});

test('refuses aliases, failed release verification and different release tags before pulling', async () => {
  for (const mutation of [options => { options.env.RELEASE_TAG = 'latest'; },
    options => { options.verifyRelease = () => { throw new Error('private registry diagnostics'); }; },
    options => { options.verifyRelease = () => ({ ...release, tag: 'v0.49.5-beta' }); }]) {
    const { options, calls } = fixture();
    mutation(options);
    const receipt = await runPublishedArm64Recovery(options);
    assert.equal(receipt.failureStage, 'release');
    assert.equal(receipt.release, null);
    assert.equal(receipt.subject, null);
    assert.ok(calls.every(call => call === 'checkout'));
    assert.doesNotMatch(JSON.stringify(receipt), /private registry diagnostics/);
  }
});

test('refuses a wrong source, platform, or image ID before the crash drill', async () => {
  for (const change of [{ image: `${image}different` }, { sourceRevision: harnessRevision }, { imageId: digest },
    { platform: 'linux/amd64' }]) {
    const { options, calls } = fixture();
    options.resolveSubject = () => ({ ...subject, ...change });
    const receipt = await runPublishedArm64Recovery(options);
    assert.equal(receipt.failureStage, 'image');
    assert.equal(receipt.subject, null);
    assert.ok(!calls.some(call => call[0] === 'drill'));
  }
});

test('blocks on real drill failure classifications, incomplete cleanup or source change', async () => {
  for (const [failureStage, override] of [
    ['fresh_backfill_crash', { drill: async () => { throw new Error('published_upgrade_failed:fresh_backfill_crash'); } }],
    ['cleanup', { drill: async () => { throw new Error(`published_upgrade_cleanup_failed:classifarr-upgrade-drill-${'a'.repeat(32)}`); } }],
    ['evidence', { drill: async () => ({ ...result, cleanup: 'not_verified' }) }],
    ['evidence', { drill: async () => ({ ...result, candidateImageId: digest }) }],
  ]) {
    const { options } = fixture();
    const receipt = await runPublishedArm64Recovery({ ...options, ...override });
    assert.equal(receipt.failureStage, failureStage);
    assert.equal(receipt.status, 'blocked');
    assert.equal(receipt.subject?.imageId, configDigest);
    assert.equal(receipt.cleanup, 'not_verified');
  }
  const { options } = fixture();
  const cleanliness = [true, false];
  options.source = () => ({ sourceRevision: harnessRevision, worktreeClean: cleanliness.shift() });
  const changedSource = await runPublishedArm64Recovery(options);
  assert.equal(changedSource.failureStage, 'evidence');
  assert.equal(changedSource.status, 'blocked');
});
