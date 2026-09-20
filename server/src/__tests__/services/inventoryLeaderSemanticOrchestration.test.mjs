/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { freshFixture, freshSettings } from '../fixtures/freshInventoryPolicyFixture.mjs';
import { DiscoveryDeferredError } from '../../services/inventoryDiscoveryAdmission.mjs';

const run = jest.fn(), add = jest.fn(), createLeaderSemanticEvaluation = jest.fn(() => ({ run, add }));
jest.unstable_mockModule('../../services/inventoryLeaderSemanticEvaluation.mjs', () => ({
  createLeaderSemanticEvaluation, LEADER_SEMANTIC_MAX_CASES: 32,
}));
const { runInventoryLeaderChallengeBenchmark } = await import('../../services/inventoryLeaderChallengeBenchmark.mjs');
const settings = { ...freshSettings, generateCases: 2 };
function fixture() {
  const value = freshFixture(); value.source.trainingExclusions = new Set();
  value.runtime.withDiscoveryAdmission = jest.fn(async (callback, { signal }) => callback(signal, () => signal.throwIfAborted()));
  return value;
}
beforeEach(() => {
  jest.clearAllMocks();
  run.mockImplementation(async ({ onGenerationCall }) => {
    onGenerationCall(); onGenerationCall();
    return { status: 'complete', calls: 2, livePromotionAllowed: false };
  });
});
test('semantic call accounting and final snapshot verification share the existing read-only runtime', async () => {
  const { runtime } = fixture();
  expect(await runInventoryLeaderChallengeBenchmark(settings, { semantic: true, loadRuntime: async () => runtime })).toMatchObject({
    protocol: 'inventory_leader_semantic_v1', sourceVerified: true, calls: 2, liveRoutingChanged: false, routingReceiptsCreated: 0 });
  expect(runtime.repository.read).toHaveBeenCalledTimes(2); expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0][0]).toMatchObject({ createClient: runtime.createClient });
});
test('a deferred run preserves calls already made instead of falsely reporting zero', async () => {
  const { runtime } = fixture();
  run.mockImplementation(async ({ onGenerationCall }) => { onGenerationCall(); throw new DiscoveryDeferredError('memory_pressure'); });
  expect(await runInventoryLeaderChallengeBenchmark(settings, { semantic: true, loadRuntime: async () => runtime })).toMatchObject({
    status: 'deferred', reason: 'memory_pressure', calls: 1, sourceVerified: false });
  expect(runtime.close).toHaveBeenCalledTimes(1);
});
test('post-generation source drift invalidates the entire result rather than claiming a valid comparison', async () => {
  const { source, runtime } = fixture(), changed = structuredClone(source);
  changed.trainingExclusions = new Set(source.trainingExclusions);
  changed.config.configuration_revision = 2;
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValue(changed);
  expect(await runInventoryLeaderChallengeBenchmark(settings, { semantic: true, loadRuntime: async () => runtime })).toMatchObject({
    status: 'invalidated', calls: 2, sourceVerified: false, changedComponents: ['configuration'] });
});
test('provider protocol failure marks the whole report as incomplete without bypassing source verification', async () => {
  const { runtime } = fixture();
  run.mockImplementation(async ({ onGenerationCall }) => { onGenerationCall(); return { status: 'completed_with_errors', calls: 1 }; });
  expect(await runInventoryLeaderChallengeBenchmark(settings, { semantic: true, loadRuntime: async () => runtime })).toMatchObject({
    status: 'completed_with_errors', calls: 1, sourceVerified: true, livePromotionAllowed: false });
});
test('the existing zero-generation mode never creates the semantic evaluator', async () => {
  const { runtime } = fixture();
  expect(await runInventoryLeaderChallengeBenchmark({ ...settings, generateCases: 0 }, { loadRuntime: async () => runtime }))
    .toMatchObject({ protocol: 'inventory_leader_challenge_v6', calls: 0 });
  expect(createLeaderSemanticEvaluation).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
});
