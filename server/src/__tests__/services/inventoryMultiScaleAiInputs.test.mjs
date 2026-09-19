/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { describeMultiScaleAiInputs } from '../../services/inventoryMultiScaleAiInputs.mjs';
import { fixture } from '../fixtures/inventoryMultiScaleFixture.mjs';

test('content-only contract excludes names/metadata, owns no payload, and is order-independent', () => {
  const snapshot = fixture(), expected = describeMultiScaleAiInputs(snapshot);
  Object.defineProperty(snapshot, 'candidateMetadata', { get() { throw new Error('must not read metadata'); } });
  snapshot.libraries.forEach(row => { row.name = 'PRIVATE changed'; });
  snapshot.libraries.reverse(); snapshot.corpus.documents.reverse();
  snapshot.corpus.documents.forEach(row => row.libraryIds.reverse());
  snapshot.corpus.texts = new Map([...snapshot.corpus.texts].reverse());
  snapshot.vectors = new Map([...snapshot.vectors].reverse());
  expect(describeMultiScaleAiInputs(snapshot)).toEqual(expected);
  expect(expected.counts).toEqual({ documents: 48, libraries: 4, vectors: 48, descriptions: 48 });
  expect(JSON.stringify(expected)).not.toMatch(/PRIVATE|metadata/);
});

test.each([
  ['documents', snapshot => { snapshot.corpus.documents[0].key = 'movie:other'; }],
  ['documents', snapshot => { snapshot.corpus.documents[0].hash = 'b'.repeat(64); }],
  ['documents', snapshot => { snapshot.corpus.documents[0].type = 'tv'; }],
  ['documents', snapshot => { snapshot.corpus.documents[0].libraryIds = [1, 2]; }],
  ['libraries', snapshot => { snapshot.libraries[0].id = 99; }],
  ['libraries', snapshot => { snapshot.libraries[0].media_type = 'tv'; }],
  ['vectors', snapshot => { snapshot.vectors.values().next().value[0] += 0.01; }],
  ['vectors', snapshot => { snapshot.vectors.delete(snapshot.corpus.documents[0].hash); }],
  ['descriptions', snapshot => { snapshot.corpus.texts.set(snapshot.corpus.documents[0].hash, 'Different content under unchanged hash'); }],
  ['descriptions', snapshot => { snapshot.corpus.texts.delete(snapshot.corpus.documents[0].hash); }],
])('detects exact consumed %s input changes', (component, mutate) => {
  const snapshot = fixture(), before = describeMultiScaleAiInputs(snapshot);
  mutate(snapshot);
  expect(describeMultiScaleAiInputs(snapshot).hashes[component]).not.toBe(before.hashes[component]);
});
