/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { createInventoryDescriptionRetrieval, runExclusiveInventoryDescriptionRetrieval } from '../../services/inventoryDescriptionRetrieval.mjs';
import { buildInventorySemanticSampleReport } from '../../services/inventorySemanticSampleReport.mjs';

function row(id, libraryId, text = `description ${id}`, type = 'movie') {
  return { tmdb_id: id, media_type: type, library_id: libraryId, overview: text };
}
function item(id, type = 'movie') { return { stratum: 'ordinary', metadata: { media_type: type, tmdb_id: id, overview: 'PRIVATE previous synopsis' } }; }
function setup() {
  const rows = [row(1, 10), row(200, 10), row(300, 20), row(100, 20), row(101, 20), row(102, 20)];
  const cases = [{ item: item(1), hasStoredEmbedding: true, libraries: [
    { id: 10, name: 'PRIVATE A', observedMembership: true, neighbors: [{ item: item(200), similarity: 0.9 }] },
    { id: 20, name: 'PRIVATE B', neighbors: [{ item: item(300), similarity: 0.3 }] },
  ] }];
  const sampler = { sample: jest.fn(async () => ({ cases, corpus: prepareInventoryDescriptionCorpus(rows),
    report: buildInventorySemanticSampleReport(cases, { requested: cases.length, libraryCount: 2 }) })) };
  const saved = new Map();
  const cache = {
    read: jest.fn(async (identity, hashes) => new Map(hashes.flatMap(hash => {
      const vector = saved.get(`${identity.digest}:${hash}`);
      return vector ? [[hash, vector]] : [];
    }))),
    write: jest.fn(async (identity, entries) => { entries.forEach(({ hash, vector }) => saved.set(`${identity.digest}:${hash}`, vector)); }),
    pruneExpired: jest.fn(async () => 0),
  };
  const identity = { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 };
  const embedder = { provider: identity.provider, model: identity.model, inspect: jest.fn(async () => ({ ...identity })),
    embedBatch: jest.fn(async texts => texts.map(text => text === 'description 200' ? [0.6, 0.8] : text === 'description 300' ? [0, 1] : [1, 0])),
  };
  return { rows, cases, sampler, saved, cache, embedder, identity, retrieval: createInventoryDescriptionRetrieval({ sampler, cache, embedder }) };
}

test('retrieves previously absent neighbors across the inventory without reusing historical labels', async () => {
  const { retrieval, cache, sampler, embedder } = setup();
  const report = await retrieval.run();
  expect(report).toMatchObject({ status: 'complete', embeddedDescriptions: 6, cacheHits: 0,
    comparison: { compared: 1, changedWinners: 1, overlappingNeighbors: 1, accuracy: null } });
  expect(report.comparison.currentDescriptionFixedNeighbors.observedAgreement).toBe(1);
  expect(report.comparison.currentDescriptionFullInventory.observedDisagreement).toBe(1);
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|description 1|tmdb_id|library_id|description_hash/);
  expect(embedder.embedBatch.mock.calls[0][0]).toEqual(expect.arrayContaining(['description 1', 'description 100']));
  expect(sampler.sample.mock.invocationCallOrder[0]).toBeLessThan(embedder.inspect.mock.invocationCallOrder[0]);
  expect(cache.write.mock.invocationCallOrder[0]).toBeGreaterThan(embedder.inspect.mock.invocationCallOrder[1]);
});

test('warm runs reuse all vectors and changed descriptions embed only new content', async () => {
  const { retrieval, rows, embedder } = setup();
  await retrieval.run();
  embedder.embedBatch.mockClear();
  expect(await retrieval.run()).toMatchObject({ status: 'complete', cacheHits: 6, embeddedDescriptions: 0 });
  expect(embedder.embedBatch).not.toHaveBeenCalled();
  rows[0].overview = 'Updated current description';
  expect(await retrieval.run()).toMatchObject({ cacheHits: 5, embeddedDescriptions: 1 });
});

test('canonicalizes float32 coordinates for cold/warm parity and marks unqueried outcomes unknown', async () => {
  const { retrieval, embedder, cache } = setup();
  embedder.embedBatch.mockImplementation(async texts => texts.map(() => [0.123456789, 1]));
  const cold = await retrieval.run();
  expect(cache.write.mock.calls[0][1][0].vector[0]).toBe(Math.fround(0.123456789));
  const warm = await retrieval.run();
  expect(warm.comparison).toEqual(cold.comparison);
  expect(warm.comparison.currentDescriptionFullInventory.neighborsWithAuthorizedOutcome).toBeNull();
});

test('partial builds resume without presenting incomplete retrieval results', async () => {
  const { retrieval, embedder } = setup();
  const first = await retrieval.run({}, { maxNewDescriptions: 2 });
  expect(first).toMatchObject({ status: 'warming_cache', embeddedDescriptions: 2, remainingDescriptions: 4 });
  expect(first.comparison).toBeUndefined();
  expect(await retrieval.run()).toMatchObject({ status: 'complete', cacheHits: 2, embeddedDescriptions: 4 });
  expect(embedder.embedBatch.mock.calls.map(call => call[0].length)).toEqual([2, 4]);
});

test('removing inventory identities excludes their old cached vectors from candidates', async () => {
  const { retrieval, rows } = setup();
  await retrieval.run();
  rows.splice(3, 3);
  const report = await retrieval.run();
  expect(report.cacheHits).toBe(3);
  expect(report.comparison.currentDescriptionFullInventory.neighbors).toBe(2);
  expect(report.comparison.currentDescriptionFullInventory.observedAgreement).toBe(1);
});

