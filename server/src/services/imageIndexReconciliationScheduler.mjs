/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as database from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { reconcileImageIndexes } from './imageIndexReconciliation.mjs';

export function registerImageIndexReconciliationSchedule(scheduler, {
  db = database, run = reconcileImageIndexes, log = createLogger('ImageIndexReconciliation'),
} = {}) {
  let active = null, lastState = null;
  const handler = () => {
    active ??= (async () => {
      let result;
      try { result = await run({ database: db }); }
      catch { result = { status: 'unavailable', reason: 'observation_failed' }; }
      const state = `${result.status}:${result.reason}`;
      if (state !== lastState) {
        if (result.status === 'review' || result.status === 'unavailable') {
          log.warn('Image index recovery needs review; inspect database health and the index repair task before retrying.', result);
        } else if (result.reason === 'repair_needed') {
          log.info('Image index repair queued; the worker will recheck readiness before a bounded attempt.', result);
        } else if (lastState && result.reason === 'healthy') log.info('Image indexes are verified healthy.', result);
        else log.debug('Image index recovery check.', result);
        lastState = state;
      }
      return result;
    })().finally(() => { active = null; });
    return active;
  };
  scheduler.schedule('image-index-reconciliation', '12,27,42,57 * * * *', handler, null, { noOverlap: true });
  scheduler.scheduleInitial('image-index-reconciliation', 600_000, handler);
}
