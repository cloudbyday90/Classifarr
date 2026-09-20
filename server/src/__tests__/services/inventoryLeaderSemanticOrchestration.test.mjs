/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { freshFixture, freshSettings } from '../fixtures/freshInventoryPolicyFixture.mjs';
import { DiscoveryDeferredError } from '../../services/inventoryDiscoveryAdmission.mjs';
import { fingerprintFreshPolicySnapshot } from '../../services/freshInventoryPolicyRuntime.mjs';

const run = jest.fn(), add = jest.fn(), createLeaderSemanticEvaluation = jest.fn(() => ({ run, add }));
jest.unstable_mockModule('../../services/inventoryLeaderSemanticEvaluation.mjs', () => ({
  createLeaderSemanticEvaluation, LEADER_SEMANTIC_MAX_CASES: 32,
}));
const { runInventoryLeaderChallengeBenchmark } = await import('../../services/inventoryLeaderChallengeBenchmark.mjs');
const settings = { ...freshSettings, generateCases: 2 };
function fixture() {
  const value = freshFixture(); value.source.trainingExclusions = new Set();
  value.source.fingerprint = fingerprintFreshPolicySnapshot(value.source);
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
test.each([false, true])('semantic call accounting and snapshot verification share the read-only runtime (grounded=%s)', async grounded => {
  const { runtime } = fixture();
  expect(await runInventoryLeaderChallengeBenchmark(settings, { semantic: true, grounded, loadRuntime: async () => runtime })).toMatchObject({
    protocol: grounded ? 'inventory_leader_grounded_v1' : 'inventory_leader_semantic_v1', sourceVerified: true, calls: 2, liveRoutingChanged: false, routingReceiptsCreated: 0 });
  expect(runtime.repository.read).toHaveBeenCalledTimes(3); expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0][0]).toMatchObject({ createClient: runtime.createClient });
  if (grounded) expect(createLeaderSemanticEvaluation).toHaveBeenCalledWith(expect.objectContaining({ grounded: true }));
});
test.each([false, true])('deferred run preserves issued calls (grounded=%s)', async grounded => {
  const { runtime } = fixture();
  run.mockImplementation(async ({ onGenerationCall }) => { onGenerationCall(); throw new DiscoveryDeferredError('memory_pressure'); });
  expect(await runInventoryLeaderChallengeBenchmark(settings, { semantic: true, grounded, admissionWaitMs: 300_000, loadRuntime: async () => runtime })).toMatchObject({
    status: 'deferred', reason: 'memory_pressure', calls: 1, sourceVerified: false });
  expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(runtime.withDiscoveryAdmission).toHaveBeenCalledTimes(1);
});

test('admission waiting forwards progress and cancellation and always closes the runtime', async () => {
  const { runtime } = fixture(), controller = new AbortController(), onProgress = jest.fn(() => controller.abort());
  runtime.withDiscoveryAdmission.mockRejectedValue(new DiscoveryDeferredError('busy'));
  await expect(runInventoryLeaderChallengeBenchmark(settings, { semantic: true, grounded: true, admissionWaitMs: 300_000,
    signal: controller.signal, onProgress, loadRuntime: async () => runtime })).rejects.toThrow();
  expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'discovery_wait', reason: 'busy' }));
  expect(runtime.close).toHaveBeenCalledTimes(1); expect(runtime.repository.read).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
});

test.each([-1, NaN, 300001])('invalid admission budget %s cannot load private runtime', async admissionWaitMs => {
  const loadRuntime = jest.fn();
  await expect(runInventoryLeaderChallengeBenchmark(settings, { semantic: true, admissionWaitMs, loadRuntime })).rejects.toThrow('wait_invalid');
  expect(loadRuntime).not.toHaveBeenCalled();
});
test.each([false, true])('post-generation source drift invalidates the result (grounded=%s)', async grounded => {
  const { source, runtime } = fixture(), changed = structuredClone(source);
  changed.trainingExclusions = new Set(source.trainingExclusions);
  changed.config.configuration_revision = 2;
  changed.fingerprint = fingerprintFreshPolicySnapshot(changed);
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValueOnce(source).mockResolvedValue(changed);
  expect(await runInventoryLeaderChallengeBenchmark(settings, { semantic: true, grounded, loadRuntime: async () => runtime })).toMatchObject({
    status: 'invalidated', calls: 2, sourceVerified: false, changedComponents: ['configuration'] });
});

test.each([false, true])('pre-generation source drift prevents semantic calls (grounded=%s)', async grounded => {
  const { source, runtime } = fixture(), changed = { ...source, config: { ...source.config, configuration_revision: 2 } };
  changed.fingerprint = fingerprintFreshPolicySnapshot(changed);
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValue(changed);
  await expect(runInventoryLeaderChallengeBenchmark(settings, { semantic: true, grounded, loadRuntime: async () => runtime }))
    .rejects.toThrow('source_changed');
  expect(run).not.toHaveBeenCalled(); expect(runtime.close).toHaveBeenCalledTimes(1);
});

test.each([false, true])('metadata enrichment retains semantic results without live authority (grounded=%s)', async grounded => {
  const { source, runtime } = fixture(), changed = structuredClone(source);
  changed.trainingExclusions = new Set(source.trainingExclusions);
  changed.candidateMetadata.get('movie:1').genres = ['refreshed'];
  changed.fingerprint = fingerprintFreshPolicySnapshot(changed);
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValue(changed);
  expect(await runInventoryLeaderChallengeBenchmark(settings, { semantic: true, grounded, loadRuntime: async () => runtime }))
    .toMatchObject({ status: 'complete', calls: 2, evaluationSnapshotValid: true, sourceVerified: false,
      liveMetadataRefreshed: true, changedComponents: ['metadata'], livePromotionAllowed: false });
  expect(runtime.close).toHaveBeenCalledTimes(1);
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
