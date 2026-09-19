/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { prepareMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { buildMultiScaleProfile, measureNonSelfRepresentatives } from '../../services/inventoryMultiScaleProfile.mjs';
import { discoverCommunityParticipation } from '../../services/inventoryCommunityParticipation.mjs';
import { readGroupBenchmarkControl } from '../../services/inventoryGroupBenchmarkControl.mjs';
import { compareNearestGroups } from '../../services/inventoryGroupQuality.mjs';
import { createMultiScaleProfileLoader } from '../../services/inventoryMultiScaleCache.mjs';
import { fixture, representation, localFit } from '../fixtures/inventoryMultiScaleFixture.mjs';

function setup(snapshot = fixture()) {
  const doc = snapshot.corpus.documents[0], held = new Set([doc.hash]);
  return { source: prepareMultiScaleSource(snapshot, representation, held),
    query: { type: doc.type, hash: doc.hash, vector: snapshot.vectors.get(doc.hash) } };
}
const build = (source, dependencies = {}) => buildMultiScaleProfile(source, { fit: localFit, ...dependencies });

test('retains raw examples, deduplicates origins, adds relevant context and preserves broad decisions', async () => {
  const { source, query } = setup(), { handle, cacheable } = await build(source);
  expect(cacheable).toBe(true);
  const result = await handle.retrieve(query);
  expect(result).toMatchObject({ purpose: 'retrieval_context_only', localStatus: 'available', baseline: { reason: 'selected', id: 1 } });
  expect(result.candidates.map(row => row.id)).toEqual([1, 2]);
  for (const candidate of result.candidates) {
    const expected = source.training.corpus.documents.filter(row => row.libraryIds.includes(candidate.id))
      .map(row => row.hash).sort().slice(0, 3);
    expect(candidate.raw.map(row => row.hash)).toEqual(expected);
    expect(candidate.evidence.map(row => row.hash)).toEqual(expected);
    expect(candidate.evidence.every(row => row.origins.includes('raw') && row.origins.includes('broad'))).toBe(true);
  }
  expect(result.candidates[0].evidence.every(row => row.origins.includes('local'))).toBe(true);
  expect(result.candidates[1].local).toBeNull(); // Orthogonal context must not be promoted.
  const control = await readGroupBenchmarkControl(source.training, await localFit(source.training, 4), 4);
  const { agreement: _agreement, ...baseline } = compareNearestGroups(control.libraries, query.type, query.vector, []);
  expect(result.baseline).toEqual(baseline);
  expect(JSON.stringify([result, handle.summary()])).not.toMatch(/PRIVATE|centroid|vector|overview|tmdb_id/);
  result.candidates[0].evidence[0].origins.push('mutated'); handle.summary().quality.length = 0;
  expect(JSON.stringify(await handle.retrieve(query))).not.toContain('mutated');
  expect(handle.summary().quality).toHaveLength(4);
  await expect(handle.retrieve({ ...query, hash: 'f'.repeat(64) })).rejects.toThrow('holdout');
  await expect(handle.retrieve({ ...query, type: 'episode' })).rejects.toThrow('holdout');
  await expect(handle.retrieve(query, AbortSignal.abort())).rejects.toThrow();
});

test('keeps shared, ungrouped and sparse evidence without omitting any media-matched alternative', async () => {
  const snapshot = fixture(), shared = snapshot.corpus.documents[1];
  snapshot.corpus.documents.push({ ...shared, libraryIds: [2] });
  snapshot.libraries.push({ id: 5, media_type: 'movie' });
  const { source, query } = setup(snapshot);
  const discover = async (...args) => {
    const result = await discoverCommunityParticipation(...args);
    result.libraries.forEach(row => { row.groups = []; }); return result;
  };
  const { handle } = await build(source, { discover }), result = await handle.retrieve(query);
  expect(result).toMatchObject({ nearestGrouped: false, baseline: { reason: 'unavailable_groups' } });
  expect(result.candidates.map(row => row.id)).toEqual([1, 2, 5]);
  expect(result.shared.map(row => row.hash)).toEqual([shared.hash]);
  expect(result.candidates.every(row => !row.evidence.some(item => item.hash === shared.hash))).toBe(true);
  expect(result.candidates[2]).toMatchObject({ raw: [], evidence: [], broadAvailable: false, broad: null, local: null });
  expect(result.candidates.every(row => row.local === null)).toBe(true);
});

test('failed/corrupt optional fits degrade safely; mandatory corruption and cancellation fail closed', async () => {
  const { source, query } = setup();
  const invalidChanges = [value => { value.libraries.pop(); }, value => { value.libraries[0].id = value.libraries[1].id; },
    value => { value.libraries[0].mediaType = 'tv'; }, value => { value.libraries[0].groups = null; },
    value => { value.libraries[0].groups[0].support = 1; }, value => { value.libraries[0].groups[0].centroid = [NaN]; },
    value => { value.libraries[0].groups[0].representatives = []; },
    value => { value.libraries[0].groups[0].representatives[0] = 'f'.repeat(64); },
    value => { value.libraries[0].groups[0].hashes[3] = value.libraries[0].groups[0].hashes[0]; }];
  const discovery = await discoverCommunityParticipation((await readGroupBenchmarkControl(source.training,
    await localFit(source.training, 4), 4)).index, source.training.vectors, 4);
  const failed = [async () => { throw new Error('PRIVATE failure'); }, async () => null,
    ...invalidChanges.map(change => async () => { const value = structuredClone(discovery); change(value); return value; })];
  for (const discover of failed) {
    const result = await build(source, { discover });
    expect(result.cacheable).toBe(false);
    expect(await result.handle.retrieve(query)).toMatchObject({ localStatus: 'unavailable', baseline: { reason: 'selected', id: 1 } });
  }
  await expect(build(source, { fit: async () => ({ libraries: new Map() }) })).rejects.toThrow('scope_changed');
  const controller = new AbortController();
  await expect(build(source, { signal: controller.signal, discover: async () => { controller.abort(); throw new Error('cancel'); } })).rejects.toThrow();
  expect((await build(source)).cacheable).toBe(true);
});

test('non-self diagnostic removes trivial representative self matches', async () => {
  const vectors = new Map([['a', [1, 0, 0]], ['b', [0, 1, 0]], ['c', [0, 0, 1]]]);
  const groups = [{ hashes: ['a', 'b', 'c'], representatives: ['a', 'b', 'c'] }];
  expect(await measureNonSelfRepresentatives(groups, vectors)).toEqual({ count: 3, mean: 0, p10: 0 });
  expect(await measureNonSelfRepresentatives([], vectors)).toEqual({ count: 0, mean: null, p10: null });
  await expect(measureNonSelfRepresentatives(groups, vectors, AbortSignal.abort())).rejects.toThrow();
});

test('optional failure self-recovers on the next load, then reuses the repaired profile', async () => {
  const snapshot = fixture(), { source, query } = setup(snapshot);
  let calls = 0;
  const loader = createMultiScaleProfileLoader({ build: (owned, dependencies) => build(owned, { ...dependencies,
    discover: (...args) => { if (++calls === 1) throw new Error('temporary'); return discoverCommunityParticipation(...args); } }) });
  const first = await loader.load(snapshot, representation, { held: source.held });
  expect(first.profile.summary().localStatus).toBe('unavailable');
  const recovered = await loader.load(snapshot, representation, { held: source.held });
  expect(recovered.profile.summary().localStatus).toBe('available');
  expect((await loader.load(snapshot, representation, { held: source.held })).cache).toBe('hit');
  expect((await first.profile.retrieve(query)).baseline).toEqual((await recovered.profile.retrieve(query)).baseline);
  expect(calls).toBe(2); loader.clear();
});
