/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as delay } from 'node:timers/promises';

const WAIT_TYPES = new Set(['Activity', 'BufferPin', 'Client', 'Extension', 'IO', 'IPC', 'Lock', 'LWLock', 'Timeout']);
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Deliberately omit expressions, relation/index names, output columns and all raw plan text. */
export function summarizeCorpusPlan(explain) {
  if (!explain?.Plan) throw new Error('corpus_profile_plan_invalid');
  const root = explain.Plan;
  let nodes = 0, diskSorts = 0, sortSpaceKb = 0;
  const visit = node => {
    if (++nodes > 500) throw new Error('corpus_profile_plan_too_large');
    if (node['Sort Space Type'] === 'Disk') diskSorts++;
    sortSpaceKb += number(node['Sort Space Used']) ?? 0;
    for (const child of node.Plans ?? []) visit(child);
  };
  visit(root);
  return { planningMs: number(explain['Planning Time']), executionMs: number(explain['Execution Time']),
    estimatedRows: number(root['Plan Rows']), actualRows: number(root['Actual Rows']), nodes, diskSorts, sortSpaceKb,
    // Inclusive root totals, never sum buffer counts across the plan tree.
    sharedHits: number(root['Shared Hit Blocks']), sharedReads: number(root['Shared Read Blocks']),
    tempReads: number(root['Temp Read Blocks']), tempWrites: number(root['Temp Written Blocks']),
    serializationMs: number(explain.Serialization?.Time), serializationKb: number(explain.Serialization?.['Output Volume']) };
}

export function memorySnapshot() {
  const { rss, heapUsed, heapTotal, external, arrayBuffers } = process.memoryUsage();
  return { rss, heapUsed, heapTotal, external, arrayBuffers };
}

/** Separate autocommit observer; never query text or reuse a frozen stats snapshot. */
export async function observeCorpusWork(observer, pids, work) {
  if (!Array.isArray(pids) || !pids.length || pids.length > 2 || pids.some(pid => !Number.isInteger(pid) || pid < 1)) {
    throw new Error('corpus_profile_pids_invalid');
  }
  let done = false, samples = 0;
  const categories = {};
  const sampling = (async () => {
    while (!done && samples < 1200) {
      const { rows } = await observer.query(`SELECT state,wait_event_type FROM pg_stat_activity
        WHERE pid=ANY($1::integer[])`, [pids]);
      samples++;
      for (const row of rows) {
        const category = row.state !== 'active' ? 'not_active'
          : row.wait_event_type === null ? 'active_no_wait'
            : WAIT_TYPES.has(row.wait_event_type) ? row.wait_event_type : 'other';
        categories[category] = (categories[category] ?? 0) + 1;
      }
      if (!done) await delay(25);
    }
  })();
  // Attach a rejection handler immediately; the worker and sampler must both settle.
  const observed = sampling.then(() => null, error => error);
  let result, error;
  try { result = await work(); }
  finally { done = true; error = await observed; }
  if (error) throw new Error('corpus_profile_observer_failed');
  if (samples >= 1200) throw new Error('corpus_profile_observer_limit');
  return { result, waits: { samples, intervalMs: 25, categories } };
}
