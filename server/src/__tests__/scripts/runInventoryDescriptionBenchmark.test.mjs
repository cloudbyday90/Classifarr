/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { runInventoryDescriptionBenchmark } from '../../scripts/runInventoryDescriptionBenchmark.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';

const seed = 'benchmark-test-seed-2026';

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
  for (const argv of [[], ['--seed', seed, '--size', '101'], ['--seed', seed, '--context', 'NaN'], ['--seed', seed, '--url', 'https://example.com']]) {
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
