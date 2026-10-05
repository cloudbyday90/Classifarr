/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SchemaRestoreVerificationRequiredError, RESTORE_VERIFICATION_REQUIRED_EXIT,
  RESTORE_VERIFICATION_REQUIRED_MESSAGE } from '../utils/schemaMaintenanceFailure.mjs';

export async function runSchemaMaintenanceCommand({
  args = process.argv.slice(2),
  loadDatabase = () => import('../config/database.mjs'),
  loadMaintenance = () => import('../services/databaseSchemaMaintenance.mjs'),
  output = message => process.stdout.write(`${message}\n`),
} = {}) {
  if (args.length !== 1 || args[0] !== '--apply') {
    output('Usage: node src/scripts/runDatabaseSchemaMaintenance.mjs --apply (stop all runtimes first; use a maintenance credential)');
    return args.length === 0 || (args.length === 1 && args[0] === '--help') ? 0 : 2;
  }
  let database;
  let exitCode = 1;
  try {
    database = await loadDatabase();
    const { runDatabaseSchemaMaintenance } = await loadMaintenance();
    try {
      const result = await runDatabaseSchemaMaintenance({ database });
      output(JSON.stringify(result));
      exitCode = result.status === 'complete' ? 0 : 75;
    } catch (error) {
      if (!(error instanceof SchemaRestoreVerificationRequiredError)) throw error;
      output(RESTORE_VERIFICATION_REQUIRED_MESSAGE);
      exitCode = RESTORE_VERIFICATION_REQUIRED_EXIT;
    }
  } catch {
    output('Schema maintenance failed. Keep normal workers stopped; inspect maintenance logs and restore verification before retrying.');
  } finally {
    if (database) {
      try { await database.pool.end(); }
      catch {
        output('Schema maintenance connection cleanup failed. Keep normal workers stopped and inspect the database session.');
        exitCode = 1;
      }
    }
  }
  return exitCode;
}

if (import.meta.main) process.exitCode = await runSchemaMaintenanceCommand();
