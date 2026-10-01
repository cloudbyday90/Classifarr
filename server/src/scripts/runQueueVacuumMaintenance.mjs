/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export async function runQueueVacuumMaintenanceCommand({ args = process.argv.slice(2),
  loadDatabase = () => import('../config/database.mjs'),
  loadMaintenance = () => import('../services/queueVacuumMaintenance.mjs'),
  loadObservation = () => import('../services/queueVacuumObservation.mjs'),
  output = message => process.stdout.write(`${message}\n`),
} = {}) {
  if (args.length !== 1 || !['--inspect', '--apply'].includes(args[0])) {
    output('Usage: node src/scripts/runQueueVacuumMaintenance.mjs --inspect | --apply (apply requires stopped runtimes and a maintenance credential)');
    return args.length === 0 || (args.length === 1 && args[0] === '--help') ? 0 : 2;
  }
  let database, exitCode = 1;
  try {
    database = await loadDatabase();
    const result = args[0] === '--inspect'
      ? await (await loadObservation()).inspectQueueVacuum({ database })
      : await (await loadMaintenance()).runQueueVacuumMaintenance({ database });
    output(JSON.stringify(result));
    exitCode = ['complete', 'autovacuum_enabled'].includes(result.status) ? 0 : 75;
  } catch {
    output('Queue vacuum could not be confirmed. Inspect database health and maintenance access before retrying.');
  } finally {
    if (database) {
      try { await database.pool.end(); }
      catch { output('Queue vacuum connection cleanup failed.'); exitCode = 1; }
    }
  }
  return exitCode;
}

if (import.meta.main) {
  process.env.LOG_LEVEL = 'silent';
  process.env.FILE_LOGGING_ENABLED = 'false';
  // eslint-disable-next-line n/no-process-exit -- one-shot hard stop also bounds connection acquisition/cleanup
  const timer = setTimeout(() => process.exit(1), 90_000);
  timer.unref();
  try { process.exitCode = await runQueueVacuumMaintenanceCommand(); }
  finally { clearTimeout(timer); }
}
