/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { freshFixture, freshSettings } from '../fixtures/freshInventoryPolicyFixture.mjs';
import { runFreshInventoryPolicyEvaluation } from '../../services/freshInventoryPolicyEvaluation.mjs';
import { fingerprintFreshPolicySnapshot } from '../../services/freshInventoryPolicyRuntime.mjs';
import { preparePolicyShortlistReplayCase } from '../../services/policyShortlistReplayCase.mjs';
import { runInventoryDescriptionBenchmark } from '../../scripts/runInventoryDescriptionBenchmark.mjs';

const settings = { ...freshSettings, size: 150, folds: 5, generateCases: 2 };
function fixture() {
  const value = freshFixture(480);
  for (const doc of value.source.corpus.documents) {
    const index = Math.floor((doc.id - 1) / 6), library = (doc.libraryIds[0] - 1) % 3;
    const angle = index === 79 ? ((library + 1) % 3) + .10 : library + index * .003;
    value.source.vectors.set(doc.hash, [Math.cos(angle), Math.sin(angle)]);
  }
  value.source.fingerprint = fingerprintFreshPolicySnapshot(value.source);
  return value;
}

async function admittedCase(sample, source, evidence, signal) {
  const runtime = evidence.forCase(sample);
  const policyResult = { action: 'manual', confidence: 45, ranked: source.libraries
    .filter(library => library.media_type === sample.mediaType).map(library => ({ library_id: library.id,
      score: 45, auto_classify_threshold: 85, prompt_threshold: 60 })) };
  const replay = await preparePolicyShortlistReplayCase({ metadata: runtime.metadata, policyResult }, source, runtime, signal);
  return { ...replay, mode: 'adjudicate', modeReason: 'manual_candidate_adjudication_ready', policyResult,
    reviewPolicies: source.policies, missingMetadata: [] };
}

test('real grouped calibration selects targets before the generation cap and reuses a response for both assessments', async () => {
  const { runtime, client } = fixture();
  const report = await runFreshInventoryPolicyEvaluation(settings, { loadRuntime: async () => runtime,
    prepareCase: admittedCase, neighborFallback: true });
  expect(report.neighborFallback.selected).toBeGreaterThan(2);
  expect(report).toMatchObject({ protocol: 'fresh_inventory_neighbor_fallback_v1', status: 'complete', calls: 2,
    neighborFallback: { generationsFinished: 2, evaluated: 2, strictLost: 0, livePromotionAllowed: false },
    liveRoutingChanged: false, routingReceiptsCreated: 0 });
  expect(client.generate).toHaveBeenCalledTimes(2);
  expect(report.media.map(row => row.neighborFallback.sampled)).toEqual([75, 75]);
  expect(report.libraries).toHaveLength(6);
  expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(report)).not.toMatch(/Private|libraryId|destinationId|descriptionHash|observedLibraryIds/);
});

test('preflight and missing targets do not create a client or fabricate assessments', async () => {
  const { runtime } = fixture();
  const report = await runFreshInventoryPolicyEvaluation({ ...settings, generateCases: 0 }, {
    loadRuntime: async () => runtime, neighborFallback: true, prepareCase: admittedCase });
  expect(report.neighborFallback.selected).toBeGreaterThan(2);
  expect(report.neighborFallback.evaluated).toBe(0);
  expect(runtime.createClient).not.toHaveBeenCalled();
  const sparse = freshFixture();
  const empty = await runFreshInventoryPolicyEvaluation(settings, { loadRuntime: async () => sparse.runtime, neighborFallback: true });
  expect(empty).toMatchObject({ calls: 0, neighborFallback: { selected: 0, evaluated: 0 } });
  expect(sparse.runtime.createClient).not.toHaveBeenCalled();
});

test.each(['cancelled', 'failed', 'drift'])('selected inference handles %s without granting resolution or losing runtime cleanup', async kind => {
  const { runtime, client, source } = fixture(), controller = new AbortController();
  if (kind === 'drift') runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValueOnce(source)
    .mockResolvedValue({ ...source, fingerprint: 'changed' });
  else client.generate.mockImplementation(async ({ onGenerationCall }) => {
    onGenerationCall(); if (kind === 'cancelled') controller.abort(); throw new Error('Private error');
  });
  const report = await runFreshInventoryPolicyEvaluation(settings, { loadRuntime: async () => runtime,
    prepareCase: admittedCase, neighborFallback: true, signal: controller.signal });
  expect(report.status).toBe(kind === 'cancelled' ? 'interrupted' : kind === 'failed' ? 'completed_with_errors' : 'invalidated');
  expect(report.neighborFallback.additionalReviewResolutions).toBe(0);
  expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(report)).not.toContain('Private');
});

test('CLI requires exclusive fresh mode and validates before runtime access', async () => {
  const loadRuntime = jest.fn(), loadFreshRuntime = jest.fn();
  const base = ['--seed', settings.seed, '--size', '30', '--folds', '5', '--neighbor-fallback'];
  for (const flags of [[], ['--neighbor-calibration'], ['--fresh-policy-evaluation', '--neighbor-cross-fit'],
    ['--fresh-policy-evaluation', '--content-first-comparison']]) {
    await expect(runInventoryDescriptionBenchmark({ argv: [...base, ...flags], loadRuntime, loadFreshRuntime })).rejects.toThrow();
  }
  await expect(runFreshInventoryPolicyEvaluation(settings, { loadRuntime, neighborFallback: 'true' })).rejects.toThrow('mode_invalid');
  expect(loadRuntime).not.toHaveBeenCalled(); expect(loadFreshRuntime).not.toHaveBeenCalled();
  const { runtime } = freshFixture();
  const report = await runInventoryDescriptionBenchmark({ argv: [...base, '--fresh-policy-evaluation'],
    loadFreshRuntime: async () => runtime });
  expect(report).toMatchObject({ protocol: 'fresh_inventory_neighbor_fallback_v1', status: 'preflight', calls: 0 });
});
