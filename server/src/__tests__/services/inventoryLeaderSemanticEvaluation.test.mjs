/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLeaderSemanticEvaluation } from '../../services/inventoryLeaderSemanticEvaluation.mjs';
import { leaderSemanticFixture } from '../fixtures/leaderSemanticFixture.mjs';

const options = { generateCases: 8, context: 8192 };
function runtime(responses = ['{"candidate":1}', '{"candidate":5}']) {
  const identity = { model: 'local:latest', digest: 'b'.repeat(64), contextLength: 32768 };
  const client = { inspect: jest.fn(async () => identity), generate: jest.fn(async ({ onGenerationCall }) => {
    onGenerationCall(); return { response: responses.shift(), latencyMs: 1, promptTokens: 10, outputTokens: 5 };
  }) };
  return { client, createClient: jest.fn(() => client), signal: new AbortController().signal };
}

test.each([-1, 33, '2', NaN])('strict generation budget %s is enforced', generateCases => {
  expect(() => createLeaderSemanticEvaluation({ ...options, generateCases })).toThrow('options_invalid');
});
test('zero-generation preflight is private, complete-scope, and never even creates a provider client', async () => {
  const evaluation = createLeaderSemanticEvaluation({ ...options, generateCases: 0 }), deps = runtime();
  evaluation.add(leaderSemanticFixture());
  const report = await evaluation.run(deps);
  expect(report).toMatchObject({ status: 'preflight', eligible: 1, retained: 1, calls: 0, attemptedCases: 0 });
  expect(deps.createClient).not.toHaveBeenCalled();
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|voyage|Different example|candidateIds|baselineId|"observed"|contextId/);
});
test.each([
  ['{"candidate":1}', '{"candidate":5}', 'supported'],
  ['{"candidate":0}', '{"candidate":0}', 'abstained'],
  ['{"candidate":1}', '{"candidate":1}', 'order_sensitive'],
  ['{"candidate":0}', '{"candidate":5}', 'order_sensitive'],
])('paired comparison %s / %s yields %s without live authority', async (first, second, status) => {
  const evaluation = createLeaderSemanticEvaluation(options), deps = runtime([first, second]);
  evaluation.add(leaderSemanticFixture());
  const report = await evaluation.run(deps);
  expect(report).toMatchObject({ calls: 2, statuses: { [status]: 1 }, inference: { promptTokens: 20, outputTokens: 10 },
    accuracy: null, liveRoutingChanged: false, livePromotionAllowed: false, routingReceiptsCreated: 0 });
  expect(deps.client.generate.mock.calls.every(([input]) => input.count === 5 && input.responseContract === 'library_comparison')).toBe(true);
  if (status === 'supported') expect(report.placementComparison).toMatchObject({ gained: 1, lost: 0, underReviewVeto: 1 });
});
test.each(['invalid', 'output_limit', 'context_limit', 'provider', 'inspect'])('%s stops without repair, leakage, or subsequent case calls', async kind => {
  const evaluation = createLeaderSemanticEvaluation(options), deps = runtime(['{bad}']);
  evaluation.add(leaderSemanticFixture()); evaluation.add(leaderSemanticFixture());
  if (kind === 'provider') deps.client.generate.mockRejectedValue(new Error('PRIVATE failed'));
  if (kind === 'inspect') deps.client.inspect.mockRejectedValue(new Error('PRIVATE failed'));
  if (['output_limit', 'context_limit'].includes(kind)) deps.client.generate.mockImplementation(async ({ onGenerationCall }) => {
    onGenerationCall(); return { response: '{"candidate":1}', latencyMs: 1, promptTokens: 10, outputTokens: 5,
      outputLimitReached: kind === 'output_limit', contextLimitSuspected: kind === 'context_limit' };
  });
  const report = await evaluation.run(deps);
  expect(report).toMatchObject({ status: 'completed_with_errors', attemptedCases: 1 });
  expect(deps.client.generate.mock.calls.length).toBeLessThanOrEqual(1); expect(JSON.stringify(report)).not.toContain('PRIVATE');
});
test('whole-run cancellation propagates and a fresh evaluator can recover', async () => {
  const evaluation = createLeaderSemanticEvaluation(options), deps = runtime(), controller = new AbortController();
  evaluation.add(leaderSemanticFixture());
  let calls = 0;
  deps.client.generate.mockImplementation(async ({ onGenerationCall }) => { onGenerationCall(); controller.abort(); throw new Error('private'); });
  await expect(evaluation.run({ ...deps, signal: controller.signal, onGenerationCall: () => { calls++; } })).rejects.toThrow();
  expect(calls).toBe(1);
  const fresh = createLeaderSemanticEvaluation(options); fresh.add(leaderSemanticFixture());
  expect(await fresh.run(runtime())).toMatchObject({ status: 'complete', calls: 2 });
});
test('bounded retention and balanced selection separate withheld probes from placement comparison', async () => {
  const evaluation = createLeaderSemanticEvaluation({ ...options, generateCases: 2 }), deps = runtime(['{"candidate":1}', '{"candidate":5}', '{"candidate":1}', '{"candidate":5}']);
  const ordinary = leaderSemanticFixture(); ordinary.metadata.media_type = 'movie';
  evaluation.add(ordinary); evaluation.add({ ...leaderSemanticFixture(), kind: 'withheld_library', observed: [], baselineId: null });
  for (let index = 0; index < 70; index++) evaluation.add(ordinary);
  const report = await evaluation.run(deps);
  expect(report).toMatchObject({ eligible: 72, retained: 64, sampled: 32, attemptedCases: 2, calls: 4,
    excluded: { retention_budget: 8 }, withheldLibraryProposals: 1, placementComparison: { attempted: 1 } });
  expect(report.byMedia.every(row => row.sampled > 0)).toBe(true);
});
test('missing and oversized evidence never sends a partial candidate scope', async () => {
  const evaluation = createLeaderSemanticEvaluation(options), deps = runtime();
  const missing = leaderSemanticFixture(); missing.evidence.candidates[0].items = []; evaluation.add(missing);
  const large = leaderSemanticFixture(64);
  large.evidence.candidates.forEach((candidate, index) => candidate.items.forEach((row, item) => { row.description = `${index}-${item}-${'x'.repeat(590)}`; }));
  evaluation.add(large);
  expect(await evaluation.run(deps)).toMatchObject({ calls: 0, excluded: { evidence_unavailable: 1, context_budget: 1 } });
  expect(deps.createClient).not.toHaveBeenCalled();
});
