/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { freshFixture, freshSettings } from '../fixtures/freshInventoryPolicyFixture.mjs';
import { fingerprintFreshPolicySnapshot } from '../../services/freshInventoryPolicyRuntime.mjs';
import { runFreshInventoryPolicyEvaluation } from '../../services/freshInventoryPolicyEvaluation.mjs';
import { runInventoryLeaderChallengeBenchmark } from '../../services/inventoryLeaderChallengeBenchmark.mjs';

const settings = { ...freshSettings, generateCases: 0 };
const runners = [runFreshInventoryPolicyEvaluation, runInventoryLeaderChallengeBenchmark];
// structuredClone's Set belongs to the host realm in Jest; use the repository's native Set contract.
const cloneSource = source => ({ ...structuredClone(source), trainingExclusions: new Set(source.trainingExclusions) });
function fixture() {
  const value = freshFixture();
  value.source.trainingExclusions = new Set(['movie:1']);
  value.source.fingerprint = fingerprintFreshPolicySnapshot(value.source);
  value.runtime.withDiscoveryAdmission = jest.fn(async (callback, { signal }) => callback(signal, () => signal.throwIfAborted()));
  return value;
}
const changes = {
  metadata: source => { source.candidateMetadata.get('movie:1').genres = ['enriched']; },
  observedTraits: source => { source.evaluationRows[0].genres = ['enriched']; },
  policies: source => { source.policies[0].prompt_threshold = 61; },
  authority: source => { source.policies[0].policy_runtime_authority = { valid: false }; },
  libraries: source => { source.libraries[0].is_active = false; },
  identity: source => { source.corpus.documents[0].key = 'movie:999'; },
  membership: source => { source.corpus.documents[0].libraryIds = [2]; },
  description: source => { source.corpus.documents[0].hash = 'new-description'; },
  vectors: source => { source.vectors.set([...source.vectors.keys()][0], [0, 1]); },
  configuration: source => { source.config.configuration_revision = 2; },
  provenance: source => { source.trainingExclusions.add('movie:2'); },
  removedProvenance: source => { delete source.trainingExclusions; },
  mixed: source => { changes.metadata(source); changes.policies(source); },
};

test.each(Object.keys(changes))('fresh and leader final %s drift use the same contract', async kind => {
  const reports = [];
  for (const run of runners) {
    const { source, runtime } = fixture(), current = cloneSource(source);
    changes[kind](current); current.fingerprint = fingerprintFreshPolicySnapshot(current);
    runtime.repository.read.mockReset().mockResolvedValueOnce(source);
    if (run === runFreshInventoryPolicyEvaluation) runtime.repository.read.mockResolvedValueOnce(source);
    runtime.repository.read.mockResolvedValue(current);
    const before = structuredClone(source), report = await run(settings, { loadRuntime: async () => runtime });
    const metadataOnly = ['metadata', 'observedTraits'].includes(kind);
    expect(report).toMatchObject({ sourceVerified: false, evaluationSnapshotValid: metadataOnly,
      snapshotScope: 'frozen_at_start', liveMetadataRefreshed: metadataOnly || kind === 'mixed',
      verificationFailure: metadataOnly ? null : 'source_changed', calls: 0, liveRoutingChanged: false });
    expect(report.status).toBe(metadataOnly ? run === runFreshInventoryPolicyEvaluation ? 'preflight' : 'complete' : 'invalidated');
    expect(source).toEqual(before); expect(runtime.close).toHaveBeenCalledTimes(1);
    expect(runtime.createClient).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).not.toMatch(/Private|movie:999|enriched/);
    reports.push(report);
  }
  expect(reports[0].changedComponents).toEqual(reports[1].changedComponents);
});

