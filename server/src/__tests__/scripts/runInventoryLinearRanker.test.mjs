/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { runInventoryDescriptionBenchmark } from '../../scripts/runInventoryDescriptionBenchmark.mjs';
import { linearFixture } from '../fixtures/inventoryLinearRankerFixture.mjs';

const argv = ['--seed', 'linear-ranker-cli-2026', '--size', '2', '--folds', '2', '--linear-ranker'];
function runtime(snapshot = linearFixture()) {
  const identity = { provider: 'ollama', model: 'local:latest', digest: 'a'.repeat(64), dimensions: 4 };
  return { embedder: { ...identity, inspect: jest.fn(async () => identity) }, repository: { read: jest.fn(async () => snapshot) },
    withDiscoveryAdmission: jest.fn((callback, { signal }) => callback(signal)), createClient: jest.fn(), close: jest.fn() };
}
test('exclusive zero-generation CLI validates before loading runtime', async () => {
  const loadRuntime = jest.fn();
  for (const invalid of [argv.filter(value => !['--folds', '2'].includes(value)), [...argv, '--generate-cases', '1'],
    ...['--multi-scale-ai', '--independent-fit', '--learned-profiles', '--fresh-policy-evaluation', '--evidence-reranker'].map(flag => [...argv, flag])]) {
    await expect(runInventoryDescriptionBenchmark({ argv: invalid, loadRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
});
test('requests provenance, uses shared admission, verifies snapshot and never creates a generation client', async () => {
  const instance = runtime(), loadRuntime = jest.fn(async () => instance);
  const report = await runInventoryDescriptionBenchmark({ argv, loadRuntime });
  expect(report).toMatchObject({ protocol: 'inventory_linear_ranker_v1', sourceVerified: true, status: 'complete', calls: 0, livePromotionAllowed: false });
  expect(loadRuntime).toHaveBeenCalledWith({ includeTrainingProvenance: true });
  expect(instance.withDiscoveryAdmission).toHaveBeenCalledTimes(1); expect(instance.repository.read).toHaveBeenCalledTimes(2);
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(1);
});
test.each(['provenance', 'metadata', 'vectors', 'documents', 'descriptions', 'libraries'])('invalidates consumed %s drift instead of publishing stale success', async component => {
  const original = linearFixture(), changed = linearFixture();
  if (component === 'provenance') changed.trainingExclusions.add(changed.corpus.documents[0].key);
  if (component === 'metadata') changed.candidateMetadata.set(changed.corpus.documents[0].key, null);
  if (component === 'vectors') changed.vectors.values().next().value[0] += 0.1;
  if (component === 'documents') changed.corpus.documents[0].libraryIds = [2];
  if (component === 'descriptions') changed.corpus.texts.set(changed.corpus.documents[0].hash, 'Changed private text');
  if (component === 'libraries') changed.libraries[0].media_type = 'tv';
  const instance = runtime(original); instance.repository.read.mockResolvedValueOnce(original).mockResolvedValueOnce(changed);
  expect(await runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance }))
    .toMatchObject({ status: 'invalidated', sourceVerified: false, changedSourceComponents: [component] });
  expect(instance.close).toHaveBeenCalledTimes(1);
});
test('missing provenance or source read failures close runtime without fitting/generation fallback', async () => {
  const snapshot = linearFixture(); delete snapshot.trainingExclusions;
  const instance = runtime(snapshot);
  await expect(runInventoryDescriptionBenchmark({ argv, loadRuntime: async () => instance })).rejects.toThrow();
  expect(instance.createClient).not.toHaveBeenCalled(); expect(instance.close).toHaveBeenCalledTimes(1);
});
