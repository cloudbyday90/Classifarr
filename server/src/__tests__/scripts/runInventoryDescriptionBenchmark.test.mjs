/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { runInventoryDescriptionBenchmark } from '../../scripts/runInventoryDescriptionBenchmark.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';

const seed = 'benchmark-test-seed-2026';

test('contrastive mode uses grouped snapshots without calling the model during preflight', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10', '--folds', '5', '--contrastive-investigation'], loadRuntime: async () => instance });
  expect(report).toMatchObject({ status: 'preflight', protocol: 'contrastive_library_investigation_v1', calls: 0 });
  expect(instance.createClient).not.toHaveBeenCalled();
  const loadRuntime = jest.fn();
  for (const argv of [['--seed', seed, '--contrastive-investigation'],
    ['--seed', seed, '--folds', '5', '--contrastive-investigation', '--investigate']]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow('requires_folds_and_exclusive_mode');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
});

test('CLI grouped mode excludes successive cohorts only from test selection and keeps training coverage', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '5', '--exclude-prior-sizes', '5,5', '--folds', '5', '--learned-profiles'],
    loadRuntime: async () => instance });
  expect(report).toMatchObject({ excludedPriorDescriptions: 10, sampledTitles: 5,
    evaluation: { folds: 5, priorCohortSizes: [5, 5], previousSampleOverlap: 0, priorItemsAvailableForTraining: true } });
  expect(report.profileLearning.folds.every(fold => fold.missingOrConflictingMetadata === 19)).toBe(true);
  expect(instance.createClient).not.toHaveBeenCalled();
});

test('CLI can exclude a previous seeded sample before selection and training', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '5', '--exclude-prior-size', '10', '--learned-profiles'],
    loadRuntime: async () => instance });
  expect(report).toMatchObject({ excludedPriorDescriptions: 10, sampledTitles: 5, profileLearning: { missingOrConflictingMetadata: 5 } });
  expect(instance.createClient).not.toHaveBeenCalled();
});

test('learned profiles train automatically without names or declarations and report only coverage', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10', '--learned-profiles'], loadRuntime: async () => instance });
  expect(report.profileLearning).toMatchObject({ version: 'contrastive_profile_v1', trainingDescriptions: 0, missingOrConflictingMetadata: 10 });
  expect(report.metadataSelection.version).toBe('contrastive_profile_v1');
  expect(JSON.stringify(report)).not.toMatch(/Private|counts|studio|rating/);
  const loadRuntime = jest.fn();
  await expect(runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--learned-profiles', '--metadata-candidates'], loadRuntime })).rejects.toThrow('mode_conflict');
  expect(loadRuntime).not.toHaveBeenCalled();
});

test('metadata selection is explicit and reports aggregate coverage without exposing observations', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10', '--metadata-candidates'], loadRuntime: async () => instance });
  expect(report.metadataSelection).toMatchObject({ version: 'metadata_rrf_v1', missingQueryMetadata: 10, changedShortlists: 0 });
  expect(JSON.stringify(report)).not.toMatch(/Private|genres|studio|rating/);
  expect(instance.createClient).not.toHaveBeenCalled();
});
function runtime() {
  const identity = { provider: 'ollama', model: 'local:latest', digest: 'a'.repeat(64), dimensions: 2 };
  const corpus = prepareInventoryDescriptionCorpus(Array.from({ length: 20 }, (_, index) => ({ tmdb_id: index + 1,
    media_type: 'movie', library_id: index % 2 + 1, overview: `Private text ${index}` })));
  const snapshot = { corpus, vectors: new Map([...corpus.texts.keys()].map(hash => [hash, [1, 0]])),
    libraries: [1, 2].map(id => ({ id, name: `Private library ${id}`, media_type: 'movie' })) };
  const client = { inspect: jest.fn(async () => ({ model: 'local:latest', digest: 'b'.repeat(64), contextLength: 32768 })),
    generate: jest.fn(async () => ({ response: '{"candidate":1}', latencyMs: 1, promptTokens: 100, outputTokens: 5 })) };
  return { embedder: { ...identity, inspect: jest.fn(async () => identity) }, repository: { read: jest.fn(async () => snapshot) },
    createClient: jest.fn(() => client), close: jest.fn(), client };
}

test('preflight loads one snapshot, verifies representation, closes, and never generates', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10'], loadRuntime: async () => instance });
  expect(report).toMatchObject({ status: 'preflight', sampledTitles: 10, embedding: { dimensions: 2 } });
  expect(instance.embedder.inspect).toHaveBeenCalledTimes(2);
  expect(instance.repository.read).toHaveBeenCalledTimes(1);
  expect(instance.createClient).not.toHaveBeenCalled();
  expect(instance.close).toHaveBeenCalledTimes(1);
});

test('generation is explicit and separate from sampled/held-out title count', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10', '--generate-cases', '2', '--context', '16384', '--max-minutes', '1'],
    loadRuntime: async () => instance });
  expect(report).toMatchObject({ status: 'complete', sampledTitles: 10, requestedGenerationCases: 2, generation: { context: 16384 } });
  expect(instance.client.generate).toHaveBeenCalledTimes(6);
  expect(instance.close).toHaveBeenCalledTimes(1);
});

test('rejects malformed/unknown arguments before loading configuration', async () => {
  const loadRuntime = jest.fn();
  for (const argv of [[], ['--seed', seed, '--size', '301'], ['--seed', seed, '--context', 'NaN'], ['--seed', seed, '--url', 'https://example.com'],
    ['--seed', seed, '--folds', '1'], ['--seed', seed, '--exclude-prior-sizes', '100,,200'],
    ['--seed', seed, '--exclude-prior-size', '100', '--exclude-prior-sizes', '200']]) {
    await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
});

test('investigation is opt-in, runs after benchmark arms, and keeps private evidence out of output', async () => {
  const instance = runtime();
  const report = await runInventoryDescriptionBenchmark({ argv: ['--seed', seed, '--size', '10', '--generate-cases', '2', '--investigate'], loadRuntime: async () => instance });
  expect(report.investigation).toMatchObject({ comparisonsNotRun: 8, verifiedLabelsCreated: 0, userQuestionsCreated: 0 });
  expect(report.arms.every(arm => arm.finished === 2)).toBe(true);
  expect(JSON.stringify(report)).not.toContain('Private');
});

test('snapshot failures and model replacement close the runtime and do not send query text', async () => {
  const instance = runtime();
  instance.repository.read.mockRejectedValueOnce(new Error('private failure'));
  await expect(runInventoryDescriptionBenchmark({ argv: ['--seed', seed], loadRuntime: async () => instance })).rejects.toThrow();
  instance.embedder.inspect.mockResolvedValueOnce({ ...instance.embedder, digest: 'a'.repeat(64) })
    .mockResolvedValueOnce({ ...instance.embedder, digest: 'b'.repeat(64) });
  await expect(runInventoryDescriptionBenchmark({ argv: ['--seed', seed], loadRuntime: async () => instance })).rejects.toThrow('model_changed');
  expect(instance.close).toHaveBeenCalledTimes(2);
  expect(instance.createClient).not.toHaveBeenCalled();
});
