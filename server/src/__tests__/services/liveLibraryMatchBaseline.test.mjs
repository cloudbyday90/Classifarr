/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { expect, jest, test } from '@jest/globals';
import { assessLiveLibraryMatch } from '../../services/liveLibraryMatchBaseline.mjs';
import { createInventoryMatchCalibration } from '../../services/inventoryMatchCalibration.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { splitLibraryMatchGroups } from '../../services/libraryMatchGroupSplit.mjs';
import { createLiveInventoryModelCache } from '../../services/liveInventoryModelCache.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
const vector = angle => [Math.cos(angle), Math.sin(angle)];
function fixture(size = 80) {
  const rows = Array.from({ length: size }, (_, i) => ({ library_id: 1, tmdb_id: i + 1,
    media_type: 'movie', overview: `Synopsis ${i}` }));
  rows.push({ library_id: 1, tmdb_id: 999, media_type: 'movie', overview: 'Query' });
  const vectors = new Map(rows.map((row, i) => [hash(row.overview), vector(i / 100)]));
  const input = { rows, corpus: prepareInventoryDescriptionCorpus(rows),
    request: { key: 'movie:999', mediaType: 'movie', libraryIds: [1, 2], matchLibraryId: 1, hash: hash('Query') },
    identity: { provider: 'ollama', model: 'test:latest', digest: 'a'.repeat(64), dimensions: 2 }, vector: vector(.4),
    query: jest.fn(async (_sql, parameters) => ({ rows: parameters[4].filter(h => vectors.has(h)).map(h => ({
      description_hash: h, embedding: JSON.stringify(vectors.get(h)),
    })) })) };
  return { input, vectors };
}

function cachedFixture(size) {
  const value = fixture(size), cache = createLiveInventoryModelCache();
  value.input.modelCache = { get: jest.fn(cache.get), set: jest.fn(cache.set) };
  return value;
}

test('warm baselines reread vectors, preserve results, and assess each query separately', async () => {
  const { input } = cachedFixture();
  const first = await assessLiveLibraryMatch(input);
  expect(await assessLiveLibraryMatch(input)).toEqual(first);
  expect(input.query).toHaveBeenCalledTimes(2);
  expect(input.modelCache.set).toHaveBeenCalledTimes(1);
  input.request = { ...input.request, key: 'movie:1000' }; input.vector = vector(Math.PI);
  const changed = await assessLiveLibraryMatch(input);
  expect(changed.status).toBe('unusual');
  expect(changed.snapshotId).not.toBe(first.snapshotId);
  expect(input.modelCache.set).toHaveBeenCalledTimes(1);
  expect(changed).toEqual(await assessLiveLibraryMatch({ ...input, modelCache: undefined }));
});

test('actual vector changes and embedding representations cannot reuse an old fit', async () => {
  const { input, vectors } = cachedFixture();
  await assessLiveLibraryMatch(input);
  const selected = input.query.mock.calls[0][1][4][0];
  vectors.set(selected, vector(.111));
  expect(await assessLiveLibraryMatch(input)).toEqual(await assessLiveLibraryMatch({ ...input, modelCache: undefined }));
  expect(input.modelCache.set).toHaveBeenCalledTimes(2);
  input.identity = { ...input.identity, digest: 'b'.repeat(64) };
  await assessLiveLibraryMatch(input);
  expect(input.modelCache.set).toHaveBeenCalledTimes(3);
  input.identity = { ...input.identity, model: 'other:latest' };
  await assessLiveLibraryMatch(input);
  expect(input.modelCache.set).toHaveBeenCalledTimes(4);
});

test('membership moves, new shared copies and current/old query holdouts invalidate fitting when relevant', async () => {
  const { input } = cachedFixture();
  await assessLiveLibraryMatch(input);
  input.rows[0].library_id = 2;
  input.corpus = prepareInventoryDescriptionCorpus(input.rows);
  await assessLiveLibraryMatch(input);
  expect(input.modelCache.set).toHaveBeenCalledTimes(2);
  input.rows.push({ ...input.rows[1], library_id: 99 });
  input.corpus = prepareInventoryDescriptionCorpus(input.rows);
  await assessLiveLibraryMatch(input);
  expect(input.modelCache.set).toHaveBeenCalledTimes(3);
  input.rows.push({ ...input.rows[2], tmdb_id: 999 });
  input.corpus = prepareInventoryDescriptionCorpus(input.rows);
  const changed = await assessLiveLibraryMatch(input);
  expect(input.modelCache.set).toHaveBeenCalledTimes(4);
  expect(changed).toEqual(await assessLiveLibraryMatch({ ...input, modelCache: undefined }));
});

