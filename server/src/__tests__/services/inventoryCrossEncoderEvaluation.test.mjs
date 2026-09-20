/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createCrossEncoderEvaluation, validateCrossEncoderCases } from '../../services/inventoryCrossEncoderEvaluation.mjs';
import { crossEncoderWinner, runCrossEncoderTrial } from '../../services/inventoryCrossEncoderTrial.mjs';
import { prepareSemanticComparisonPlan } from '../../services/inventorySemanticComparisonContract.mjs';
import { leaderSemanticFixture } from '../fixtures/leaderSemanticFixture.mjs';
import { DiscoveryDeferredError } from '../../services/inventoryDiscoveryAdmission.mjs';

function fixture(count = 5) {
  const input = leaderSemanticFixture(count), plan = prepareSemanticComparisonPlan(input);
  const preferred = new Set(plan.candidates[0].examples);
  const client = { score: jest.fn(async (data, { onScoringCall }) => {
    onScoringCall(); return { identity: { revision: 'pinned' }, scores: data.texts.map(text => preferred.has(text) ? 2 : -1), latencyMs: 3 };
  }) };
  return { input, plan, client, createClient: jest.fn(() => client) };
}
test.each([-1, 101, NaN, 0.5, '1'])('rejects invalid scoring budget %s', value => {
  expect(() => validateCrossEncoderCases(value)).toThrow('cases_invalid');
});
test('zero scoring never creates a provider; insufficient examples and duplicate evidence abstain before requests', async () => {
  const { input, createClient } = fixture(), evaluation = createCrossEncoderEvaluation({ createClient });
  evaluation.add(input); const invalid = structuredClone(input); invalid.evidence.candidates[0].items = []; evaluation.add(invalid);
  expect(await evaluation.run()).toMatchObject({ calls: 0, eligible: 1, excluded: { evidence_unavailable: 1 }, livePromotionAllowed: false });
  expect(createClient).not.toHaveBeenCalled();
});
test('three uncached passes preserve pair indices across batches and reversed order', async () => {
  const { plan, client } = fixture(6);
  expect(await runCrossEncoderTrial(plan, { client })).toMatchObject({ status: 'supported', winner: plan.candidates[0].id, maxDelta: 0 });
  expect(client.score).toHaveBeenCalledTimes(6);
  const pairs = [{ id: 1 }, { id: 1 }, { id: 2 }, { id: 2 }];
  expect(crossEncoderWinner(pairs, [1, 1, 1, 1])).toBeNull();
  expect(() => crossEncoderWinner(pairs, [1])).toThrow('response_invalid');
  expect(() => crossEncoderWinner(pairs.slice(1), [1, 1, 1])).toThrow('examples_missing');
});
test('reports balanced media and placement comparisons without leaking text or claiming accuracy', async () => {
  const { input, createClient } = fixture(), evaluation = createCrossEncoderEvaluation({ scoreCases: 2, createClient });
  evaluation.add(input); evaluation.add({ ...input, metadata: { ...input.metadata, media_type: 'movie' } });
  const report = await evaluation.run();
  expect(report).toMatchObject({ calls: 6, completed: 2, shortfall: 0, statuses: { supported: 2 }, maxPairDelta: 0,
    perMedia: { movie: { attempted: 1 }, tv: { attempted: 1 } }, cacheBypassed: true, accuracy: null, latencyGatePassed: true });
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|voyage|Different example|candidateIds|baselineId|contextId/);
});
test.each(['numeric_drift', 'identity_drift', 'outage', 'invalid_scores'])('%s stops further cases, without repair prompts or fallback', async kind => {
  const { input, client, createClient } = fixture(), evaluation = createCrossEncoderEvaluation({ scoreCases: 2, createClient });
  evaluation.add(input); evaluation.add(input); let calls = 0;
  client.score.mockImplementation(async (data, { onScoringCall }) => {
    onScoringCall(); calls++;
    if (kind === 'outage') throw new Error('PRIVATE');
    return { identity: { revision: kind === 'identity_drift' ? calls : 1 }, latencyMs: 1,
      scores: kind === 'invalid_scores' ? [] : data.texts.map(() => kind === 'numeric_drift' ? calls : 1) };
  });
  const report = await evaluation.run(); expect(report).toMatchObject({ status: 'completed_with_errors', completed: 1, shortfall: 1 });
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
});
test('cancellation and admission deferral propagate without a false successful report', async () => {
  const { input, client, createClient } = fixture();
  for (const reason of ['abort', 'defer']) {
    const controller = new AbortController(), evaluation = createCrossEncoderEvaluation({ scoreCases: 1, createClient }); evaluation.add(input);
    client.score.mockImplementation(async () => {
      if (reason === 'abort') controller.abort();
      throw reason === 'defer' ? new DiscoveryDeferredError('busy') : new Error('private');
    });
    await expect(evaluation.run({ signal: controller.signal })).rejects.toThrow();
  }
});
