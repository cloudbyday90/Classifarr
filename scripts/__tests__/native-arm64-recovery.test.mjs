/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runNativeArm64Recovery } from '../run-native-arm64-recovery.mjs';
import { SCHEDULED_CRASH_RECOVERY } from '../lib/scheduledInstallationContract.mjs';

const revision = 'a'.repeat(40);
const imageId = `sha256:${'b'.repeat(64)}`;
const source = { sourceRevision: revision, worktreeClean: true };
const result = { status: 'passed', scope: 'fresh-only', candidateImageId: imageId, cleanup: 'passed', fresh: { status: 'passed' },
  checks: ['fresh_install_and_operational_seeds', 'fresh_startup_scheduler_progress', 'fresh_backfill_crash_recovery'],
  crashRecovery: SCHEDULED_CRASH_RECOVERY };

function fixture() {
  const calls = [];
  return { calls, options: {
    env: { GITHUB_SHA: revision, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2' }, platform: 'linux', arch: 'arm64',
    source: () => { calls.push('source'); return source; },
    docker: args => {
      calls.push(args);
      return { ok: true, stdout: args[0] === 'info' ? 'linux/aarch64\n' : 'linux/arm64\n' };
    },
    candidate: async (operation, options) => {
      calls.push(options);
      const evidence = await operation(imageId);
      calls.push('tag cleanup');
      return evidence;
    },
    drill: async options => { calls.push(options); return result; },
  } };
}

describe('native arm64 scheduled crash qualification', () => {
  it('qualifies the exact candidate after the unchanged fresh-only drill and cleanup', async () => {
    const { options, calls } = fixture();
    assert.deepEqual(await runNativeArm64Recovery(options), {
      schemaVersion: 1, sourceRevision: revision, workflow: { runId: '123', runAttempt: '2' }, platform: 'linux/arm64',
      deploymentProfile: 'unraid', status: 'passed', failureStage: null, candidateImageId: imageId,
      crashRecovery: SCHEDULED_CRASH_RECOVERY, cleanup: 'passed',
    });
    assert.deepEqual(calls, ['source', ['info', '--format', '{{.OSType}}/{{.Architecture}}'], { sourceRevision: revision },
      ['image', 'inspect', '--format', '{{.Os}}/{{.Architecture}}', imageId],
      { candidateImageId: imageId, freshOnly: true, deploymentProfile: 'unraid' }, 'tag cleanup', 'source']);
  });

  for (const [name, overrides] of [
    ['x64 Node', { arch: 'x64' }],
    ['non-Linux Node', { platform: 'darwin' }],
    ['untrusted workflow identity', { env: { GITHUB_SHA: revision, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '0' } }],
    ['wrong checkout', { source: () => ({ ...source, sourceRevision: 'b'.repeat(40) }) }],
    ['dirty checkout', { source: () => ({ ...source, worktreeClean: false }) }],
    ['x64 Docker daemon', { docker: () => ({ ok: true, stdout: 'linux/x86_64' }) }],
    ['failed Docker inspection', { docker: () => ({ ok: false, stdout: 'linux/arm64' }) }],
  ]) {
    it(`rejects ${name} before a build`, async () => {
      const { options, calls } = fixture();
      const receipt = await runNativeArm64Recovery({ ...options, ...overrides });
      assert.equal(receipt.status, 'blocked');
      assert.equal(receipt.failureStage, 'preflight');
      assert.ok(!calls.some(value => value?.sourceRevision === revision));
    });
  }

  it('checks the built architecture before passing the image to Compose', async () => {
    const { options, calls } = fixture();
    options.docker = args => ({ ok: true, stdout: args[0] === 'info' ? 'linux/arm64' : 'linux/amd64' });
    const receipt = await runNativeArm64Recovery(options);
    assert.equal(receipt.failureStage, 'image');
    assert.equal(receipt.candidateImageId, null);
    assert.ok(!calls.some(value => value?.candidateImageId === imageId));
  });

  for (const [name, overrides] of [
    ['mismatched image', { candidateImageId: `sha256:${'c'.repeat(64)}` }],
    ['wrong rehearsal scope', { scope: 'fresh-and-upgrade' }],
    ['missing fresh install proof', { fresh: null }],
    ['missing cleanup', { cleanup: 'not_verified' }],
    ['skipped checkpoint', { checks: result.checks.slice(0, 2) }],
    ['unexpected recovery fields', { crashRecovery: { ...SCHEDULED_CRASH_RECOVERY, raw: 'private' } }],
    ['routing side effect', { crashRecovery: { ...SCHEDULED_CRASH_RECOVERY, routingTasks: 1 } }],
  ]) {
    it(`records a blocked result for ${name}`, async () => {
      const { options } = fixture();
      const receipt = await runNativeArm64Recovery({ ...options, drill: async () => ({ ...result, ...overrides }) });
      assert.equal(receipt.status, 'blocked');
      assert.equal(receipt.failureStage, 'evidence');
      assert.equal(receipt.crashRecovery, null);
    });
  }

  it('keeps a restart refusal attributable without leaking unrecognized errors', async () => {
    const { options } = fixture();
    for (const [message, stage] of [['published_upgrade_failed:fresh_backfill_crash', 'fresh_backfill_crash'],
      ['arbitrary diagnostic body', 'installation']]) {
      const receipt = await runNativeArm64Recovery({ ...options, drill: async () => { throw new Error(message); } });
      assert.equal(receipt.status, 'blocked');
      assert.equal(receipt.candidateImageId, imageId);
      assert.equal(receipt.failureStage, stage);
      assert.doesNotMatch(JSON.stringify(receipt), /arbitrary diagnostic body/);
    }
  });

  it('refuses to report success if candidate cleanup fails or the checkout changes', async () => {
    const { options } = fixture();
    const candidate = async operation => {
      await operation(imageId);
      throw new Error('frozen_candidate_cleanup_failed');
    };
    const failedCleanup = await runNativeArm64Recovery({ ...options, candidate });
    assert.equal(failedCleanup.failureStage, 'cleanup');
    assert.equal(failedCleanup.cleanup, 'not_verified');

    const states = [source, { ...source, worktreeClean: false }];
    const changedSource = await runNativeArm64Recovery({ ...options, source: () => states.shift() });
    assert.equal(changedSource.failureStage, 'evidence');
    assert.equal(changedSource.status, 'blocked');
  });
});
