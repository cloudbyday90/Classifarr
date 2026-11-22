/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runReleaseArm64Recovery } from '../../../../scripts/run-release-arm64-recovery.mjs';
import { DIGEST, ENV, NOW, SOURCE, receipt, scheduledRecoveryReceipt } from '../helpers/publishedRoutingFixture.mjs';

const TAG = 'v0.50.0-beta';
const context = { ...ENV, GITHUB_EVENT_NAME: 'push', GITHUB_REF_NAME: TAG, GITHUB_REF: `refs/tags/${TAG}`, IMAGE_DIGEST: DIGEST };

function fixture() {
  const routing = receipt('linux/arm64');
  const { imageId } = routing.subject;
  const drill = jest.fn(async () => ({
    status: 'passed', scope: 'fresh-only', candidateImageId: imageId, fresh: { status: 'passed' }, cleanup: 'passed',
    checks: ['fresh_install_and_operational_seeds', 'fresh_startup_scheduler_progress', 'fresh_backfill_crash_recovery'],
    crashRecovery: scheduledRecoveryReceipt(TAG).crashRecovery,
  }));
  const source = jest.fn(() => ({ worktreeClean: true, sourceRevision: SOURCE }));
  return { imageId, options: { env: context, arch: 'arm64', platform: 'linux', source, routing: () => routing, drill, now: () => NOW } };
}

test('borrows the arm64 routing image by exact ID after verifying the tagged source', async () => {
  const { imageId, options } = fixture();
  expect(await runReleaseArm64Recovery(options)).toEqual(scheduledRecoveryReceipt(TAG));
  expect(options.drill).toHaveBeenCalledTimes(1);
  expect(options.drill).toHaveBeenCalledWith({ candidateImageId: imageId, freshOnly: true, deploymentProfile: 'unraid' });
  expect(options.source).toHaveBeenCalledTimes(2);
});

test.each([{ arch: 'x64' }, { platform: 'win32' }, { env: { ...context, GITHUB_EVENT_NAME: 'workflow_dispatch' } },
  { env: { ...context, GITHUB_REF: 'refs/heads/main' } }, { env: { ...context, IMAGE_DIGEST: 'latest' } },
  { source: () => ({ worktreeClean: false, sourceRevision: SOURCE }) }])('stops at preflight for invalid CI context', async overrides => {
  const { options } = fixture();
  const routing = jest.fn();
  expect(await runReleaseArm64Recovery({ ...options, routing, ...overrides })).toMatchObject({ status: 'blocked', failureStage: 'preflight' });
  expect(routing).not.toHaveBeenCalled();
  expect(options.drill).not.toHaveBeenCalled();
});

test.each([
  () => receipt('linux/amd64'),
  () => ({ ...receipt('linux/arm64'), status: 'blocked' }),
  () => ({ ...receipt('linux/arm64'), workflow: { runId: '123', runAttempt: '1' } }),
  () => { throw new Error('raw output'); },
])('rejects unrelated, stale or unavailable routing before launching Compose', async routing => {
  const { options } = fixture();
  expect(await runReleaseArm64Recovery({ ...options, routing })).toMatchObject({ status: 'blocked', failureStage: 'routing' });
  expect(options.drill).not.toHaveBeenCalled();
});

test('preserves bounded failure evidence and requires the checkout through completion', async () => {
  const { options } = fixture();
  options.drill.mockRejectedValueOnce(new Error('published_upgrade_failed:fresh_backfill_crash'));
  expect(await runReleaseArm64Recovery(options)).toMatchObject({ status: 'blocked', failureStage: 'fresh_backfill_crash' });
  options.source.mockReturnValueOnce({ worktreeClean: true, sourceRevision: SOURCE })
    .mockReturnValueOnce({ worktreeClean: false, sourceRevision: SOURCE });
  expect(await runReleaseArm64Recovery(options)).toMatchObject({ status: 'blocked', failureStage: 'evidence' });
});
