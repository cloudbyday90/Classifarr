/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertFixtureEnvironment, receipt } from './common.mjs';

// Mounted only by the disposable harness. Never replace application startup,
// handlers, database admission, task implementation or signal-drain behavior.
if (process.argv[1] === '/app/src/index.mjs') {
  await assertFixtureEnvironment();
  process.once('SIGTERM', () => { void receipt('signal', { signal: 'SIGTERM' }); });
  process.once('SIGUSR2', () => {
    void (async () => {
      const database = await import('/app/src/config/database.mjs');
      const { rows } = await database.query('SELECT value FROM shutdown_sentinel ORDER BY value');
      if (JSON.stringify(rows) !== JSON.stringify([{ value: 'preserved' }])) throw new Error('fixture_sentinel_required');
      const { schedulerService } = await import('/app/src/services/scheduler.mjs');
      const task = schedulerService.tasks.get('queue-vacuum-recovery');
      if (!task) throw new Error('fixture_scheduled_task_required');
      await task.execute();
    })().catch(() => receipt('failure', { phase: 'scheduled_assessment' }));
  });
}
