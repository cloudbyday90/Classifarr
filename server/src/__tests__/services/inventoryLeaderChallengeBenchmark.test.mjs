/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { freshFixture, freshSettings } from '../fixtures/freshInventoryPolicyFixture.mjs';
import { fingerprintFreshPolicySnapshot } from '../../services/freshInventoryPolicyRuntime.mjs';
import { runInventoryLeaderChallengeBenchmark } from '../../services/inventoryLeaderChallengeBenchmark.mjs';
import { prepareLeaderChallengeEvidence } from '../../services/inventoryLeaderChallengeEvidence.mjs';
import { DiscoveryDeferredError } from '../../services/inventoryDiscoveryAdmission.mjs';
import { runInventoryDescriptionBenchmark } from '../../scripts/runInventoryDescriptionBenchmark.mjs';
import { createFreshInventoryPolicyEvidence } from '../../services/freshInventoryPolicyEvidence.mjs';

const settings = { ...freshSettings, generateCases: 0 };
function fixture() {
  const value = freshFixture();
  value.source.trainingExclusions = new Set(['movie:1']);
  value.source.fingerprint = fingerprintFreshPolicySnapshot(value.source);
  value.runtime.withDiscoveryAdmission = jest.fn(async (callback, { signal }) => callback(signal, () => signal.throwIfAborted()));
  return value;
}

test('compares fresh production policy results across both media without inference, writes or identity output', async () => {
  const { runtime, source, client } = fixture(), before = structuredClone(source), loadRuntime = jest.fn(async () => runtime);
  const onProgress = jest.fn();
  const report = await runInventoryLeaderChallengeBenchmark(settings, { loadRuntime, onProgress });
  expect(report).toMatchObject({ protocol: 'inventory_leader_challenge_v1', status: 'complete', sourceVerified: true,
    calls: 0, sampleShortfall: 0, liveRoutingChanged: false, livePromotionAllowed: false, accuracy: null,
    comparison: { sampled: 12, compared: 12, poolSizes: { 3: 12 } } });
  expect(report.comparison.byMedia.every(row => row.sampled > 0)).toBe(true);
  expect(report.comparison.byLibrary).toHaveLength(6);
  expect(loadRuntime).toHaveBeenCalledWith({ includeTrainingProvenance: true });
  expect(runtime.withDiscoveryAdmission).toHaveBeenCalledTimes(1);
  expect(runtime.repository.read).toHaveBeenCalledTimes(2);
  expect(runtime.createClient).not.toHaveBeenCalled();
  expect(client.generate).not.toHaveBeenCalled();
  expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(onProgress).toHaveBeenCalledTimes(12);
  expect(source).toEqual(before);
  expect(JSON.stringify(report)).not.toMatch(/Private|candidateOrder|challengerId|movie:1|localhost/);
});

test('canonical, provenance-clean fold evidence excludes retained decisions and all held copies for policy and content', async () => {
  const { source } = fixture();
  const prepared = await prepareLeaderChallengeEvidence(source, 2, settings);
  for (const doc of prepared.sample) {
    const entry = await prepared.forDocument(doc), runtime = prepared.evidence.forCase(entry);
    const contract = { valid: true, candidates: source.libraries.filter(library => library.media_type === doc.type)
      .map(library => ({ libraryId: library.id, mediaType: doc.type })) };
    const retrieved = await runtime.retrieve({ contract });
    for (const candidate of retrieved.candidates) {
      for (const item of candidate.items) {
        expect(item.description).not.toBe(source.corpus.texts.get(doc.hash));
        expect(item.description).not.toBe(source.corpus.texts.get(source.corpus.documents.find(row => row.key === 'movie:1').hash));
      }
    }
    expect(prepared.training[entry.foldIndex].retainedHistory).toBe(doc.key === 'movie:1' ||
      entry.heldDescriptionHashes.has(source.corpus.documents.find(row => row.key === 'movie:1').hash) ? 0 : 1);
  }
});

