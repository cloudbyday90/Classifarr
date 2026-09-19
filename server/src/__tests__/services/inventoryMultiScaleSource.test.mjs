/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { prepareMultiScaleSource } from '../../services/inventoryMultiScaleSource.mjs';
import { fixture, representation } from '../fixtures/inventoryMultiScaleFixture.mjs';

test('owns canonical content-only inputs, excludes all held copies and ignores irrelevant names/metadata', () => {
  const snapshot = fixture(), [doc] = snapshot.corpus.documents, held = new Set([doc.hash]);
  snapshot.corpus.documents.push({ ...doc, libraryIds: [2] });
  const source = prepareMultiScaleSource(snapshot, representation, held), before = structuredClone(source);
  expect(source.training.vectors.size).toBe(47);
  expect(source.training.corpus.documents.some(row => held.has(row.hash))).toBe(false);
  expect(JSON.stringify(source)).not.toContain('PRIVATE');
  snapshot.libraries.reverse(); snapshot.corpus.documents.reverse();
  snapshot.libraries.forEach(row => { row.name = 'changed'; });
  snapshot.candidateMetadata = new Map([['unrelated', 'ignored']]);
  expect(prepareMultiScaleSource(snapshot, representation, held).key).toBe(source.key);
  for (const vector of snapshot.vectors.values()) vector.fill(7);
  held.clear();
  expect(source).toEqual(before);
});

test('identity changes with representation, exact vectors, membership, media, scope and holdouts', () => {
  const snapshot = fixture(), held = new Set([snapshot.corpus.documents[0].hash]);
  const base = prepareMultiScaleSource(snapshot, representation, held).key;
  for (const identity of [{ ...representation, model: 'new' }, { ...representation, digest: 'b'.repeat(64) }]) {
    expect(prepareMultiScaleSource(snapshot, identity, held).key).not.toBe(base);
  }
  expect(prepareMultiScaleSource(snapshot, representation, new Set([snapshot.corpus.documents[1].hash])).key).not.toBe(base);
  for (const change of [value => value.vectors.set(value.corpus.documents[1].hash, [0, 1, 0, 0]),
    value => { value.corpus.documents[1].libraryIds = [1, 2]; },
    value => { value.corpus.documents[1].libraryIds = [3]; value.corpus.documents[1].type = 'tv'; },
    value => value.libraries.push({ id: 5, media_type: 'movie' })]) {
    const changed = structuredClone(snapshot); change(changed);
    expect(prepareMultiScaleSource(changed, representation, held).key).not.toBe(base);
  }
  const changed = structuredClone(snapshot);
  changed.vectors.set(changed.corpus.documents[1].hash, [3, 0, 0, 0]);
  const owned = prepareMultiScaleSource(changed, representation, held);
  expect(owned.training.vectors.get(changed.corpus.documents[1].hash)).toEqual([3, 0, 0, 0]);
  expect(owned.key).not.toBe(base);
  changed.vectors = new Map([...changed.vectors].map(([hash, vector]) => [hash, [...vector, 0]]));
  expect(prepareMultiScaleSource(changed, { ...representation, dimensions: 5 }, held).key).not.toBe(base);
});

test('rejects invalid identities, missing/invalid vectors, holdouts and foreign membership', () => {
  const snapshot = fixture(), held = new Set([snapshot.corpus.documents[0].hash]);
  for (const identity of [{ ...representation, model: '' }, { ...representation, model: 'x'.repeat(201) },
    { ...representation, digest: null }, { ...representation, digest: 'no' }, { ...representation, dimensions: 0 }]) {
    expect(() => prepareMultiScaleSource(snapshot, identity, held)).toThrow();
  }
  for (const invalid of [null, new Set(), new Set([1]), new Set(['no']), new Set(Array.from({ length: 301 }, (_, i) => i.toString(16).padStart(64, '0')))]) {
    expect(() => prepareMultiScaleSource(snapshot, representation, invalid)).toThrow();
  }
  for (const change of [value => value.vectors.delete(value.corpus.documents[0].hash),
    value => value.vectors.set(value.corpus.documents[1].hash, [NaN, 0, 0, 0]),
    value => { value.corpus.documents[1].libraryIds = []; },
    value => { value.corpus.documents[1].libraryIds = [1, 99]; },
    value => { value.corpus.documents[1].libraryIds = [3]; }]) {
    const changed = structuredClone(snapshot); change(changed);
    expect(() => prepareMultiScaleSource(changed, representation, held)).toThrow();
  }
});
