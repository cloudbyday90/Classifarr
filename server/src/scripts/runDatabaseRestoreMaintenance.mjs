/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readRestoreMaintenanceInput } from '../services/backupRestoreMaintenanceInput.mjs';

export async function runRestoreMaintenanceCommand({
  args = process.argv.slice(2), input = process.stdin,
  readInput = readRestoreMaintenanceInput,
  loadDatabase = () => import('../config/database.mjs'),
  loadMaintenance = () => import('../services/backupRestoreMaintenance.mjs'),
  output = message => process.stdout.write(`${message}\n`),
} = {}) {
  if (args.length !== 1 || args[0] !== '--apply') {
    output('Usage: node src/scripts/runDatabaseRestoreMaintenance.mjs --apply < protected-request.json (stop every runtime; use a maintenance identity; see restore-maintenance-design.md)');
    return args.length === 0 || (args.length === 1 && args[0] === '--help') ? 0 : 2;
  }
  let database;
  let code = 2;
  let result = { status: 'rejected', reason: 'invalid_restore_request' };
  try {
    // Decrypt and validate before even loading the database module.
    const request = await readInput(input);
    code = 1;
    result = { status: 'failed', reason: 'restore_maintenance_failed' };
    database = await loadDatabase();
    const { runBackupRestoreMaintenance } = await loadMaintenance();
    await runBackupRestoreMaintenance({ database, ...request });
    result = { status: 'complete', reason: 'restore_verified', mode: request.mode };
    code = 0;
  } catch (error) {
    if (database && error?.code === 'RESTORE_RUNTIME_BUSY') {
      result = { status: 'deferred', reason: 'normal_runtime_or_maintenance_active' };
      code = 75;
    }
  } finally {
    if (database) {
      try { await database.pool.end(); }
      catch { code = 1; result = { status: 'failed', reason: 'restore_connection_cleanup_failed' }; }
    }
  }
  output(JSON.stringify(result));
  return code;
}

if (import.meta.main) {
  // Set before any database/service import: never mix row contents or credentials into stdout/log files.
  process.env.LOG_LEVEL = 'silent';
  process.env.FILE_LOGGING_ENABLED = 'false';
  const deadline = setTimeout(() => {
    process.stdout.write('{"status":"failed","reason":"restore_maintenance_deadline"}\n');
    // eslint-disable-next-line n/no-process-exit -- hard one-shot deadline must close stuck DB sessions, not leave a worker alive
    process.exit(1); // Connection loss leaves the existing durable quarantine in place; never auto-replay.
  }, 180_000);
  try { process.exitCode = await runRestoreMaintenanceCommand(); }
  finally { clearTimeout(deadline); }
}
