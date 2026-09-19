/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { buildGroupSemanticSchema, parseGroupSemanticGrades, chooseGroupSemanticCandidate } from '../../services/inventoryGroupSemanticContract.mjs';
import { createGroupSemanticComparison } from '../../services/inventoryGroupSemanticComparison.mjs';

const baseline = { reason: 'local_overlapping_examples' };
const plan = { status: 'ready', query: { description: 'PRIVATE' }, candidates: [17, 5].map(id => ({ id, examples: [{ description: 'PRIVATE' }] })) };
const options = { generateCases: 2, context: 8192 };
function clientFor(responses = ['{"grades":[3,1]}', '{"grades":[1,3]}'], extra = {}) {
  return { generate: jest.fn(async ({ onGenerationCall }) => {
    onGenerationCall();
    return { response: responses.shift(), latencyMs: 4, promptTokens: 100, outputTokens: 12, ...extra };
  }) };
}

test('exact grammar rejects duplicates, extra prose, coercion, partial and excessive output', () => {
  for (const count of [1, 9, 2.5, null]) expect(() => buildGroupSemanticSchema(count)).toThrow('count_invalid');
  expect(buildGroupSemanticSchema(8).properties.grades).toMatchObject({ minItems: 8, maxItems: 8 });
  expect(parseGroupSemanticGrades(' { "grades" : [3, 0] } ', 2)).toEqual([3, 0]);
  for (const response of [null, '', 'x'.repeat(257), '{"grades":[2]}', '{"grades":[4,0]}', '{"grades":[2.0,0]}',
    '{"grades":["2",0]}', '{"grades":[2,0],"grades":[3,0]}', '{"grades":[2,0],"id":17}', '{"grades":[2,0,1]}', '```{"grades":[2,0]}```']) {
    expect(parseGroupSemanticGrades(response, 2)).toBeNull();
  }
  expect(chooseGroupSemanticCandidate(plan.candidates, [2, 1])).toBe(17);
  for (const grades of [[1, 0], [3, 3], [0, 0]]) expect(chooseGroupSemanticCandidate(plan.candidates, grades)).toBeNull();
  for (const grades of [null, [2], [2, NaN], [1, 4]]) expect(() => chooseGroupSemanticCandidate(plan.candidates, grades)).toThrow('grades_invalid');
  for (const candidates of [[{ id: 1 }, { id: 1 }], [{ id: 1 }, { id: -1 }]]) expect(() => chooseGroupSemanticCandidate(candidates, [3, 1])).toThrow();
});

test('maps reversed orders, preserves controls and budgets planned calls without leaking content', async () => {
  const client = clientFor(), onProgress = jest.fn(), comparison = createGroupSemanticComparison({ ...options, generateCases: 1 }, { client, onProgress });
  const control = { reason: 'selected', index: 0 };
  expect(await comparison.compare(null, control)).toBe(control);
  expect(await comparison.compare(plan, baseline)).toEqual({ reason: 'selected', id: 17 });
  expect(await comparison.compare(plan, baseline)).toBe(baseline);
  expect(comparison.read()).toMatchObject({ status: 'complete', eligibleCases: 2, attemptedCases: 1, calls: 2, validPasses: 2,
    maximumCalls: 2, latencyMs: 8, promptTokens: 200, outputTokens: 24,
    statuses: { preserved_baseline: 1, semantic_supported: 1, semantic_not_run: 1 } });
  expect(client.generate.mock.calls[0][0]).toMatchObject({ responseContract: 'group_relevance', count: 2 });
  expect(JSON.stringify([comparison.read(), onProgress.mock.calls])).not.toMatch(/PRIVATE|description|"id"/);
});

test.each([
  ['semantic_weak_evidence', ['{"grades":[1,0]}', '{"grades":[0,1]}']],
  ['semantic_order_sensitive', ['{"grades":[3,1]}', '{"grades":[3,1]}']],
])('retains abstention for %s', async (status, responses) => {
  const comparison = createGroupSemanticComparison(options, { client: clientFor(responses) });
  expect(await comparison.compare(plan, baseline)).toBe(baseline);
  expect(comparison.read().statuses).toEqual({ [status]: 1 });
});

test.each([
  ['semantic_invalid_response', {}, ['PRIVATE malformed']],
  ['semantic_output_limit', { outputLimitReached: true }, ['{"grades":[3,0]}']],
  ['semantic_context_limit', { contextLimitSuspected: true }, ['{"grades":[3,0]}']],
])('stops later inference without retry for %s', async (status, extra, responses) => {
  const client = clientFor(responses, extra), comparison = createGroupSemanticComparison(options, { client });
  expect(await comparison.compare(plan, baseline)).toBe(baseline);
  expect(await comparison.compare(plan, baseline)).toBe(baseline);
  expect(client.generate).toHaveBeenCalledTimes(1);
  expect(comparison.read()).toMatchObject({ status: 'completed_with_errors', statuses: { [status]: 1, semantic_stopped: 1 } });
});

test('preflight, unavailable evidence and input bounds never generate or truncate', async () => {
  const client = clientFor(), comparison = createGroupSemanticComparison({ ...options, generateCases: 0 }, { client });
  expect(await comparison.compare(plan, baseline)).toBe(baseline);
  await comparison.compare({ status: 'semantic_missing_description' }, baseline);
  await comparison.compare({ ...plan, query: { description: 'x'.repeat(30000) } }, baseline);
  expect(comparison.read()).toMatchObject({ status: 'preflight', calls: 0, eligibleCases: 1,
    statuses: { semantic_not_run: 1, semantic_missing_description: 1, semantic_context_budget: 1 } });
  expect(client.generate).not.toHaveBeenCalled();
});

test('provider failure and cancellation fail closed without exposing exceptions', async () => {
  const client = { generate: jest.fn(async () => { throw new Error('PRIVATE token/path'); }) };
  const comparison = createGroupSemanticComparison(options, { client });
  expect(await comparison.compare(plan, baseline)).toBe(baseline);
  expect(comparison.read().statuses).toEqual({ semantic_provider_failed: 1 });
  const controller = new AbortController(); controller.abort();
  const cancelled = createGroupSemanticComparison(options, { client, signal: controller.signal });
  expect(await cancelled.compare(plan, baseline)).toBe(baseline);
  expect(cancelled.read().statuses).toEqual({ semantic_interrupted: 1 });
  expect(client.generate).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(comparison.read())).not.toContain('PRIVATE');
});