test('fresh evaluator also detects newly added provenance; leader requires it at capture', async () => {
  const { source, runtime } = freshFixture(), current = structuredClone(source);
  current.trainingExclusions = new Set(); current.fingerprint = fingerprintFreshPolicySnapshot(current);
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValueOnce(source).mockResolvedValue(current);
  expect(await runFreshInventoryPolicyEvaluation(settings, { loadRuntime: async () => runtime })).toMatchObject({
    status: 'invalidated', evaluationSnapshotValid: false, sourceVerified: false,
    changedComponents: ['componentSchema', 'provenance'], verificationFailure: 'source_changed', calls: 0 });
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test.each(['metadata', 'observedTraits'])('scorer retains frozen %s measurements, costs and pre-check history after live reversion', async kind => {
  const { source, runtime } = fixture(), current = cloneSource(source);
  changes[kind](current); current.fingerprint = fingerprintFreshPolicySnapshot(current);
  runtime.repository.read.mockReset().mockResolvedValueOnce(source).mockResolvedValueOnce(current).mockResolvedValue(source);
  const score = jest.fn(async (input, { onScoringCall }) => { onScoringCall(); return {
    identity: { model: 'pinned' }, scores: input.texts.map(() => 0), latencyMs: 1 }; });
  const report = await runInventoryLeaderChallengeBenchmark(settings, { loadRuntime: async () => runtime,
    crossEncoder: true, scoreCases: 2, createScorer: () => ({ score }) });
  expect(report).toMatchObject({ status: 'complete', sourceVerified: false, evaluationSnapshotValid: true,
    liveMetadataRefreshed: true, changedComponents: [kind], scoringCalls: 6, calls: 0, livePromotionAllowed: false,
    crossEncoderComparison: { completed: 2, statuses: { abstained: 2 } } });
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test.each(['policies', 'mixed', 'configuration'])('leader %s drift before inference prevents all scoring', async kind => {
  const { source, runtime } = fixture(), current = cloneSource(source), createScorer = jest.fn();
  changes[kind](current); current.fingerprint = fingerprintFreshPolicySnapshot(current);
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValue(current);
  await expect(runInventoryLeaderChallengeBenchmark(settings, { loadRuntime: async () => runtime,
    crossEncoder: true, scoreCases: 2, createScorer })).rejects.toThrow('source_changed');
  expect(createScorer).not.toHaveBeenCalled(); expect(runtime.close).toHaveBeenCalledTimes(1);
});

test.each(runners)('cancelled verification does not certify a result: %p', async run => {
  const { source, runtime } = fixture(), controller = new AbortController();
  runtime.repository.read.mockResolvedValueOnce(source);
  if (run === runFreshInventoryPolicyEvaluation) runtime.repository.read.mockResolvedValueOnce(source);
  runtime.repository.read.mockImplementation(async () => { controller.abort(); return source; });
  const result = run(settings, { loadRuntime: async () => runtime, signal: controller.signal });
  if (run === runFreshInventoryPolicyEvaluation) expect(await result).toMatchObject({ status: 'interrupted', sourceVerified: false, evaluationSnapshotValid: false });
  else await expect(result).rejects.toThrow();
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test('metadata-only freshness does not hide scorer failure or discard actual request count', async () => {
  const { source, runtime } = fixture(), current = cloneSource(source);
  changes.metadata(current); current.fingerprint = fingerprintFreshPolicySnapshot(current);
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValue(current);
  const report = await runInventoryLeaderChallengeBenchmark(settings, { loadRuntime: async () => runtime,
    crossEncoder: true, scoreCases: 2, createScorer: () => ({ score: async (_input, { onScoringCall }) => {
      onScoringCall(); throw new Error('Private provider output');
    } }) });
  expect(report).toMatchObject({ status: 'completed_with_errors', evaluationSnapshotValid: true,
    sourceVerified: false, liveMetadataRefreshed: true, scoringCalls: 1, livePromotionAllowed: false,
    crossEncoderComparison: { statuses: { provider_failed: 1 } } });
  expect(JSON.stringify(report)).not.toContain('Private'); expect(runtime.close).toHaveBeenCalledTimes(1);
});

test.each(runners)('metadata refresh never bypasses the embedding representation check: %p', async run => {
  const { source, runtime } = fixture(), current = cloneSource(source);
  changes.metadata(current); current.fingerprint = fingerprintFreshPolicySnapshot(current);
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValue(current);
  const inspect = runtime.embedder.inspect.getMockImplementation();
  runtime.embedder.inspect.mockImplementationOnce(inspect).mockImplementationOnce(inspect)
    .mockImplementation(async () => ({ ...await inspect(), digest: 'f'.repeat(64) }));
  await expect(run(settings, { loadRuntime: async () => runtime })).rejects.toThrow('model_changed');
  expect(runtime.createClient).not.toHaveBeenCalled(); expect(runtime.close).toHaveBeenCalledTimes(1);
});
