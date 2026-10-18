/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeHistoryPlan } from '../fixtures/ollamaGatewayRehearsal/historyPlanSummary.mjs';
const node = (type = 'Result') => ({ 'Node Type': type, 'Actual Rows': 1, 'Actual Loops': 1, 'Plan Rows': 1, 'Plan Width': 8 });
const raw = plan => JSON.stringify([{ Plan: plan, 'Execution Time': 5, 'Planning Time': 1 }]);

test('plan evidence preserves inclusive per-node metrics and discards arbitrary SQL and identifiers', () => {
  const plan = { ...node('Sort'), 'Shared Hit Blocks': 8, 'Temp Written Blocks': 4,
    'Sort Method': 'external merge', 'Sort Space Type': 'Disk', 'Sort Space Used': 32,
    Output: ['secret expression'], 'Relation Name': 'private', Plans: [{ ...node('Seq Scan'), 'Shared Hit Blocks': 8 }] };
  const result = summarizeHistoryPlan(raw(plan));
  assert.equal(result.nodes.length, 2); assert.equal(result.nodes[1].parent, 0);
  assert.equal(result.nodes[0]['Sort Space Used'], 32); assert.equal(result.nodes[0]['Shared Hit Blocks'], 8);
  assert.ok(!JSON.stringify(result).includes('secret')); assert.ok(!JSON.stringify(result).includes('private'));
  assert.equal(result.nodes[1]['Temp Read Blocks'], undefined);
});

test('missing required metrics, unsupported strings and invalid numbers cannot become evidence', () => {
  const missing = node(); delete missing['Actual Loops'];
  for (const plan of [missing, { ...node(), 'Node Type': 'private payload' }, { ...node('Sort'), 'Sort Method': 'secret' },
    { ...node(), 'Plan Width': -1 }, { ...node(), 'Plan Rows': null }, { ...node(), 'Actual Rows': '1' },
    { ...node(), 'Temp Read Blocks': Number.MAX_SAFE_INTEGER + 1 }]) assert.throws(() => summarizeHistoryPlan(raw(plan)));
  for (const text of ['', 'null', '{}', '[]', '[{}]', '[1]', '['.repeat(65537)]) assert.throws(() => summarizeHistoryPlan(text));
});

test('byte, node and nesting caps refuse oversized plans rather than truncating them', () => {
  assert.throws(() => summarizeHistoryPlan(raw({ ...node(), Output: ['x'.repeat(65536)] })));
  assert.throws(() => summarizeHistoryPlan(raw({ ...node(), Plans: Array.from({ length: 64 }, () => node()) })));
  let deep = node(); for (let index = 0; index < 17; index++) deep = { ...node(), Plans: [deep] };
  assert.throws(() => summarizeHistoryPlan(raw(deep)));
});
