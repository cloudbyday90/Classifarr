/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { READ_ADJUDICATION_BUDGET_SQL } from './adjudicationBudgetSql.mjs';
import { readInventoryBackgroundReadiness } from './inventoryBackgroundReadiness.mjs';

/** Local admission only. Closing HTTP does not promise rollback on a shared model server. */
export function createEvaluationWorkloadGuard(database, { intervalMs = 2000,
  readReadiness = () => readInventoryBackgroundReadiness(database) } = {}) {
  return async (callback, { revision, signal }) => {
    const controller = new AbortController(), combined = AbortSignal.any([signal,controller.signal]);
    let timer, pending, stopped = false;
    const check = async () => {
      combined.throwIfAborted();
      try {
        const state = await database.withTransaction(async client => {
          await client.query("SET TRANSACTION READ ONLY; SET LOCAL statement_timeout='3s'");
          return (await client.query(READ_ADJUDICATION_BUDGET_SQL)).rows[0];
        });
        if (!state?.daily_calls || state.revision !== revision || state.window_open !== true ||
            await readReadiness() !== 'ready') throw new Error('evaluation_workload_deferred');
      } catch { // Admission uncertainty fails closed without exposing database or provider details.
        controller.abort(new Error('evaluation_workload_deferred'));
      }
      combined.throwIfAborted();
    };
    const poll = () => {
      timer = setTimeout(() => {
        pending = check().catch(() => { /* check already cancelled this capture. */ }).finally(() => {
          if (!stopped && !combined.aborted) poll();
        });
      }, intervalMs);
      timer.unref?.();
    };
    try { await check(); poll(); return await callback(combined,check); }
    finally { stopped = true; clearTimeout(timer); await pending; }
  };
}