test('an explicitly missing training fold cannot silently fall back to the unfiltered corpus', async () => {
  const { source } = fixture(), prepared = await prepareLeaderChallengeEvidence(source, 2, settings);
  const entry = await prepared.forDocument(prepared.sample[0]);
  const evidence = createFreshInventoryPolicyEvidence(source, { texts: source.corpus.texts }, { trainingByFold: new Map() });
  expect(() => evidence.forCase(entry)).toThrow('training_fold_missing');
});

test.each(['provenance', 'policies', 'metadata', 'vectors', 'configuration'])('%s drift invalidates rather than promoting stale results', async field => {
  const { source, runtime } = fixture(), changed = structuredClone(source);
  if (field === 'provenance') changed.trainingExclusions.add('movie:2');
  if (field === 'policies') changed.policies[0].prompt_threshold = 61;
  if (field === 'metadata') changed.candidateMetadata.get('movie:1').genres = ['changed'];
  if (field === 'vectors') changed.vectors.set([...changed.vectors.keys()][0], [0, 1]);
  if (field === 'configuration') changed.config.configuration_revision = 2;
  changed.fingerprint = fingerprintFreshPolicySnapshot(changed);
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValue(changed);
  const report = await runInventoryLeaderChallengeBenchmark(settings, { loadRuntime: async () => runtime });
  expect(report).toMatchObject({ status: 'invalidated', sourceVerified: false, livePromotionAllowed: false });
  expect(report.changedComponents).toContain(field);
});

test.each(['busy', 'memory_pressure', 'memory_unknown'])('%s defers without work and closes runtime', async reason => {
  const { runtime } = fixture();
  runtime.withDiscoveryAdmission.mockRejectedValue(new DiscoveryDeferredError(reason));
  expect(await runInventoryLeaderChallengeBenchmark(settings, { loadRuntime: async () => runtime }))
    .toMatchObject({ status: 'deferred', reason, sourceVerified: false, calls: 0 });
  expect(runtime.repository.read).not.toHaveBeenCalled();
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test.each(['missing_provenance', 'configuration', 'disabled', 'snapshot_read', 'metadata', 'cancelled'])('handles %s without unsafe fallback', async kind => {
  const { source, runtime } = fixture(), controller = new AbortController();
  if (kind === 'missing_provenance') delete source.trainingExclusions;
  if (kind === 'configuration') runtime.config = { ...source.config, configuration_revision: 2 };
  if (kind === 'disabled') source.config.rag_enabled = false;
  if (kind === 'snapshot_read') runtime.repository.read.mockRejectedValue(new Error('private database error'));
  if (kind === 'metadata') source.evaluationRows.forEach(row => row.title = '');
  const run = runInventoryLeaderChallengeBenchmark(settings, { loadRuntime: async () => runtime, signal: controller.signal,
    onProgress: () => { if (kind === 'cancelled') controller.abort(); } });
  if (kind === 'metadata') expect(await run).toMatchObject({ status: 'completed_with_errors', comparison: { compared: 0, sampled: 12 } });
  else await expect(run).rejects.toThrow();
  expect(runtime.createClient).not.toHaveBeenCalled();
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test('invalid options and initial cancellation never open a runtime; CLI rejects unrelated modes', async () => {
  const loadRuntime = jest.fn(), controller = new AbortController(); controller.abort();
  await expect(runInventoryLeaderChallengeBenchmark(settings, { loadRuntime, signal: controller.signal })).rejects.toThrow();
  await expect(runInventoryLeaderChallengeBenchmark({ ...settings, folds: 0 }, { loadRuntime })).rejects.toThrow();
  await expect(runInventoryLeaderChallengeBenchmark(freshSettings, { loadRuntime })).rejects.toThrow();
  const argv = ['--seed', settings.seed, '--size', '12', '--folds', '3', '--leader-challenge'];
  for (const flag of ['--linear-ranker', '--fresh-policy-evaluation', '--policy-shortlist-replay', '--investigate']) {
    await expect(runInventoryDescriptionBenchmark({ argv: [...argv, flag], loadFreshRuntime: loadRuntime })).rejects.toThrow('exclusive');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const { runtime } = fixture();
  expect(await runInventoryDescriptionBenchmark({ argv, loadFreshRuntime: async () => runtime })).toMatchObject({ status: 'complete' });
});