test('holds out the whole query cohort and filters media types before top-k', async () => {
  const { retrieval, rows, cases } = setup();
  rows.push(row(2, 20), row(1, 20, 'TV description', 'tv'));
  cases.push({ ...cases[0], item: item(2) });
  const report = await retrieval.run();
  expect(report.comparison.currentDescriptionFullInventory.neighbors).toBe(8);
  expect(report.comparison.compared).toBe(2);
});

test('fails before writing the current batch when the model changes or vectors are invalid', async () => {
  const { retrieval, embedder, cache, identity } = setup();
  embedder.inspect.mockResolvedValueOnce(identity).mockResolvedValue({ ...identity, digest: 'b'.repeat(64) });
  await expect(retrieval.run()).rejects.toThrow('inventory_description_model_changed');
  expect(cache.write).not.toHaveBeenCalled();
  embedder.inspect.mockResolvedValue(identity);
  embedder.embedBatch.mockResolvedValue([[0, 0]]);
  await expect(retrieval.run()).rejects.toThrow();
  expect(cache.write).not.toHaveBeenCalled();
});

test('retains verified earlier batches when a later inference fails', async () => {
  const { retrieval, rows, embedder, saved } = setup();
  rows.push(...Array.from({ length: 4 }, (_, index) => row(400 + index, 20)));
  embedder.embedBatch.mockResolvedValueOnce(Array.from({ length: 8 }, () => [1, 0])).mockRejectedValueOnce(new Error('offline'));
  await expect(retrieval.run()).rejects.toThrow('offline');
  expect(saved.size).toBe(8);
  expect(await retrieval.run()).toMatchObject({ status: 'complete', cacheHits: 8, embeddedDescriptions: 2 });
});

test('different model digests miss the old representation cache', async () => {
  const { retrieval, identity } = setup();
  await retrieval.run();
  identity.digest = 'b'.repeat(64);
  expect(await retrieval.run()).toMatchObject({ embeddedDescriptions: 6, cacheHits: 0 });
});

test('missing descriptions stay explicit and empty corpora do not invoke inference', async () => {
  const { retrieval, rows, embedder } = setup();
  rows[0].overview = '';
  expect(await retrieval.run()).toMatchObject({ status: 'no_comparable_queries', comparison: { missingQueryDescriptions: 1 } });
  rows.forEach(entry => { entry.overview = ''; });
  embedder.inspect.mockClear();
  expect(await retrieval.run()).toMatchObject({ status: 'empty_corpus' });
  expect(embedder.inspect).not.toHaveBeenCalled();
});

test('reports ties and rejects cohort leaks rather than manufacturing a winner', async () => {
  const { retrieval, embedder, cases } = setup();
  embedder.embedBatch.mockImplementation(async texts => texts.map(() => [1, 0]));
  expect((await retrieval.run()).comparison.currentDescriptionFullInventory.tiedComparisons).toBe(1);
  cases[0].libraries[0].neighbors[0].item = item(1);
  await expect(retrieval.run()).rejects.toThrow('inventory_description_cohort_leak');
});

test('honors invalid budgets and pre-existing cancellation before inventory reads', async () => {
  const { retrieval, sampler } = setup();
  await expect(retrieval.run({}, { maxNewDescriptions: 10001 })).rejects.toThrow('inventory_description_budget_invalid');
  await expect(retrieval.run({}, { signal: AbortSignal.abort() })).rejects.toThrow();
  expect(sampler.sample).not.toHaveBeenCalled();
});

test('deduplicates memberships and excludes conflicting descriptions', () => {
  const corpus = prepareInventoryDescriptionCorpus([row(1, 10), row(1, 10), row(1, 20), row(2, 10, ''), row(3, 10, 'first'), row(3, 20, 'second')]);
  expect(corpus.coverage).toMatchObject({ identities: 3, eligibleIdentities: 1, conflictingDescriptions: 1, missingDescriptions: 1, uniqueDescriptions: 1 });
  expect(corpus.documents[0].libraryIds).toEqual([10, 20]);
  expect(() => prepareInventoryDescriptionCorpus(Array(50001).fill(row(1, 10)))).toThrow('corpus_limit');
  expect(() => prepareInventoryDescriptionCorpus([row(-1, 10)])).toThrow('identity_invalid');
});

test('exclusive wrapper prevents duplicate builds and preserves success/failure results', async () => {
  const retrieval = { run: jest.fn(async () => ({ status: 'complete' })) };
  expect(await runExclusiveInventoryDescriptionRetrieval({ retrieval, withSessionAdvisoryLock: async () => false }, {}, {}))
    .toMatchObject({ status: 'already_running' });
  expect(retrieval.run).not.toHaveBeenCalled();
  const withSessionAdvisoryLock = async (key, fn) => { expect(key).toBe(0x49445247); await fn(); return true; };
  expect(await runExclusiveInventoryDescriptionRetrieval({ retrieval, withSessionAdvisoryLock }, {}, {})).toEqual({ status: 'complete' });
  retrieval.run.mockRejectedValue(new Error('offline'));
  await expect(runExclusiveInventoryDescriptionRetrieval({ retrieval, withSessionAdvisoryLock }, {}, {})).rejects.toThrow('offline');
});
