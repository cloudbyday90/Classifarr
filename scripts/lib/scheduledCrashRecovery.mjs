/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { SCHEDULED_CRASH_BOUNDARY, assertScheduledCrashRecovery } from './scheduledInstallationContract.mjs';
import { BACKLOG_BOUNDARY, backlogRecoveryEvidence } from '../../server/src/scripts/installationBacklogContract.mjs';
import { installationBudgetSnapshot } from '../../server/src/scripts/installationBudgetContract.mjs';
import { validateInstallationFailure } from '../../server/src/scripts/installationFailureEvidence.mjs';

/** Commands are supplied by the collision-checked, fixed isolated Compose owner. */
export async function runScheduledCrashRecovery({ compose, docker, probe, poll, start, setStage,
  armPhase = 'scheduled-crash-arm', beforeKill = () => {}, report = message => process.stdout.write(`${message}\n`) }) {
  assert.ok(['scheduled-crash-arm', 'scheduled-crash-budget-arm', 'scheduled-backlog-arm'].includes(armPhase));
  const backlog = armPhase === 'scheduled-backlog-arm';
  const prefix = backlog ? 'scheduled-backlog' : 'scheduled-crash';
  const marker = backlog ? 'unfinished-backfill-ready' : 'scheduled-backfill-ready';
  compose(['exec', '--detach', 'app', 'node', 'src/scripts/publishedUpgradeProbe.mjs', armPhase]);
  await poll(() => {
    if (backlog && compose(['exec', '-T', 'app', 'test', '-f', '/app/data/upgrade-drill/unfinished-backfill-failed'],
      10_000, true).status === 0) {
      try { report(`UPGRADE_BACKLOG_FAILURE ${JSON.stringify(validateInstallationFailure(probe('scheduled-backlog-failure')))}`); }
      catch { report('UPGRADE_BACKLOG_FAILURE unavailable'); }
      throw new Error('upgrade_backlog_arm_failed');
    }
    return compose(['exec', '-T', 'app', 'test', '-f', `/app/data/upgrade-drill/${marker}`], 10_000, true).status === 0;
  }, 'scheduled_crash_boundary', 420_000);
  assert.deepEqual(probe(`${prefix}-ready`), backlog ? BACKLOG_BOUNDARY : SCHEDULED_CRASH_BOUNDARY);
  await beforeKill();
  const id = compose(['ps', '--all', '--quiet', 'app']).stdout.trim();
  if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('invalid_drill_container');
  setStage('fresh_backfill_crash');
  compose(['kill', '--signal', 'SIGKILL', 'app']);
  await poll(() => docker(['inspect', '--format', '{{.State.Status}}', id]).stdout.trim() === 'exited', 'scheduled_crash_exit');
  assert.equal(docker(['inspect', '--format', '{{.State.ExitCode}} {{.State.OOMKilled}}', id]).stdout.trim(), '137 false');
  start('normal');
  const result = probe(`${prefix}-resume`);
  return backlog ? { ...backlogRecoveryEvidence(result), beforeCrash: installationBudgetSnapshot(result.beforeCrash),
    afterRecovery: installationBudgetSnapshot(result.afterRecovery) } : assertScheduledCrashRecovery(result);
}
