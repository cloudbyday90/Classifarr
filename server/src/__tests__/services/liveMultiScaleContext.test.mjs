/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { prepareUnseenMultiScaleSource, prepareMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { buildMultiScaleProfile } from '../../services/inventoryMultiScaleProfile.mjs';
import { bindLiveMultiScaleContext, retrieveLiveMultiScaleContext } from '../../services/liveMultiScaleContext.mjs';
import { liveFixture } from '../fixtures/liveMultiScaleFixture.mjs';
import { localFit } from '../fixtures/inventoryMultiScaleFixture.mjs';

test('real profile admits unseen movie/TV descriptions while the offline holdout boundary stays strict', async () => {
  const { snapshot, identity, input } = liveFixture();
  expect(() => prepareMultiScaleSource(snapshot, identity, new Set())).toThrow('holdout');
  const source = prepareUnseenMultiScaleSource(snapshot, identity);
  const built = await buildMultiScaleProfile(source, { fit: localFit });
  const bound = bindLiveMultiScaleContext(snapshot, identity, built.handle);
  const first = await retrieveLiveMultiScaleContext(bound, input);
  expect([...first.keys()]).toEqual([1, 2]);
  expect(first.get(1)).toHaveLength(3);
  const tv = { ...input, request: { ...input.request, key: 'tv:9999', mediaType: 'tv', libraryIds: [3, 4] } };
  expect([...(await retrieveLiveMultiScaleContext(bound, tv)).keys()]).toEqual([3, 4]);
  await expect(built.handle.retrieve({ type: 'movie', hash: snapshot.corpus.documents[0].hash, vector: input.vector }))
    .rejects.toThrow('holdout');
  expect(JSON.stringify(first.get(1))).not.toMatch(/centroid|hash|vector|tmdb/);
  first.get(1)[0].description = 'mutated';
  expect((await retrieveLiveMultiScaleContext(bound, input)).get(1)[0].description).not.toBe('mutated');
  await expect(retrieveLiveMultiScaleContext(bound, { ...input, signal: AbortSignal.abort() })).rejects.toThrow();
});

function setup() {
  const value = liveFixture();
  const context = { purpose: 'retrieval_context_only', candidates: [1, 2].map(id => ({ id,
    evidence: value.snapshot.corpus.documents.filter(doc => doc.libraryIds.includes(id)).slice(0, 3)
      .map(doc => ({ hash: doc.hash, similarity: 0.7, origins: ['raw', 'broad'] })) })) };
  const profile = { retrieve: jest.fn(async () => structuredClone(context)) };
  return { ...value, context, profile, bound: bindLiveMultiScaleContext(value.snapshot, value.identity, profile) };
}

test('known identities including excluded source identities, same text, drift and invalid scope fall back without retrieval', async () => {
  for (const change of [
    v => { v.input.request.key = v.snapshot.corpus.documents[0].key; },
    v => { v.bound.knownKeys.add(v.input.request.key); },
    v => { v.input.request.hash = v.snapshot.corpus.documents[0].hash; },
    v => { v.input.rows.push({ media_type: 'movie', tmdb_id: 9999 }); },
    v => { v.input.identity = { ...v.identity, digest: 'b'.repeat(64) }; },
    v => { v.input.corpus = structuredClone(v.input.corpus); v.input.corpus.documents.pop(); v.input.corpus.documents.shift(); },
    ...[[1], [1, 1], [1, 3], [1, 99], [1, 2, 3, 4], null].map(ids => v => { v.input.request.libraryIds = ids; }),
  ]) {
    const v = setup(); change(v);
    expect(await retrieveLiveMultiScaleContext(v.bound, v.input)).toBeNull();
    expect(v.profile.retrieve).not.toHaveBeenCalled();
  }
  const v = setup();
  expect(await retrieveLiveMultiScaleContext(null, v.input)).toBeNull();
  v.snapshot.observedKeys = new Set(['not-an-identity']);
  expect(() => bindLiveMultiScaleContext(v.snapshot, v.identity, v.profile)).toThrow();
});

test('malformed, duplicate, shared, foreign and non-finite representative evidence is not hydrated', async () => {
  for (const change of [
    c => { c.purpose = 'route'; }, c => { c.candidates = null; }, c => { c.candidates.pop(); },
    c => { c.candidates.push(c.candidates[0]); }, c => { c.candidates[0].evidence = null; },
    c => { c.candidates[0].evidence = Array(10).fill(c.candidates[0].evidence[0]); },
    c => { c.candidates[0].evidence[1] = c.candidates[0].evidence[0]; },
    c => { c.candidates[0].evidence[0].hash = 'f'.repeat(64); },
    c => { c.candidates[0].evidence[0].similarity = Infinity; },
    c => { c.candidates[0].evidence[0].similarity = -2; },
    c => { c.candidates[0].evidence[0] = c.candidates[1].evidence[0]; },
  ]) {
    const v = setup(); change(v.context);
    expect(await retrieveLiveMultiScaleContext(v.bound, v.input)).toBeNull();
  }
  const v = setup();
  v.context.candidates[0].evidence[0].origins = ['raw'];
  expect((await retrieveLiveMultiScaleContext(v.bound, v.input)).get(1)).toHaveLength(2);
  const doc = v.snapshot.corpus.documents[0]; doc.libraryIds.push(2);
  v.bound = bindLiveMultiScaleContext(v.snapshot, v.identity, v.profile);
  v.context.candidates[0].evidence[0].origins = ['local'];
  expect(await retrieveLiveMultiScaleContext(v.bound, v.input)).toBeNull();
});
