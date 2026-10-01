/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertQueueMaintenanceHandoffBoundary } from '../services/queueMaintenanceHandoffBoundary.mjs';
import { runQueueVacuumMaintenance } from '../services/queueVacuumMaintenance.mjs';
import { QueueVacuumAttemptError } from '../services/queueVacuumFailure.mjs';
import { createLogger, setLoggerDb } from '../utils/logger.mjs';

export async function runQueueRecoveryHandoff({ args = process.argv.slice(2),
  loadDatabase = () => import('../config/database.mjs'), assertBoundary = assertQueueMaintenanceHandoffBoundary,
  run = runQueueVacuumMaintenance, log = createLogger('QueueVacuumRecovery'), registerDb = setLoggerDb,
  unavailableMessage = 'Trusted queue maintenance unavailable; review the protected runtime boundary and database health',
  startedMessage = 'Trusted queue recovery started after independent admission',
} = {}) {
  if (args.length !== 1 || args[0] !== '--assess') return 2;
  let database, code = 1;
  try {
    database = await loadDatabase();
    registerDb(database);
    await assertBoundary(database);
    const result = await run({ database, automatic: true,
      report: value => log.info(startedMessage, value) });
    if (result.diagnosis) await log.warn(result.diagnosis.message, result.diagnosis);
    code = result.status === 'complete' ? 0 : 75;
  } catch (error) {
    if (error instanceof QueueVacuumAttemptError) await log.warn(error.diagnosis.message, error.diagnosis);
    else await log.warn(unavailableMessage, { reason: 'handoff_unavailable' });
  } finally {
    if (database) { try { await database.pool.end(); } catch { code = 1; } }
    registerDb(null);
  }
  return code;
}

if (import.meta.main) {
  // eslint-disable-next-line n/no-process-exit -- bounds startup, connection acquisition, logging and pool cleanup as well as SQL
  const timer = setTimeout(() => process.exit(1), 85_000); timer.unref();
  try { process.exitCode = await runQueueRecoveryHandoff(); }
  finally { clearTimeout(timer); }
}
