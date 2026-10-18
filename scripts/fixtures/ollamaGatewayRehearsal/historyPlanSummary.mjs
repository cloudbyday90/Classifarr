/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const nodeTypes = new Set(['Result','Limit','Sort','Incremental Sort','Hash Join','Merge Join','Nested Loop','Hash',
  'Aggregate','Group','CTE Scan','Seq Scan','Index Scan','Index Only Scan','Bitmap Heap Scan','Bitmap Index Scan',
  'BitmapAnd','BitmapOr','Materialize','Memoize','Append','Merge Append','Gather','Gather Merge','Subquery Scan','Unique']);
const metrics = Object.freeze(['Actual Rows','Actual Loops','Plan Rows','Plan Width','Shared Hit Blocks','Shared Read Blocks',
  'Shared Dirtied Blocks','Shared Written Blocks','Temp Read Blocks','Temp Written Blocks','Sort Space Used','Peak Memory Usage','Hash Batches']);
const invalid = () => new Error('history_plan_invalid');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = value => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) throw invalid();
  return value;
};

/** Discard expressions, SQL, identifiers and arbitrary strings before emitting diagnostic evidence. */
export function summarizeHistoryPlan(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 65536) throw invalid();
  let parsed; try { parsed = JSON.parse(raw); } catch { throw invalid(); }
  if (!Array.isArray(parsed) || parsed.length !== 1 || !object(parsed[0]) || !object(parsed[0].Plan)) throw invalid();
  const nodes = [];
  function visit(node, parent, depth) {
    if (!object(node) || depth > 16 || nodes.length >= 64 || !nodeTypes.has(node['Node Type'])) throw invalid();
    const index = nodes.length, result = { type: node['Node Type'], parent };
    for (const key of metrics) if (Object.hasOwn(node, key)) result[key] = number(node[key]);
    for (const key of ['Actual Rows','Actual Loops','Plan Rows','Plan Width']) if (!Object.hasOwn(result, key)) throw invalid();
    if (Object.hasOwn(node, 'Sort Space Type')) {
      if (!['Memory','Disk'].includes(node['Sort Space Type'])) throw invalid();
      result['Sort Space Type'] = node['Sort Space Type'];
    }
    if (Object.hasOwn(node, 'Sort Method')) {
      if (!['quicksort','top-N heapsort','external merge','external sort'].includes(node['Sort Method'])) throw invalid();
      result['Sort Method'] = node['Sort Method'];
    }
    nodes.push(result);
    if (node.Plans !== undefined) {
      if (!Array.isArray(node.Plans) || node.Plans.length > 64) throw invalid();
      for (const child of node.Plans) visit(child, index, depth + 1);
    }
  }
  visit(parsed[0].Plan, null, 0);
  return { executionMs: number(parsed[0]['Execution Time']), planningMs: number(parsed[0]['Planning Time']), nodes };
}
