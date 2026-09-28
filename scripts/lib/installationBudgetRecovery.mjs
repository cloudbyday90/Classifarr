/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { runScheduledCrashRecovery } from './scheduledCrashRecovery.mjs';
import { assertDockerStudyBudget } from '../../server/src/scripts/resourceStudyBudget.mjs';
import { installationBudgetEvidence, installationPressureEvidence } from '../../server/src/scripts/installationBudgetContract.mjs';

/** Reuse the normal entrypoint and real scheduler; no second recovery orchestrator. */
export async function runInstallationBudgetRecovery({ compose, docker, probe, start, poll, setStage,
  now = () => performance.now() }) {
  const verifyDocker = () => {
    const id = compose(['ps', '--all', '--quiet', 'app']).stdout.trim();
    assert.match(id, /^[a-f0-9]{12,64}$/);
    const format = '{"nanoCpus":{{json .HostConfig.NanoCpus}},"pids":{{json .HostConfig.PidsLimit}},' +
      '"memoryBytes":{{json .HostConfig.Memory}},"cpuQuota":{{json .HostConfig.CpuQuota}}}';
    assertDockerStudyBudget(JSON.parse(docker(['inspect', '--format', format, id]).stdout), 'bounded');
  };
  verifyDocker();
  assert.deepEqual(probe('budget-prepare'), { maxConnections: 32, restartRequired: true });
  compose(['stop', '--timeout', '30', 'app']);
  start('normal');
  verifyDocker();
  let pressure, restartReadyMs, recoveredAt;
  const recovery = await runScheduledCrashRecovery({ compose, docker, probe, poll, setStage,
    armPhase: 'scheduled-crash-budget-arm', beforeKill: () => { pressure = installationPressureEvidence(probe('budget-pressure')); },
    start: mode => {
      const startedAt = now();
      start(mode);
      restartReadyMs = now() - startedAt;
      recoveredAt = now();
      verifyDocker();
    } });
  const backfillRecoveryMs = now() - recoveredAt;
  const postRestart = probe('budget-snapshot');
  const unfinishedBackfill = await runScheduledCrashRecovery({ compose, docker, probe, poll, setStage,
    armPhase: 'scheduled-backlog-arm', start: mode => { start(mode); verifyDocker(); } });
  const evidence = installationBudgetEvidence({ budget: 'bounded', dockerLimits: 'verified', pressure,
    restartReadyMs, backfillRecoveryMs, postRestart, unfinishedBackfill, backfill: 'completed_original_inventory' });
  return { recovery, evidence };
}
