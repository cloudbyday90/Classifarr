/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { SCHEDULED_CRASH_BOUNDARY, assertScheduledCrashRecovery } from './scheduledInstallationContract.mjs';

/** Commands are supplied by the collision-checked, fixed isolated Compose owner. */
export async function runScheduledCrashRecovery({ compose, docker, probe, poll, start, setStage }) {
  compose(['exec', '--detach', 'app', 'node', 'src/scripts/publishedUpgradeProbe.mjs', 'scheduled-crash-arm']);
  await poll(() => compose(['exec', '-T', 'app', 'test', '-f', '/app/data/upgrade-drill/scheduled-backfill-ready'],
    10_000, true).status === 0, 'scheduled_crash_boundary', 420_000);
  assert.deepEqual(probe('scheduled-crash-ready'), SCHEDULED_CRASH_BOUNDARY);
  const id = compose(['ps', '--all', '--quiet', 'app']).stdout.trim();
  if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('invalid_drill_container');
  setStage('fresh_backfill_crash');
  compose(['kill', '--signal', 'SIGKILL', 'app']);
  await poll(() => docker(['inspect', '--format', '{{.State.Status}}', id]).stdout.trim() === 'exited', 'scheduled_crash_exit');
  assert.equal(docker(['inspect', '--format', '{{.State.ExitCode}} {{.State.OOMKilled}}', id]).stdout.trim(), '137 false');
  start('normal');
  return assertScheduledCrashRecovery(probe('scheduled-crash-resume'));
}
