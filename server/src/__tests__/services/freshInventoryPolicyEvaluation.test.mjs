/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { freshFixture, freshSettings } from '../fixtures/freshInventoryPolicyFixture.mjs';
import { runFreshInventoryPolicyEvaluation } from '../../services/freshInventoryPolicyEvaluation.mjs';
import { runInventoryDescriptionBenchmark } from '../../scripts/runInventoryDescriptionBenchmark.mjs';
import { preparePolicyShortlistReplayCase } from '../../services/policyShortlistReplayCase.mjs';
import { fingerprintFreshPolicySnapshot } from '../../services/freshInventoryPolicyRuntime.mjs';

// Isolate generation orchestration while using real fold evidence, prompt, parser and routing reducers.
async function admittedCase(sample, source, evidence, signal) {
  const runtime = evidence.forCase(sample);
  const policyResult = { action: 'manual', confidence: 45, ranked: source.libraries
    .filter(library => library.media_type === sample.mediaType).map(library => ({ library_id: library.id,
      score: 45, auto_classify_threshold: 85, prompt_threshold: 60 })) };
  const replay = await preparePolicyShortlistReplayCase({ metadata: runtime.metadata, policyResult }, source, runtime, signal);
  return { ...replay, mode: 'adjudicate', modeReason: 'manual_candidate_adjudication_ready', policyResult,
    reviewPolicies: source.policies, missingMetadata: [] };
}

test('fresh full-cohort preflight evaluates movies and TV without loading a generation client', async () => {
  const { runtime } = freshFixture();
  const report = await runFreshInventoryPolicyEvaluation({ ...freshSettings, generateCases: 0 }, { loadRuntime: async () => runtime });
  expect(report).toMatchObject({ status: 'preflight', sampled: 12, policyEvaluated: 12, calls: 0, accuracy: null, freshPolicyEvaluation: true });
  expect(report.media.every(row => row.policyEvaluated > 0)).toBe(true);
  expect(runtime.createClient).not.toHaveBeenCalled();
  expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(report.learnedReview).toMatchObject({ evaluated: 0, livePromotionAllowed: false });
  expect(report.matchCalibration).toMatchObject({ sampled: 12, afterNoveltyCheck: 0, livePromotionAllowed: false });
  expect(report.matchCalibration.observedPlacementStates.sparse).toBe(12);
  expect(JSON.stringify(report)).not.toMatch(/Private|tmdb|ollama_host|library_id|observedLibraryIds/);
});

test('admitted generation uses one production contract per case, separates weak agreement from accuracy and never routes', async () => {
  const { runtime, client } = freshFixture();
  const report = await runFreshInventoryPolicyEvaluation(freshSettings, { loadRuntime: async () => runtime, prepareCase: admittedCase });
  expect(report).toMatchObject({ status: 'complete', calls: 12, proposals: 12, adjudicationReady: 12,
    routeSafetyAllowed: 0, routingReceiptsCreated: 0, learningRecordsCreated: 0, totalOutputTokens: 168, accuracy: null });
  expect(client.generate.mock.calls.every(([request]) => request.responseContract === 'adjudication')).toBe(true);
  expect(report.learnedReview).toMatchObject({ evaluated: 12, livePromotionAllowed: false });
  expect(report.matchCalibration).toMatchObject({ sampled: 12, afterNoveltyCheck: 0, probabilityCalibrated: false });
  expect(JSON.stringify(report)).not.toMatch(/Private|tmdb|ollama_host|destinationId/);
});

