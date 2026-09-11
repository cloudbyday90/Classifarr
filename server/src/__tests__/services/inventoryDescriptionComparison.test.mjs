/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryDescriptionComparison } from '../../services/inventoryDescriptionComparison.mjs';
import { prepareInventoryDescriptionComparison, projectInventoryDescription } from '../../services/inventoryDescriptionProjection.mjs';
import { buildInventorySemanticSampleReport } from '../../services/inventorySemanticSampleReport.mjs';

const model = 'test:latest';
function item(id, overview) {
  return { stratum: 'documentary', metadata: { media_type: 'movie', tmdb_id: id, title: 'PRIVATE title', library_name: 'PRIVATE label', overview } };
}
function sampleCase(id = 1) {
  return {
    item: item(id, 'query description'), hasStoredEmbedding: true,
    representation: { provider: 'ollama', model, dimensions: 2 },
    libraries: [
      { id: 10, name: 'PRIVATE library A', observedMembership: true, neighbors: [{ item: item(100, 'left description'), similarity: 0.9 }] },
      { id: 20, name: 'PRIVATE library B', observedMembership: false, neighbors: [{ item: item(200, 'right description'), similarity: 0.6 }] },
    ],
  };
}
function runtime(cases = [sampleCase()]) {
  const sampler = { sample: jest.fn(async () => ({
    cases, report: buildInventorySemanticSampleReport(cases, { requested: cases.length, libraryCount: 2 }),
  })) };
  const embedder = {
    provider: 'ollama', model,
    inspect: jest.fn(async () => ({ provider: 'ollama', model, digest: 'a'.repeat(64) })),
    embedBatch: jest.fn(async texts => texts.map(text => text === 'left description' ? [0, 1] : [1, 0])),
  };
  return { sampler, embedder, comparison: createInventoryDescriptionComparison({ sampler, embedder }) };
}

test('compares freshly embedded descriptions on both sides without serializing private inputs', async () => {
  const { comparison, embedder, sampler } = runtime();
  const report = await comparison.compare();
  expect(report).toMatchObject({ sampled: 1, paired: 1, uniqueDescriptions: 3, embeddingBatches: 1, changedWinners: 1, accuracy: null });
  expect(report.pairedStored.observedAgreement).toBe(1);
  expect(report.pairedDescriptionOnly.observedDisagreement).toBe(1);
  expect(report.strata.documentary.changedWinners).toBe(1);
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|query description|left description|right description|tmdb_id/);
  expect(embedder.embedBatch.mock.calls[0][0]).toEqual(['query description', 'left description', 'right description']);
  expect(sampler.sample.mock.invocationCallOrder[0]).toBeLessThan(embedder.inspect.mock.invocationCallOrder[0]);
  expect(embedder.inspect).toHaveBeenCalledTimes(2);
});

test('projects only normalized synopsis text and counts explicit Unicode-safe shortening', () => {
  expect(projectInventoryDescription(item(1, '  a\n\u200bb  '))).toEqual({ text: 'a b', shortened: false });
  expect(projectInventoryDescription(item(1, '😀'.repeat(1001)))).toEqual({ text: '😀'.repeat(1000), shortened: true });
  expect(projectInventoryDescription(item(1, ' \n '))).toBeNull();
  expect(projectInventoryDescription({ metadata: { title: 'not a synopsis' } })).toBeNull();
});

test('deduplicates repeated text before batching and keeps per-case paired denominators', async () => {
  const { comparison, embedder } = runtime([sampleCase(1), sampleCase(2)]);
  const report = await comparison.compare();
  expect(report).toMatchObject({ paired: 2, uniqueDescriptions: 3 });
  expect(embedder.embedBatch).toHaveBeenCalledTimes(1);
});

test('removes missing neighbor descriptions from both comparison conditions', async () => {
  const entry = sampleCase();
  entry.libraries[0].neighbors.push({ item: item(300, ''), similarity: -1 });
  const { comparison } = runtime([entry]);
  const report = await comparison.compare();
  expect(report.excluded.missingNeighborDescriptions).toBe(1);
  expect(report.pairedStored.neighbors).toBe(2);
  expect(report.pairedDescriptionOnly.neighbors).toBe(2);
  expect(report.storedBaseline.summary.neighbors).toBe(3);
});