test('missing/expired or malformed vectors cannot retrieve a previously successful cached baseline', async () => {
  const { input, vectors } = cachedFixture();
  await assessLiveLibraryMatch(input);
  vectors.delete(input.query.mock.calls[0][1][4][0]);
  expect(await assessLiveLibraryMatch(input)).toMatchObject({ status: 'incomplete', empiricalRank: null });
  expect(input.modelCache.get).toHaveBeenCalledTimes(1);
  input.query.mockResolvedValue({ rows: [{ description_hash: hash('foreign'), embedding: '[1,0]' }] });
  await expect(assessLiveLibraryMatch(input)).rejects.toThrow('scope_invalid');
  expect(input.modelCache.get).toHaveBeenCalledTimes(1);
});

test('cancellation during a cold fit publishes nothing and does not poison concurrent or later work', async () => {
  const { input } = cachedFixture();
  const controller = new AbortController();
  const interrupted = assessLiveLibraryMatch({ ...input, signal: controller.signal });
  const healthy = assessLiveLibraryMatch(input);
  await setImmediate();
  controller.abort();
  await expect(interrupted).rejects.toThrow();
  expect((await healthy).status).toBe('familiar');
  expect(input.modelCache.set).toHaveBeenCalledTimes(1);
  expect(await assessLiveLibraryMatch(input)).toEqual(await healthy);
  expect(input.modelCache.set).toHaveBeenCalledTimes(1);
});

test('failure states do not populate model cache and invalid queries cannot publish completed fits', async () => {
  const sparse = cachedFixture(39);
  await assessLiveLibraryMatch(sparse.input);
  expect(sparse.input.modelCache.set).not.toHaveBeenCalled();
  const { input, vectors } = cachedFixture();
  await expect(assessLiveLibraryMatch({ ...input, vector: [0, 0] })).rejects.toThrow();
  expect(input.modelCache.set).not.toHaveBeenCalled();
  for (const key of vectors.keys()) vectors.set(key, [1, 0]);
  expect((await assessLiveLibraryMatch(input)).status).toBe('degenerate');
  expect(input.modelCache.set).not.toHaveBeenCalled();
});

test('the live scalar-work ceiling rejects expensive fits without retaining a partial model', async () => {
  const { input } = cachedFixture(1000);
  input.identity.dimensions = 4096;
  input.vector = [1, ...Array(4095).fill(0)];
  input.query.mockImplementation(async (_sql, parameters) => ({ rows: parameters[4].map((hash, index) => ({
    description_hash: hash, embedding: JSON.stringify([...vector(index / 100), ...Array(4094).fill(0)]),
  })) }));
  await expect(assessLiveLibraryMatch(input)).rejects.toThrow('live_match_work_budget');
  expect(input.modelCache.set).not.toHaveBeenCalled();
});

test('live and held-out evaluation share the exact split and empirical assessment', async () => {
  const { input, vectors } = fixture();
  vectors.set(input.request.hash, input.vector);
  const calibration = createInventoryMatchCalibration({ documents: input.corpus.documents,
    libraries: [{ id: 1, media_type: 'movie' }], vectors, representation: input.identity });
  const evaluated = await calibration.assess({ heldDescriptionHashes: new Set([input.request.hash]),
    descriptionHash: input.request.hash, mediaType: 'movie', itemIdentity: { tmdbId: 999, mediaType: 'movie' } });
  const live = await assessLiveLibraryMatch(input);
  expect(live).toMatchObject(evaluated.candidates[0]);
  expect(live.status).toBe('familiar');
  expect(live.snapshotId).toMatch(/^[a-f0-9]{64}$/);
  const requested = input.query.mock.calls.flatMap(([, parameters]) => parameters[4]);
  expect(requested).not.toContain(input.request.hash);
  expect(new Set(requested).size).toBe(requested.length);
  expect(input.query.mock.calls.every(([sql]) => sql.trim().startsWith('SELECT'))).toBe(true);
});

