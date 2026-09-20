/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLeaderSemanticEvaluation } from '../../services/inventoryLeaderSemanticEvaluation.mjs';
import { leaderSemanticFixture } from '../fixtures/leaderSemanticFixture.mjs';
import { DiscoveryDeferredError } from '../../services/inventoryDiscoveryAdmission.mjs';

const options = { generateCases: 2, context: 8192, grounded: true };
const grade = (fit = 0, support = [], contradictions = []) => ({ fit, support, contradictions });
const serialize = grades => JSON.stringify({ grades });
const first = serialize([grade(2, [1, 2]), grade()]);
const reversed = serialize([grade(), grade(2, [2, 3])]);
function runtime(responses = ['{"candidate":1}', '{"candidate":2}', first, first, reversed]) {
  const client = { inspect: jest.fn(async () => ({ model: 'local', digest: 'b'.repeat(64) })),
    generate: jest.fn(async ({ onGenerationCall }) => {
      onGenerationCall(); return { response: responses.shift(), latencyMs: 1, promptTokens: 10, outputTokens: 5 };
    }) };
  return { createClient: jest.fn(() => client), client };
}
function evaluation(extra = {}) {
  const result = createLeaderSemanticEvaluation({ ...options, ...extra }); result.add(leaderSemanticFixture(2)); return result;
}
test('stable grounded support requires all five calls and identical repeated inputs', async () => {
  const deps = runtime(), onGenerationCall = jest.fn();
  const report = await evaluation().run({ ...deps, onGenerationCall });
  expect(report).toMatchObject({ protocol: 'inventory_leader_grounded_comparison_v1', calls: 5,
    statuses: { supported: 1 }, inference: { maximumCalls: 5, outputTokens: 25 },
    grounding: { completeCases: 1, repeatDecisionChanges: 0, reorderDecisionChanges: 0,
      supportedAssessments: 3, insufficientAssessments: 3, contradictedAssessments: 0,
      pairedPlacement: { jointlyStableSelections: 1, gained: 0, lost: 0 } },
    livePromotionAllowed: false, accuracy: null, routingReceiptsCreated: 0 });
  const calls = deps.client.generate.mock.calls.map(([input]) => input);
  expect(calls[2].prompt).toBe(calls[3].prompt); expect(calls[4].prompt).not.toBe(calls[2].prompt);
  expect(calls.map(call => call.responseContract)).toEqual(['library_comparison', 'library_comparison', ...Array(3).fill('grounded_comparison')]);
  expect(onGenerationCall).toHaveBeenCalledTimes(5);
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|Different example|support":\[|contradictions":\[|baselineId|"observed"/);
});
test.each(['repeat_decision', 'repeat_evidence', 'reorder_decision', 'reorder_evidence'])('%s withholds even otherwise supported proposals', async kind => {
  const responses = ['{"candidate":1}', '{"candidate":2}', first, first, reversed];
  const index = kind.startsWith('repeat') ? 3 : 4;
  responses[index] = kind.endsWith('decision') ? serialize([grade(), grade()])
    : kind.startsWith('repeat') ? serialize([grade(2, [1, 3]), grade()]) : serialize([grade(), grade(2, [1, 3])]);
  const report = await evaluation().run(runtime(responses));
  expect(report.statuses).toEqual({ unstable_assessment: 1 });
  expect(report.placementComparison.stableProposals).toBe(0);
  expect(report.grounding[kind.startsWith('repeat') ? 'repeatEvidenceChanges' : 'reorderEvidenceChanges']).toBe(1);
});
test.each([
  [[grade(), grade()], 'insufficient_evidence'],
  [[grade(1, [], [2]), grade()], 'contradiction_without_support'],
  [[grade(2, [1, 2, 3]), grade(2, [1, 2, 3])], 'multiple_supported'],
])('explicit stable abstention reason %# is retained', async (grades, reason) => {
  const raw = serialize(grades), reverse = serialize([...grades].reverse());
  const report = await evaluation().run(runtime(['{"candidate":0}', '{"candidate":0}', raw, raw, reverse]));
  expect(report.statuses).toEqual({ abstained: 1 });
  expect(report.grounding.abstentionReasons[reason]).toBe(1);
  expect(report.grounding.controlStatuses.abstained).toBe(1);
});
test.each([0, 1, 2, 3, 4])('invalid output at pass %s stops remaining calls and cases', async index => {
  const responses = ['{"candidate":1}', '{"candidate":2}', first, first, reversed]; responses[index] = 'PRIVATE malformed';
  const deps = runtime(responses), value = evaluation(); value.add(leaderSemanticFixture(2));
  const report = await value.run(deps);
  expect(report).toMatchObject({ status: 'completed_with_errors', calls: index + 1, attemptedCases: 1, grounding: { completeCases: 0 } });
  expect(deps.client.generate).toHaveBeenCalledTimes(index + 1);
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
});
test.each(['outputLimitReached', 'contextLimitSuspected', 'provider', 'abort'])('late %s stops without repair and counts issued calls', async failure => {
  const deps = runtime(), original = deps.client.generate.getMockImplementation(), controller = new AbortController(); let count = 0;
  deps.client.generate.mockImplementation(async input => {
    const result = await original(input); count++;
    if (count !== 3) return result;
    if (failure === 'abort') controller.abort();
    if (failure === 'provider' || failure === 'abort') throw new Error('PRIVATE provider details');
    return { ...result, [failure]: true };
  });
  const run = evaluation().run({ ...deps, signal: controller.signal });
  if (failure === 'abort') await expect(run).rejects.toThrow();
  else expect(await run).toMatchObject({ status: 'completed_with_errors', calls: 3, grounding: { completeCases: 0 } });
  expect(count).toBe(3);
  expect(await evaluation().run(runtime())).toMatchObject({ status: 'complete', calls: 5 });
});
test('zero-generation and bounded context preflight never create a provider', async () => {
  const deps = runtime(), value = evaluation({ generateCases: 0 });
  expect(await value.run(deps)).toMatchObject({ status: 'preflight', calls: 0, grounding: { completeCases: 0 } });
  expect(deps.createClient).not.toHaveBeenCalled();
  expect(() => createLeaderSemanticEvaluation({ ...options, grounded: 'yes' })).toThrow('options_invalid');
  const large = leaderSemanticFixture(64);
  large.evidence.candidates.forEach((candidate, index) => candidate.items.forEach((item, offset) => { item.description = `${index}-${offset}-${'x'.repeat(590)}`; }));
  const bounded = createLeaderSemanticEvaluation(options); bounded.add(large);
  expect(await bounded.run(deps)).toMatchObject({ calls: 0, excluded: { context_budget: 1 } });
  expect(deps.createClient).not.toHaveBeenCalled();
});
test('control disagreement is separate from grounded stability, withholding probes from placement metrics', async () => {
  const value = createLeaderSemanticEvaluation(options), input = leaderSemanticFixture(2);
  value.add({ ...input, kind: 'withheld_library', observed: [], baselineId: null });
  const report = await value.run(runtime(['{"candidate":1}', '{"candidate":1}', first, first, reversed]));
  expect(report).toMatchObject({ withheldLibraryProposals: 1, placementComparison: { stableProposals: 0 },
    grounding: { controlStatuses: { order_sensitive: 1 }, pairedPlacement: { jointlyStableSelections: 0 } } });
});

test('admission pressure between passes defers and preserves actual call accounting', async () => {
  let calls = 0;
  await expect(evaluation().run({ ...runtime(), onGenerationCall: () => { calls++; },
    checkpoint: () => { if (calls === 3) throw new DiscoveryDeferredError('memory_pressure'); } }))
    .rejects.toBeInstanceOf(DiscoveryDeferredError);
  expect(calls).toBe(3);
});
test.each([[1, 2, 1, 0], [2, 2, 0, 1]])('paired agreement for observed %s / control %s is explicit', async (observed, control, gained, lost) => {
  const value = createLeaderSemanticEvaluation(options); value.add({ ...leaderSemanticFixture(2), observed: [observed] });
  const report = await value.run(runtime([`{"candidate":${control}}`, `{"candidate":${3 - control}}`, first, first, reversed]));
  expect(report.grounding.pairedPlacement).toMatchObject({ jointlyStableSelections: 1, gained, lost });
});