test('generation model drift invalidates the frozen report and stops further calls', async () => {
  const { runtime, client } = freshFixture();
  client.generate.mockImplementation(async ({ onGenerationCall }) => {
    onGenerationCall();
    throw new Error('description_benchmark_model_changed');
  });
  const report = await runFreshInventoryPolicyEvaluation(freshSettings, { loadRuntime: async () => runtime, prepareCase: admittedCase });
  expect(report).toMatchObject({ status: 'invalidated', verificationFailure: 'generation_model_changed',
    evaluationSnapshotValid: false, calls: 1 });
  expect(client.generate).toHaveBeenCalledTimes(1);
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test.each(['invalid', 'limited', 'failed', 'cancelled', 'abstained'])('handles %s responses without private errors or extra calls', async kind => {
  const { runtime, client } = freshFixture(), controller = new AbortController();
  client.generate.mockImplementation(async ({ onGenerationCall }) => {
    onGenerationCall();
    if (kind === 'failed') throw new Error('Private provider secret');
    if (kind === 'cancelled') controller.abort();
    return { response: kind === 'abstained' ? '{"decision":"ABSTAIN","library_number":null}' : 'Private invalid answer',
      outputLimitReached: kind === 'limited', latencyMs: 2, promptTokens: 20, outputTokens: 8 };
  });
  const report = await runFreshInventoryPolicyEvaluation({ ...freshSettings, generateCases: 1 }, {
    loadRuntime: async () => runtime, prepareCase: admittedCase, signal: controller.signal });
  expect(report.status).toBe(kind === 'cancelled' ? 'interrupted' : kind === 'abstained' ? 'complete' : 'completed_with_errors');
  expect(report.calls).toBe(1);
  expect(report.proposals).toBe(0);
  expect(JSON.stringify(report)).not.toContain('Private');
});

test('source drift invalidates the report and closes runtime; cancellation and invalid options do not load it', async () => {
  const { source, runtime } = freshFixture();
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValue({ ...source, fingerprint: 'changed' });
  await expect(runFreshInventoryPolicyEvaluation(freshSettings, { loadRuntime: async () => runtime })).rejects.toThrow('source_changed');
  expect(runtime.close).toHaveBeenCalledTimes(1);
  const loadRuntime = jest.fn(), controller = new AbortController(); controller.abort();
  await expect(runFreshInventoryPolicyEvaluation(freshSettings, { loadRuntime, signal: controller.signal })).rejects.toThrow();
  await expect(runFreshInventoryPolicyEvaluation({ ...freshSettings, folds: 0 }, { loadRuntime })).rejects.toThrow('requires_folds');
  expect(loadRuntime).not.toHaveBeenCalled();
});

test.each(['drift', 'read_error'])('a %s after inference retains actual cost but invalidates the run', async kind => {
  const { source, runtime } = freshFixture();
  runtime.repository.read.mockReset().mockResolvedValueOnce(source).mockResolvedValueOnce(source);
  if (kind === 'drift') runtime.repository.read.mockResolvedValue({ ...source, fingerprint: 'changed' });
  else runtime.repository.read.mockRejectedValue(new Error('Private database error'));
  const report = await runFreshInventoryPolicyEvaluation(freshSettings, { loadRuntime: async () => runtime, prepareCase: admittedCase });
  expect(report).toMatchObject({ status: 'invalidated', sourceVerified: false, calls: 12, finishedGenerations: 12,
    verificationFailure: kind === 'drift' ? 'source_changed' : 'snapshot_verification_failed' });
  expect(JSON.stringify(report)).not.toContain('Private');
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test('periodic recheck failure stops after 25 actual calls without spending the remaining budget', async () => {
  const { source, runtime, client } = freshFixture();
  runtime.repository.read.mockReset().mockResolvedValueOnce(source).mockResolvedValueOnce(source)
    .mockResolvedValue({ ...source, fingerprint: 'changed' });
  const report = await runFreshInventoryPolicyEvaluation({ ...freshSettings, size: 30, generateCases: 30 }, {
    loadRuntime: async () => runtime, prepareCase: admittedCase });
  expect(report).toMatchObject({ status: 'invalidated', calls: 25, finishedGenerations: 25, verificationFailure: 'source_changed' });
  expect(client.generate).toHaveBeenCalledTimes(25);
  expect(runtime.repository.read).toHaveBeenCalledTimes(3);
});

test('background metadata refresh preserves the frozen evaluation but explicitly marks live-source freshness', async () => {
  const { source, runtime } = freshFixture();
  const refreshed = structuredClone(source);
  refreshed.evaluationRows[0].genres = ['Refreshed genre'];
  refreshed.candidateMetadata.get('movie:1').genres = ['refreshed genre'];
  refreshed.fingerprint = fingerprintFreshPolicySnapshot(refreshed);
  runtime.repository.read.mockReset().mockResolvedValueOnce(source).mockResolvedValueOnce(source).mockResolvedValue(refreshed);
  const report = await runFreshInventoryPolicyEvaluation({ ...freshSettings, size: 30, generateCases: 30 }, {
    loadRuntime: async () => runtime, prepareCase: admittedCase });
  expect(report).toMatchObject({ status: 'complete', calls: 30, sourceVerified: false, evaluationSnapshotValid: true,
    liveMetadataRefreshed: true, snapshotScope: 'frozen_at_start', changedComponents: ['metadata', 'observedTraits'] });
  expect(source.evaluationRows[0].genres).toEqual(['Genre 0']);
});

test('metadata refresh during baseline preparation is also a frozen experiment, not current live evidence', async () => {
  const { source, runtime } = freshFixture(), refreshed = structuredClone(source);
  refreshed.candidateMetadata.get('movie:1').genres = ['refreshed'];
  refreshed.fingerprint = fingerprintFreshPolicySnapshot(refreshed);
  runtime.repository.read.mockReset().mockResolvedValueOnce(source).mockResolvedValue(refreshed);
  const report = await runFreshInventoryPolicyEvaluation(freshSettings, { loadRuntime: async () => runtime, prepareCase: admittedCase });
  expect(report).toMatchObject({ status: 'complete', calls: 12, sourceVerified: false, evaluationSnapshotValid: true,
    liveMetadataRefreshed: true, snapshotScope: 'frozen_at_start', changedComponents: ['metadata'],
    matchCalibration: { sampled: 12, livePromotionAllowed: false }, liveRoutingChanged: false });
});

test.each(['configuration', 'policies', 'libraries', 'vectors', 'documents'])('pre-generation %s drift still prevents all inference', async kind => {
  const { source, runtime, client } = freshFixture(), changed = structuredClone(source);
  if (kind === 'configuration') changed.config.configuration_revision = 2;
  if (kind === 'policies') changed.policies[0].prompt_threshold = 61;
  if (kind === 'libraries') changed.libraries[0].is_active = false;
  if (kind === 'vectors') changed.vectors.set([...changed.vectors.keys()][0], [0, 1]);
  if (kind === 'documents') changed.corpus.documents[0].libraryIds = [2];
  changed.fingerprint = fingerprintFreshPolicySnapshot(changed);
  runtime.repository.read.mockReset().mockResolvedValueOnce(source).mockResolvedValue(changed);
  await expect(runFreshInventoryPolicyEvaluation(freshSettings, { loadRuntime: async () => runtime, prepareCase: admittedCase }))
    .rejects.toThrow('source_changed');
  expect(client.generate).not.toHaveBeenCalled();
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test.each(['configuration', 'policies', 'libraries', 'vectors', 'documents'])('meaningful %s drift still invalidates rather than relaxing authority', async kind => {
  const { source, runtime } = freshFixture(), changed = structuredClone(source);
  if (kind === 'configuration') changed.config.configuration_revision = 2;
  if (kind === 'policies') changed.policies[0].prompt_threshold = 61;
  if (kind === 'libraries') changed.libraries[0].is_active = false;
  if (kind === 'vectors') changed.vectors.set([...changed.vectors.keys()][0], [0, 1]);
  if (kind === 'documents') changed.corpus.documents[0].libraryIds = [2];
  changed.fingerprint = fingerprintFreshPolicySnapshot(changed);
  runtime.repository.read.mockReset().mockResolvedValueOnce(source).mockResolvedValueOnce(source).mockResolvedValue(changed);
  const report = await runFreshInventoryPolicyEvaluation(freshSettings, { loadRuntime: async () => runtime, prepareCase: admittedCase });
  expect(report).toMatchObject({ status: 'invalidated', evaluationSnapshotValid: false, verificationFailure: 'source_changed' });
  expect(report.changedComponents).toContain(kind);
});

test('CLI fresh mode is exclusive and bounded before runtime access', async () => {
  const { runtime } = freshFixture(), loadFreshRuntime = jest.fn(async () => runtime), loadRuntime = jest.fn();
  const argv = ['--fresh-policy-evaluation', '--seed', freshSettings.seed, '--folds', '3', '--size', '12'];
  expect(await runInventoryDescriptionBenchmark({ argv, loadFreshRuntime, loadRuntime })).toMatchObject({ status: 'preflight', sampled: 12 });
  for (const flag of ['--policy-shortlist-replay', '--learned-profiles', '--metadata-candidates', '--selective-recheck', '--content-first-comparison', '--preserve-description-candidate', '--investigate', '--contrastive-investigation']) {
    await expect(runInventoryDescriptionBenchmark({ argv: [...argv, flag], loadFreshRuntime, loadRuntime })).rejects.toThrow();
  }
  expect(loadFreshRuntime).toHaveBeenCalledTimes(1);
  expect(loadRuntime).not.toHaveBeenCalled();
});