test('new identities can be assessed; copies and shared groups outside the candidate pool are excluded', async () => {
  const { input } = fixture();
  input.rows.push({ ...input.rows[0], library_id: 99 }, { ...input.rows[1], tmdb_id: 999 },
    { ...input.rows[2], tmdb_id: 1000, overview: 'Query' }, { ...input.rows[3], media_type: 'tv' });
  input.corpus = prepareInventoryDescriptionCorpus(input.rows);
  const result = await assessLiveLibraryMatch(input);
  expect(result.sharedDescriptionsExcluded).toBe(1);
  const requested = input.query.mock.calls.flatMap(([, parameters]) => parameters[4]);
  expect(requested).not.toContain(hash('Synopsis 0'));
  expect(requested).not.toContain(hash('Synopsis 1'));
  expect(requested).not.toContain(hash('Query'));
  input.request = { ...input.request, key: 'movie:10001', hash: hash('Brand new') };
  expect((await assessLiveLibraryMatch(input)).status).toBe('familiar');
});

test('vector changes invalidate the baseline fingerprint even when rankings stay familiar', async () => {
  const { input, vectors } = fixture();
  const first = await assessLiveLibraryMatch(input);
  const requested = input.query.mock.calls[0][1][4][0];
  vectors.set(requested, vector(.111));
  expect((await assessLiveLibraryMatch(input)).snapshotId).not.toBe(first.snapshotId);
});

test('sparse and incomplete libraries do not become familiar', async () => {
  const { input } = fixture(39);
  expect(await assessLiveLibraryMatch(input)).toMatchObject({ status: 'sparse', empiricalRank: null });
  expect(input.query).not.toHaveBeenCalled();
  const large = fixture(); large.vectors.clear();
  expect(await assessLiveLibraryMatch(large.input)).toMatchObject({ status: 'incomplete', empiricalRank: null });
});

test('degenerate and unfamiliar matches remain non-qualifying', async () => {
  const { input, vectors } = fixture();
  input.vector = vector(Math.PI);
  expect((await assessLiveLibraryMatch(input)).status).toBe('unusual');
  for (const key of vectors.keys()) vectors.set(key, [1, 0]);
  expect((await assessLiveLibraryMatch(input)).status).toBe('degenerate');
});

test('caps training reads, is order invariant, and rejects malformed cache rows', async () => {
  const { input } = fixture(1000);
  const first = await assessLiveLibraryMatch(input);
  expect(input.query.mock.calls.flatMap(([, p]) => p[4])).toHaveLength(384);
  input.corpus.documents.reverse();
  expect(await assessLiveLibraryMatch(input)).toEqual(first);
  input.query.mockResolvedValue({ rows: [{ description_hash: hash('foreign'), embedding: '[1,0]' }] });
  await expect(assessLiveLibraryMatch(input)).rejects.toThrow('scope_invalid');
});

test('rejects out-of-scope libraries and cancellation', async () => {
  const { input } = fixture();
  await expect(assessLiveLibraryMatch({ ...input, request: { ...input.request, matchLibraryId: 99 } })).rejects.toThrow('scope_invalid');
  const controller = new AbortController(); controller.abort();
  await expect(assessLiveLibraryMatch({ ...input, signal: controller.signal })).rejects.toThrow();
});

test('split excludes held and shared groups independently of library display names', () => {
  const groups = Array.from({ length: 50 }, (_, i) => ({ hash: hash(`${i}`), mediaType: 'tv', libraryIds: new Set([1]) }));
  groups[0].libraryIds.add(2);
  const result = splitLibraryMatchGroups(groups, 1, 'tv', new Set([groups[1].hash]));
  expect(result).toMatchObject({ eligibleDescriptions: 48, sharedDescriptionsExcluded: 1 });
  expect(result.references).toHaveLength(28);
  expect(result.calibration).toHaveLength(20);
  expect([...result.references, ...result.calibration]).not.toContain(groups[0].hash);
  expect(splitLibraryMatchGroups([...groups].reverse(), 1, 'tv', new Set([groups[1].hash]))).toEqual(result);
});
