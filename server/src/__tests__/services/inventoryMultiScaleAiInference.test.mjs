/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createMultiScaleAiInference } from '../../services/inventoryMultiScaleAiInference.mjs';
import { createMultiScaleAiMetrics } from '../../services/inventoryMultiScaleAiMetrics.mjs';
import { identity, generationResult } from '../fixtures/inventoryMultiScaleAiFixture.mjs';
const options = { generateCases: 4, context: 8192 }, plan = { candidates: [{ id: 7 }, { id: 8 }] };
const prompts = [['raw forward', 'raw reverse'], ['context forward', 'context reverse']];
const make = (change = {}, dependencies = {}) => {
  const client = { generate: jest.fn(async ({ onGenerationCall }) => { onGenerationCall(); return { ...generationResult, ...change }; }) };
  return { client, inference: createMultiScaleAiInference(options, { client, identity, ...dependencies }) };
};

test('counterbalances both arm and candidate timing, strictly bounds calls and records only totals', async () => {
  const { client, inference } = make(), onProgress = jest.fn();
  const measured = createMultiScaleAiInference(options, { client, identity, onProgress });
  for (let index = 0; index < 5; index++) await measured.compare(plan, prompts, index);
  expect(client.generate.mock.calls.map(([row]) => row.prompt)).toEqual([
    'raw forward', 'raw reverse', 'context forward', 'context reverse',
    'context forward', 'context reverse', 'raw forward', 'raw reverse',
    'raw reverse', 'raw forward', 'context reverse', 'context forward',
    'context reverse', 'context forward', 'raw reverse', 'raw forward',
  ]);
  expect(measured.read()).toMatchObject({ status: 'complete', calls: 16, attemptedCases: 4, completePairs: 4,
    arms: [{ calls: 8, validPasses: 8, promptTokens: 800 }, { calls: 8, validPasses: 8, promptTokens: 800 }] });
  expect(JSON.stringify([measured.read(), onProgress.mock.calls])).not.toMatch(/raw forward|response|candidate/);
  expect(await inference.compare(plan, prompts, 0)).toEqual([{ status: 'abstained' }, { status: 'abstained' }]);
});

test('distinguishes stable selected destination from order-sensitive choices', async () => {
  const { client, inference } = make({ response: '{"candidate":1}' });
  client.generate.mockImplementationOnce(async ({ onGenerationCall }) => { onGenerationCall(); return { ...generationResult, response: '{"candidate":2}' }; });
  expect(await inference.compare(plan, prompts, 0)).toEqual([{ status: 'selected', id: 8 }, { status: 'order_sensitive' }]);
});

test.each([
  [{ response: '{"candidate":1,"candidate":0}' }, 'invalid_response'],
  [{ promptTokens: NaN }, 'invalid_response'], [{ latencyMs: -1 }, 'invalid_response'],
  [{ outputTokens: 65 }, 'invalid_response'], [{ outputLimitReached: true }, 'output_limit'],
  [{ contextLimitSuspected: true }, 'context_limit'],
])('stops after failure without calling another arm or counting a pair %#', async (change, status) => {
  const { client, inference } = make(change);
  expect(await inference.compare(plan, prompts, 0)).toBeNull();
  expect(await inference.compare(plan, prompts, 1)).toBeNull();
  expect(client.generate).toHaveBeenCalledTimes(1);
  expect(inference.read()).toMatchObject({ status: 'completed_with_errors', calls: 1, completePairs: 0, failures: { [status]: 1 } });
});

test('provider failure/cancellation never leaks text or scores an incomplete pair', async () => {
  const { client, inference } = make();
  client.generate.mockRejectedValueOnce(new Error('PRIVATE host and body'));
  expect(await inference.compare(plan, prompts, 0)).toBeNull();
  expect(inference.read()).toMatchObject({ failures: { provider_failed: 1 }, calls: 0 });
  expect(JSON.stringify(inference.read())).not.toContain('PRIVATE');
  const controller = new AbortController(), cancelled = make({}, { signal: controller.signal });
  cancelled.client.generate.mockImplementationOnce(async ({ onGenerationCall }) => { onGenerationCall(); controller.abort(); return generationResult; });
  expect(await cancelled.inference.compare(plan, prompts, 0)).toBeNull();
  expect(cancelled.inference.read()).toMatchObject({ status: 'interrupted', completePairs: 0, failures: { interrupted: 1 } });
  expect(await cancelled.inference.compare(plan, prompts, 1)).toBeNull();
});

test('anonymous metrics separate selected/abstained/unstable and gained/lost placement agreement', () => {
  const metrics = createMultiScaleAiMetrics([{ id: 7, media_type: 'movie' }, { id: 8, media_type: 'movie' }, { id: 9, media_type: 'tv' }]);
  const doc = { type: 'movie', libraryIds: [7] }, ready = { status: 'ready', rawExamples: 6, compactExamples: 3,
    compactContextExamples: 1, evidencePoolExamples: 12, compactEmptyCandidates: 0, emptyCandidates: 0, shortlistMiss: false };
  metrics.prepare(doc, ready, false); metrics.prepare(doc, { status: 'insufficient_candidates' }, false);
  metrics.record(doc, [{ status: 'abstained' }, { status: 'selected', id: 7 }]);
  metrics.record(doc, [{ status: 'selected', id: 7 }, { status: 'selected', id: 8 }]);
  metrics.record(doc, [{ status: 'order_sensitive' }, { status: 'abstained' }]);
  expect(metrics.read()).toMatchObject({ sampled: 2, ready: 1, generatedPairs: 3, changedStableChoice: 2,
    gainedPlacementAgreement: 1, lostPlacementAgreement: 1, compactExamples: 3, compactContextExamples: 1, evidencePoolExamples: 12,
    arms: [{ name: 'raw', selected: 1, abstained: 1, orderSensitive: 1 }, { name: 'compact', selected: 2, abstained: 1, orderSensitive: 0 }] });
  expect(metrics.read().mediaTypes[1].generatedPairs).toBe(0);
  expect(metrics.read().libraries[0].generatedPairs).toBe(3);
  expect(JSON.stringify(metrics.read())).not.toContain('libraryIds');
  const copy = metrics.read(); copy.sampled = 99; expect(metrics.read().sampled).toBe(2);
});
