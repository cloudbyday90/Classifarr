/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export async function runImageIndexMaintenanceCommand({ args = process.argv.slice(2),
  loadDatabase = () => import('../config/database.mjs'),
  loadMaintenance = () => import('../services/imageIndexMaintenance.mjs'),
  output = message => process.stdout.write(`${message}\n`),
} = {}) {
  if (args.length !== 1 || args[0] !== '--apply') {
    output('Usage: node src/scripts/runImageIndexMaintenance.mjs --apply (stop runtimes; use a maintenance credential; processes one existing index job)');
    return args.length === 0 || (args.length === 1 && args[0] === '--help') ? 0 : 2;
  }
  let database, exitCode = 1;
  try {
    database = await loadDatabase();
    const { runImageIndexMaintenance } = await loadMaintenance();
    const result = await runImageIndexMaintenance({ database });
    output(JSON.stringify(result));
    exitCode = ['complete', 'no_work'].includes(result.status) ? 0 : 75;
  } catch {
    output('Image index maintenance failed. Inspect the queued task and database health before retrying.');
  } finally {
    if (database) {
      try { await database.pool.end(); }
      catch { output('Image index maintenance connection cleanup failed.'); exitCode = 1; }
    }
  }
  return exitCode;
}

if (import.meta.main) {
  process.env.LOG_LEVEL = 'silent';
  process.env.FILE_LOGGING_ENABLED = 'false';
  // eslint-disable-next-line n/no-process-exit -- isolated one-shot hard stop if SQL/cleanup never settles
  const timer = setTimeout(() => process.exit(1), 180_000);
  timer.unref();
  try { process.exitCode = await runImageIndexMaintenanceCommand(); }
  finally { clearTimeout(timer); }
}
