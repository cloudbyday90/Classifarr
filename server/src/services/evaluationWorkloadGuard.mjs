/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createEvaluationWorkloadChecks } from './evaluationWorkloadChecks.mjs';

/** Local admission only. Closing HTTP does not promise rollback on a shared model server. */
export function createEvaluationWorkloadGuard(database, { intervalMs = 2000, readCheck } = {}) {
  return async (callback, { revision, signal }) => {
    const checks = createEvaluationWorkloadChecks(database, { revision, signal, read: readCheck });
    let timer, stopped = false;
    const poll = () => {
      timer = setTimeout(() => {
        checks.monitor().catch(() => { /* check already cancelled this capture. */ }).finally(() => {
          if (!stopped && !checks.signal.aborted) poll();
        });
      }, intervalMs);
      timer.unref?.();
    };
    try { await checks.monitor(); poll(); return await callback(checks.signal, checks.reservation); }
    finally { stopped = true; clearTimeout(timer); await checks.close(); }
  };
}
