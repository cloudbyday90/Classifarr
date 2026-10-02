/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { SCHEDULED_CRASH_BOUNDARY, assertScheduledCrashRecovery } from './scheduledInstallationContract.mjs';
import { assertBacklogBoundary, backlogRecoveryEvidence } from '../../server/src/scripts/installationBacklogContract.mjs';
import { installationBudgetSnapshot } from '../../server/src/scripts/installationBudgetContract.mjs';
import { validateInstallationFailure } from '../../server/src/scripts/installationFailureEvidence.mjs';
import { createCrashBoundaryWindow } from './crashBoundaryWindow.mjs';

/** Commands are supplied by the collision-checked, fixed isolated Compose owner. */
export async function runScheduledCrashRecovery({ compose, docker, probe, poll, start, setStage,
  armPhase = 'scheduled-crash-arm', beforeKill = () => {}, clock,
  report = message => process.stdout.write(`${message}\n`) }) {
  assert.ok(['scheduled-crash-arm', 'scheduled-crash-budget-arm', 'scheduled-backlog-arm'].includes(armPhase));
  const backlog = armPhase === 'scheduled-backlog-arm';
  const prefix = backlog ? 'scheduled-backlog' : 'scheduled-crash';
  const marker = backlog ? 'unfinished-backfill-ready' : 'scheduled-backfill-ready';
  const failurePrefix = backlog ? 'UPGRADE_BACKLOG_FAILURE' : 'UPGRADE_CRASH_FAILURE';
  compose(['exec', '--detach', 'app', 'node', 'src/scripts/publishedUpgradeProbe.mjs', armPhase]);
  await poll(() => {
    if (compose(['exec', '-T', 'app', 'test', '-f', `/app/data/upgrade-drill/${backlog ? 'unfinished' : 'scheduled'}-backfill-failed`],
      10_000, true).status === 0) {
      try { report(`${failurePrefix} ${JSON.stringify(validateInstallationFailure(probe(`${prefix}-failure`)))}`); }
      catch { report(`${failurePrefix} unavailable`); }
      throw new Error(backlog ? 'upgrade_backlog_arm_failed' : 'upgrade_crash_arm_failed');
    }
    return compose(['exec', '-T', 'app', 'test', '-f', `/app/data/upgrade-drill/${marker}`], 10_000, true).status === 0;
  }, 'scheduled_crash_boundary', 420_000);
  const timeline = createCrashBoundaryWindow({ backlog, now: clock });
  try {
    timeline.mark('readyObserved');
    const id = compose(['ps', '--all', '--quiet', 'app']).stdout.trim();
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('invalid_drill_container');
    timeline.mark('targetResolved');
    await beforeKill();
    timeline.mark('preparationComplete');
    timeline.mark('verificationStarted');
    const boundary = probe(`${prefix}-ready`);
    if (backlog) assertBacklogBoundary(boundary);
    else assert.deepEqual(boundary, SCHEDULED_CRASH_BOUNDARY);
    timeline.mark('boundaryVerified');
    if (backlog) timeline.setWindow(boundary.remainingWindowMs);
    setStage('fresh_backfill_crash');
    // No Compose lookup or caller-supplied work is allowed after final verification.
    const killTimeout = backlog ? timeline.remaining() : 30000;
    timeline.mark('killDispatched');
    if (backlog) docker(['kill', '--signal', 'SIGKILL', id], killTimeout);
    else compose(['kill', '--signal', 'SIGKILL', 'app'], killTimeout);
    timeline.mark('killReturned');
    const exitTimeout = backlog ? timeline.remaining() : 60000;
    await poll(() => docker(['inspect', '--format', '{{.State.Status}}', id], exitTimeout).stdout.trim() === 'exited',
      'scheduled_crash_exit', exitTimeout);
    timeline.mark('exitObserved');
    if (backlog) timeline.remaining();
    assert.equal(docker(['inspect', '--format', '{{.State.ExitCode}} {{.State.OOMKilled}}', id]).stdout.trim(), '137 false');
    timeline.mark('exitVerified');
  } finally { report(`UPGRADE_CRASH_TIMELINE ${JSON.stringify(timeline.receipt())}`); }
  start('normal');
  const result = probe(`${prefix}-resume`);
  return backlog ? { ...backlogRecoveryEvidence(result), beforeCrash: installationBudgetSnapshot(result.beforeCrash),
    afterRecovery: installationBudgetSnapshot(result.afterRecovery) } : assertScheduledCrashRecovery(result);
}
