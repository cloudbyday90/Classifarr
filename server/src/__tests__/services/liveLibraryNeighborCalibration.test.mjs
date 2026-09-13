/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { expect, jest, test } from '@jest/globals';
import { assessLiveLibraryNeighbors } from '../../services/liveLibraryNeighborCalibration.mjs';
import { createInventoryNeighborCalibration } from '../../services/inventoryNeighborCalibration.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { createLiveInventoryModelCache } from '../../services/liveInventoryModelCache.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
const vector = angle => [Math.cos(angle), Math.sin(angle)];
function fixture(count = 30) {
  const rows = [1, 2].flatMap(library_id => Array.from({ length: count }, (_, i) => ({ library_id,
    tmdb_id: library_id * 1000 + i, media_type: 'movie', overview: `Private synopsis ${library_id}:${i}` })));
  rows.push({ library_id: 1, tmdb_id: 999, media_type: 'movie', overview: 'Private query' });
  const vectors = new Map(rows.map((row, i) => [hash(row.overview), vector((row.library_id - 1) * Math.PI + (i % count) / 100)]));
  vectors.set(hash('Private query'), vector(.12));
  const modelCache = createLiveInventoryModelCache();
  const input = { rows, corpus: prepareInventoryDescriptionCorpus(rows),
    request: { key: 'movie:999', mediaType: 'movie', libraryIds: [1, 2], matchLibraryId: 1, hash: hash('Private query') },
    identity: { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 }, vector: vector(.12),
    modelCache: { get: jest.fn(modelCache.get), set: jest.fn(modelCache.set) },
    query: jest.fn(async (_sql, parameters) => ({ rows: parameters[4].filter(h => vectors.has(h)).map(h => ({
      description_hash: h, embedding: JSON.stringify(vectors.get(h)),
    })) })) };
  return { input, vectors };
}

test('live and grouped kernels agree; warm reads validate vectors before reusing only fitting', async () => {
  const { input, vectors } = fixture();
  const first = await assessLiveLibraryNeighbors(input);
  const offline = await createInventoryNeighborCalibration({ documents: input.corpus.documents,
    libraries: input.request.libraryIds.map(id => ({ id, media_type: 'movie' })), vectors, representation: input.identity },
  { crossFit: true }).assess({ mediaType: 'movie', descriptionHash: input.request.hash,
    itemIdentity: { mediaType: 'movie', tmdbId: 999 }, heldDescriptionHashes: new Set([input.request.hash]) });
  expect(first.candidates).toEqual(offline.candidates);
  expect(first.candidates[0]).toMatchObject({ status: 'available', calibrated: true, referenceDescriptions: 30, minimumCalibrationReferences: 29 });
  expect(await assessLiveLibraryNeighbors(input)).toEqual(first);
  expect(input.query).toHaveBeenCalledTimes(2); expect(input.modelCache.set).toHaveBeenCalledTimes(1);
  input.vector = vector(Math.PI + .12);
  const different = await assessLiveLibraryNeighbors(input);
  expect(different.snapshotId).not.toBe(first.snapshotId);
  expect(different.candidates[1].calibrated).toBe(true);
  expect(input.modelCache.set).toHaveBeenCalledTimes(1);
});

test('current and conflicting stored query copies and shared descriptions outside the pool are excluded', async () => {
  const { input, vectors } = fixture();
  input.rows.push({ ...input.rows[0], tmdb_id: 999 }, { ...input.rows[1], library_id: 99 },
    { ...input.rows[2], library_id: 50, media_type: 'tv' });
  input.corpus = prepareInventoryDescriptionCorpus(input.rows);
  const result = await assessLiveLibraryNeighbors(input);
  const requested = input.query.mock.calls[0][1][4];
  expect(requested).not.toContain(input.request.hash);
  expect(requested).not.toContain(hash(input.rows[0].overview));
  expect(requested).not.toContain(hash(input.rows[1].overview));
  expect(requested).toContain(hash(input.rows[2].overview));
  expect(result.candidates[0].referenceDescriptions).toBe(28);
  const key = requested[0]; vectors.set(key, vector(.555));
  expect((await assessLiveLibraryNeighbors(input)).snapshotId).not.toBe(result.snapshotId);
  expect(input.modelCache.set).toHaveBeenCalledTimes(2);
  input.identity = { ...input.identity, digest: 'b'.repeat(64) };
  await assessLiveLibraryNeighbors(input); expect(input.modelCache.set).toHaveBeenCalledTimes(3);
});

test('expired or invalid vectors cannot use a previous fit, and sparse/degenerate models are not cached', async () => {
  const { input, vectors } = fixture(); await assessLiveLibraryNeighbors(input);
  vectors.delete(input.query.mock.calls[0][1][4][0]);
  expect(await assessLiveLibraryNeighbors(input)).toMatchObject({ status: 'incomplete', candidates: [] });
  expect(input.modelCache.get).toHaveBeenCalledTimes(1);
  input.query.mockResolvedValue({ rows: [{ description_hash: hash('foreign'), embedding: '[1,0]' }] });
  await expect(assessLiveLibraryNeighbors(input)).rejects.toThrow('scope_invalid');
  const sparse = fixture(20); expect((await assessLiveLibraryNeighbors(sparse.input)).candidates.every(c => c.status === 'sparse')).toBe(true);
  expect(sparse.input.modelCache.set).not.toHaveBeenCalled();
  const degenerate = fixture(); for (const key of degenerate.vectors.keys()) degenerate.vectors.set(key, [1, 0]);
  expect((await assessLiveLibraryNeighbors(degenerate.input)).candidates.every(c => c.status === 'degenerate')).toBe(true);
  expect(degenerate.input.modelCache.set).not.toHaveBeenCalled();
});

test('aborted cold fitting is not cached and later attempts can succeed', async () => {
  const { input } = fixture(), abort = new AbortController();
  const pending = assessLiveLibraryNeighbors({ ...input, signal: abort.signal });
  await setImmediate(); abort.abort(); await expect(pending).rejects.toThrow();
  expect(input.modelCache.set).not.toHaveBeenCalled();
  expect((await assessLiveLibraryNeighbors(input)).candidates[0].calibrated).toBe(true);
  await expect(assessLiveLibraryNeighbors({ ...input, vector: [0, 0] })).rejects.toThrow();
  await expect(assessLiveLibraryNeighbors({ ...input, request: { ...input.request, matchLibraryId: 99 } })).rejects.toThrow('scope_invalid');
});

test('per-attempt numeric ceiling rejects an expensive fit without caching it', async () => {
  const { input } = fixture(65); input.identity.dimensions = 16000; input.vector = [1, ...Array(15999).fill(0)];
  input.query.mockImplementation(async (_sql, parameters) => ({ rows: parameters[4].map((h, i) => ({
    description_hash: h, embedding: JSON.stringify([...vector(i / 100), ...Array(15998).fill(0)]),
  })) }));
  await expect(assessLiveLibraryNeighbors(input)).rejects.toThrow('work_budget');
  expect(input.modelCache.set).not.toHaveBeenCalled();
});
