/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as database from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { runQueueVacuumMaintenance } from './queueVacuumMaintenance.mjs';
import { QueueVacuumAttemptError } from './queueVacuumFailure.mjs';

const logger = createLogger('QueueVacuumRecovery');
const needsReview = new Set(['attempt_limit', 'maintenance_privilege_required', 'statistics_required', 'autovacuum_disabled']);

export function registerQueueVacuumRecoverySchedule(scheduler, {
  run = runQueueVacuumMaintenance, db = database, log = logger,
} = {}) {
  let lastUnavailable = false;
  const report = result => log.info('Queue maintenance recovery started after sustained pressure', result);
  const handler = async () => {
    try {
      const result = await run({ database: db, automatic: true, report });
      lastUnavailable = false;
      if (result.diagnosis) log.warn(result.diagnosis.message, result.diagnosis);
      if (result.status === 'complete') log.info('Queue vacuum and analyze completed; later observations will check pressure', result);
      else if (result.log && needsReview.has(result.reason)) {
        log.warn('Queue maintenance recovery needs review; no automatic configuration changes were made', result);
      } else if (result.log) log.info('Queue maintenance recovery state changed', result);
      else log.debug('Queue maintenance recovery check', result);
      return result;
    } catch (error) {
      if (error instanceof QueueVacuumAttemptError) {
        log.warn(error.diagnosis.message, error.diagnosis);
        lastUnavailable = false;
        return { status: 'unavailable', failureCategory: error.category };
      }
      if (!lastUnavailable) log.warn('Queue maintenance recovery unavailable or unverified; inspect database health before intervention',
        { reason: 'recovery_unavailable', retryPolicy: 'started attempts retain cooldown; no immediate retry' });
      lastUnavailable = true;
      return { status: 'unavailable' };
    }
  };
  scheduler.schedule('queue-vacuum-recovery', '7,22,37,52 * * * *', handler, null, { noOverlap: true });
  scheduler.scheduleInitial('queue-vacuum-recovery', 600_000, handler);
}
