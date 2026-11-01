/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { READ_ADJUDICATION_BUDGET_SQL } from './adjudicationBudgetSql.mjs';
import { INVENTORY_BACKGROUND_READINESS_SQL } from './inventoryBackgroundReadiness.mjs';
import { INVENTORY_READINESS_PROBE_MS } from './boundedInventoryReadinessReader.mjs';

/** Preserve separate transaction snapshots; neither SELECT may reset the check budget. */
export async function readEvaluationWorkloadCheck(database, { revision, signal, scope, deadline }) {
  const read = async sql => {
    signal.throwIfAborted();
    const remaining = Math.ceil(deadline - performance.now());
    if (remaining <= 0) throw new Error('evaluation_workload_deferred');
    const row = await database.withTransaction(async client => (await client.query(sql)).rows[0],
      { signal, readOnly: true, timeoutMs: Math.min(remaining, INVENTORY_READINESS_PROBE_MS), readinessScope: scope });
    signal.throwIfAborted();
    if (performance.now() >= deadline) throw new Error('evaluation_workload_deferred');
    return row;
  };
  const state = await read(READ_ADJUDICATION_BUDGET_SQL);
  if (!state?.daily_calls || state.revision !== revision || state.window_open !== true) return false;
  return (await read(INVENTORY_BACKGROUND_READINESS_SQL))?.readiness === 'ready';
}
