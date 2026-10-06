/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createDescriptionVectorNormalizer } from '../../services/descriptionVectorNormalizer.mjs';
import { normalizeDescriptionVector } from '../../services/inventoryDescriptionSimilarity.mjs';
import { readGroupBenchmarkControl } from '../../services/inventoryGroupBenchmarkControl.mjs';
import { discoverCommunityParticipation } from '../../services/inventoryCommunityParticipation.mjs';
import { prepareMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { buildMultiScaleProfile } from '../../services/inventoryMultiScaleProfile.mjs';
import { fixture, representation, localFit } from '../fixtures/inventoryMultiScaleFixture.mjs';

function setup() {
  const snapshot = fixture();
  let offset = 0;
  for (const [hash, vector] of snapshot.vectors) snapshot.vectors.set(hash,
    vector.map((value, index) => value * 3.7 + (index + 1) * (++offset % 7 + 1) * 0.001));
  // Include a shared hash: it is absent from broad buckets but present in discovery.
  snapshot.corpus.documents.push({ ...snapshot.corpus.documents[2], libraryIds: [2] });
  const doc = snapshot.corpus.documents[0], held = new Set([doc.hash]);
  return { snapshot, source: prepareMultiScaleSource(snapshot, representation, held),
    query: { type: doc.type, hash: doc.hash, vector: snapshot.vectors.get(doc.hash) } };
}

test('shared and independent normalization produce exact controls and community results', async () => {
  const { source } = setup(), { training, dimensions } = source;
  const before = structuredClone(training), model = await localFit(training, dimensions);
  const normalize = createDescriptionVectorNormalizer();
  const independent = await readGroupBenchmarkControl(training, model, dimensions);
  const shared = await readGroupBenchmarkControl(training, model, dimensions, undefined, normalize);
  expect(shared).toEqual(independent);
  const discovered = await discoverCommunityParticipation(shared.index, training.vectors, dimensions, undefined, normalize);
  expect(discovered).toEqual(await discoverCommunityParticipation(independent.index, training.vectors, dimensions));
  for (const rows of shared.buckets.values()) for (const row of rows) {
    const community = [...discovered.media.values()].flatMap(media => media.rows).find(item => item.hash === row.hash);
    expect(community.vector).toBe(row.vector);
    expect(row.vector).toEqual(normalizeDescriptionVector(training.vectors.get(row.hash), dimensions));
  }
  expect(training).toEqual(before);
});

test('profile results remain exact and independent from the caller after fitting', async () => {
  const { source, snapshot, query } = setup();
  const shared = await buildMultiScaleProfile(source, { fit: localFit });
  const independent = await buildMultiScaleProfile(source, { fit: localFit,
    discover: (index, vectors, dimensions, signal) => discoverCommunityParticipation(index, vectors, dimensions, signal) });
  expect(shared.handle.summary()).toEqual(independent.handle.summary());
  expect(await shared.handle.retrieve(query)).toEqual(await independent.handle.retrieve(query));
  const freshQuery = { ...query, vector: [...query.vector] };
  const before = await shared.handle.retrieve(freshQuery);
  for (const vector of snapshot.vectors.values()) vector.fill(NaN);
  for (const vector of source.training.vectors.values()) vector.fill(NaN);
  expect(await shared.handle.retrieve(freshQuery)).toEqual(before);
  expect(await shared.handle.retrieve(freshQuery)).toEqual(await independent.handle.retrieve(freshQuery));
  expect(before.localStatus).toBe('available');
});

test('corruption after a memo hit still fails; cancellation does not publish a profile', async () => {
  const { source } = setup(), controller = new AbortController();
  await expect(buildMultiScaleProfile(source, { fit: localFit, signal: controller.signal,
    discover: async (...args) => { controller.abort(); return discoverCommunityParticipation(...args); } })).rejects.toThrow();
  const normalize = createDescriptionVectorNormalizer(), vector = source.training.vectors.values().next().value;
  normalize(vector, 4); vector[0] = NaN;
  const index = { scope: new Map([[1, 'movie']]), groups: new Map([['x', { type: 'movie',
    hash: source.training.vectors.keys().next().value, libraries: new Set([1]) }]]) };
  await expect(discoverCommunityParticipation(index, source.training.vectors, 4, undefined, normalize)).rejects.toThrow();
});
