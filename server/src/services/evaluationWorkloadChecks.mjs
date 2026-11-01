/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { READINESS_SCOPES } from '../utils/databaseReadinessAdmission.mjs';
import { INVENTORY_READINESS_PROBE_MS } from './boundedInventoryReadinessReader.mjs';
import { readEvaluationWorkloadCheck } from './evaluationWorkloadCheckReader.mjs';

/** At most one monitor and one fresh reservation read; no queued or reused successes. */
export function createEvaluationWorkloadChecks(database, { revision, signal, read = readEvaluationWorkloadCheck }) {
  const controller = new AbortController(), combined = AbortSignal.any([signal, controller.signal]);
  const active = new Map();
  let closed = false;
  const refuse = () => controller.abort(new Error('evaluation_workload_deferred'));
  async function check(scope) {
    combined.throwIfAborted();
    if (closed || active.has(scope)) { refuse(); combined.throwIfAborted(); }
    const deadline = performance.now() + INVENTORY_READINESS_PROBE_MS;
    const timer = setTimeout(refuse, INVENTORY_READINESS_PROBE_MS);
    timer.unref?.();
    const pending = (async () => {
      try {
        if (await read(database, { revision, signal: combined, scope, deadline }) !== true || performance.now() >= deadline) refuse();
      } catch { // Admission uncertainty cannot expose SQL/provider details or authorize work.
        refuse();
      } finally { clearTimeout(timer); }
      combined.throwIfAborted();
    })().finally(() => { active.delete(scope); });
    active.set(scope, pending);
    return pending;
  }
  return {
    signal: combined,
    monitor: () => check(READINESS_SCOPES.WORKLOAD_MONITOR),
    reservation: () => check(READINESS_SCOPES.WORKLOAD_RESERVATION),
    async close() {
      closed = true; refuse();
      await Promise.allSettled([...active.values()]);
    },
  };
}
