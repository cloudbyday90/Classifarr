/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { requireRetryBenchmarkSchema } from './schema.mjs';

/** Allowlisted diagnostics only. Never emit SQL, parameters, filters or returned media. */
export function summarizeRetryPlan(explain) {
  if (!explain?.Plan) throw new TypeError('Missing retry benchmark plan');
  const scans = [], sorts = [];
  const visit = node => {
    const loops = node['Actual Loops'] ?? 0;
    if (node['Relation Name'] && node['Node Type']?.includes('Scan')) scans.push({ relation: node['Relation Name'], kind: node['Node Type'],
      index: node['Index Name'] ?? null, loops, rows: (node['Actual Rows'] ?? 0)*loops,
      filtered: (node['Rows Removed by Filter'] ?? 0)*loops });
    if (['Sort', 'Incremental Sort'].includes(node['Node Type'])) sorts.push({ kind: node['Node Type'], loops,
      rows: (node['Actual Rows'] ?? 0)*loops, spaceKb: node['Sort Space Used'] ?? null,
      method: node['Sort Method'] ?? null });
    for (const child of node.Plans ?? []) visit(child);
  };
  visit(explain.Plan);
  const root = explain.Plan;
  return { planningMs: explain['Planning Time'], executionMs: explain['Execution Time'],
    estimatedCost: root['Total Cost'] ?? null, jitFunctions: explain.JIT?.Functions ?? 0,
    jitMs: explain.JIT?.Timing?.Total ?? null,
    returnedRows: root['Actual Rows'],
    // Parent buffer totals already include children; summing the tree would double-count.
    sharedHits: root['Shared Hit Blocks'] ?? 0, sharedReads: root['Shared Read Blocks'] ?? 0,
    tempReads: root['Temp Read Blocks'] ?? 0, tempWrites: root['Temp Written Blocks'] ?? 0, scans, sorts };
}

export async function measureRetryQuery(db, query) {
  await requireRetryBenchmarkSchema(db);
  await db.query('SAVEPOINT retry_benchmark_measurement');
  try {
    const { rows } = await db.query(`EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) ${query.sql}`, query.params);
    return summarizeRetryPlan(rows[0]['QUERY PLAN'][0]);
  } finally {
    // EXPLAIN ANALYZE executes the claim UPDATE; every measurement must undo it.
    await db.query('ROLLBACK TO SAVEPOINT retry_benchmark_measurement');
    await db.query('RELEASE SAVEPOINT retry_benchmark_measurement');
  }
}

export async function readRetryQueryIds(db, query) {
  await requireRetryBenchmarkSchema(db);
  await db.query('SAVEPOINT retry_benchmark_result');
  try { return (await db.query(query.sql, query.params)).rows.map(row => row.queue_id); }
  finally {
    await db.query('ROLLBACK TO SAVEPOINT retry_benchmark_result');
    await db.query('RELEASE SAVEPOINT retry_benchmark_result');
  }
}

export const retryQueryFingerprint = sql => createHash('sha256').update(sql).digest('hex');