test.each(['missingQueryDescription', 'incompatibleRepresentation', 'insufficientLibraries'])('reports %s without any inference', async reason => {
  const entry = sampleCase();
  if (reason === 'missingQueryDescription') entry.item.metadata.overview = '';
  if (reason === 'incompatibleRepresentation') entry.representation.model = 'other';
  if (reason === 'insufficientLibraries') entry.libraries[1].neighbors = [];
  const { comparison, embedder } = runtime([entry]);
  const report = await comparison.compare();
  expect(report.status).toBe('no_paired_cases');
  expect(report.excluded[reason]).toBe(1);
  expect(report.sampled).toBe(1);
  expect(embedder.inspect).not.toHaveBeenCalled();
});

test('rejects a full-cohort neighbor leak before invoking the local provider', async () => {
  const entries = [sampleCase(1), sampleCase(2)];
  entries[0].libraries[0].neighbors[0].item = item(2, 'cohort peer');
  const { comparison, embedder } = runtime(entries);
  await expect(comparison.compare()).rejects.toThrow('description_cohort_leak');
  expect(embedder.inspect).not.toHaveBeenCalled();
});

test('rejects duplicate identities, cross-media neighbors and changed dimensions', () => {
  const { embedder } = runtime();
  expect(() => prepareInventoryDescriptionComparison([sampleCase(), sampleCase()], embedder)).toThrow('description_sample_identity_duplicate');
  const entry = sampleCase();
  entry.libraries[0].neighbors[0].item.metadata.media_type = 'tv';
  expect(() => prepareInventoryDescriptionComparison([entry], embedder)).toThrow('description_media_type_mismatch');
  const other = sampleCase(2);
  other.representation.dimensions = 3;
  expect(() => prepareInventoryDescriptionComparison([sampleCase(), other], embedder)).toThrow('description_dimensions_changed');
});

test('rejects over-budget input before inference instead of selecting a smaller cohort', async () => {
  const entry = sampleCase();
  entry.libraries = Array.from({ length: 64 }, (_, lib) => ({
    id: lib + 1, neighbors: Array.from({ length: 3 }, (_, n) => ({ item: item(1000 + lib * 3 + n, `description ${lib} ${n}`), similarity: 0.5 })),
  }));
  const entries = Array.from({ length: 3 }, (_, n) => ({ ...entry, item: item(n + 1, `query ${n}`), libraries: entry.libraries.map(library => ({
    ...library, neighbors: library.neighbors.map(neighbor => ({ ...neighbor, item: item(neighbor.item.metadata.tmdb_id, `${neighbor.item.metadata.overview} ${n}`) })),
  })) }));
  const { comparison, embedder } = runtime(entries);
  await expect(comparison.compare()).rejects.toThrow('description_document_budget_exceeded');
  expect(embedder.inspect).not.toHaveBeenCalled();
});

test.each([[], [[0, 0], [1, 0], [1, 0]], [[1], [1, 0], [1, 0]], [[NaN, 0], [1, 0], [1, 0]]].map(batch => ({ batch })))('rejects invalid embedding batches', async ({ batch }) => {
  const { comparison, embedder } = runtime();
  embedder.embedBatch.mockResolvedValue(batch);
  await expect(comparison.compare()).rejects.toThrow();
});

test('rejects model drift and never returns a partial result after inference failure', async () => {
  const { comparison, embedder } = runtime();
  embedder.inspect.mockResolvedValueOnce({ provider: 'ollama', model, digest: 'a'.repeat(64) })
    .mockResolvedValueOnce({ provider: 'ollama', model, digest: 'b'.repeat(64) });
  await expect(comparison.compare()).rejects.toThrow('description_embedding_model_changed');
  embedder.embedBatch.mockRejectedValue(new Error('unavailable'));
  await expect(comparison.compare()).rejects.toThrow('unavailable');
});

test('reports new ties rather than choosing a winner by library ordering', async () => {
  const { comparison, embedder } = runtime();
  embedder.embedBatch.mockImplementation(async texts => texts.map(() => [1, 0]));
  expect(await comparison.compare()).toMatchObject({ newTies: 1, changedWinners: 0 });
});

test('honors cancellation before collecting private evidence', async () => {
  const { comparison, sampler } = runtime();
  await expect(comparison.compare({}, { signal: AbortSignal.abort() })).rejects.toThrow();
  expect(sampler.sample).not.toHaveBeenCalled();
});
