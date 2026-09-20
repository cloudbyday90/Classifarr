/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { linearFixture } from '../fixtures/inventoryLinearRankerFixture.mjs';
import { prepareLinearRankerSource, selectLinearRankerTraining, buildLinearRankerMatrix, describeLinearRankerInputs } from '../../services/inventoryLinearRankerSource.mjs';

test('holds out every description copy across media and excludes history, sharing and conflicting metadata', () => {
  const snapshot = linearFixture(), docs = snapshot.corpus.documents;
  const [held, history, shared, conflicting, duplicate] = docs;
  snapshot.corpus.documents.push({ ...held, key: 'tv:999', id: 999, type: 'tv', libraryIds: [3] });
  snapshot.candidateMetadata.set('tv:999', snapshot.candidateMetadata.get(held.key));
  snapshot.trainingExclusions.add(history.key);
  shared.libraryIds = [1, 2]; snapshot.candidateMetadata.set(conflicting.key, null);
  snapshot.corpus.documents.push({ ...duplicate, key: 'movie:999', id: 999 });
  snapshot.candidateMetadata.set('movie:999', snapshot.candidateMetadata.get(duplicate.key));
  const training = selectLinearRankerTraining(prepareLinearRankerSource(snapshot, 4), new Set([held.hash]));
  expect(training.counts).toMatchObject({ held: 1, retainedHistory: 1, shared: 1, conflictingMetadata: 1, admitted: 44 });
  expect(training.documents.filter(doc => doc.hash === duplicate.hash)).toHaveLength(1);
  expect(training.documents.some(doc => [held.hash, history.hash, shared.hash, conflicting.hash].includes(doc.hash))).toBe(false);
});

test('conflicts or retained history in any duplicate reject the whole training group', () => {
  for (const reason of ['history', 'metadata', 'media']) {
    const snapshot = linearFixture(), first = snapshot.corpus.documents[0];
    const copy = { ...first, id: 999, key: reason === 'media' ? 'tv:999' : 'movie:999',
      type: reason === 'media' ? 'tv' : 'movie', libraryIds: reason === 'media' ? [3] : [1] };
    snapshot.corpus.documents.push(copy);
    snapshot.candidateMetadata.set(copy.key, reason === 'metadata' ? {} : snapshot.candidateMetadata.get(first.key));
    if (reason === 'history') snapshot.trainingExclusions.add(copy.key);
    const training = selectLinearRankerTraining(prepareLinearRankerSource(snapshot, 4), new Set());
    expect(training.documents.some(doc => doc.hash === first.hash)).toBe(false);
  }
});

test('missing metadata remains neutral, sparse classes disappear, and names/order cannot affect numeric input', () => {
  const snapshot = linearFixture(); snapshot.candidateMetadata = new Map();
  snapshot.corpus.documents = snapshot.corpus.documents.filter((doc, i) => doc.libraryIds[0] !== 1 || i < 2);
  const source = prepareLinearRankerSource(snapshot, 4), training = selectLinearRankerTraining(source, new Set());
  expect(training.counts).toMatchObject({ sparse: 2, admitted: 36 });
  const matrix = buildLinearRankerMatrix(source, training.documents, 'movie'); expect(matrix.classes).toEqual([2]);
  snapshot.corpus.documents.reverse(); snapshot.libraries.reverse(); snapshot.libraries.forEach(library => { library.name = 'Misleading name'; });
  const reordered = prepareLinearRankerSource(snapshot, 4);
  expect(buildLinearRankerMatrix(reordered, selectLinearRankerTraining(reordered, new Set()).documents, 'movie')).toEqual(matrix);
});

test.each([
  snapshot => { delete snapshot.trainingExclusions; }, snapshot => { snapshot.trainingExclusions.add('movie:999'); },
  snapshot => { snapshot.candidateMetadata = null; }, snapshot => { snapshot.libraries[0].id = 0; },
  snapshot => { snapshot.libraries.push(snapshot.libraries[0]); }, snapshot => { snapshot.libraries[0].media_type = 'unknown'; },
  snapshot => { snapshot.corpus.documents[0].key = 'movie:999'; }, snapshot => { snapshot.corpus.documents.push(snapshot.corpus.documents[0]); },
  snapshot => { snapshot.corpus.documents[0].libraryIds = [999]; }, snapshot => { snapshot.corpus.documents[0].libraryIds = [1, 1]; },
  snapshot => { snapshot.corpus.documents[0].libraryIds = []; }, snapshot => { snapshot.vectors.values().next().value[0] = NaN; },
  snapshot => { snapshot.trainingExclusions.add(snapshot.corpus.documents[0].key); snapshot.vectors.values().next().value[0] = Infinity; },
])('validates the whole source before selecting or filtering training rows', change => {
  const snapshot = linearFixture(); change(snapshot); expect(() => prepareLinearRankerSource(snapshot, 4)).toThrow();
});

test('fingerprints provenance, metadata, vectors, documents and text but ignore display names', () => {
  const snapshot = linearFixture(), initial = describeLinearRankerInputs(snapshot);
  snapshot.libraries[0].name = 'Renamed'; expect(describeLinearRankerInputs(snapshot)).toEqual(initial);
  snapshot.trainingExclusions.add(snapshot.corpus.documents[0].key);
  expect(describeLinearRankerInputs(snapshot).hashes.provenance).not.toBe(initial.hashes.provenance);
  snapshot.candidateMetadata.set(snapshot.corpus.documents[0].key, null);
  expect(describeLinearRankerInputs(snapshot).hashes.metadata).not.toBe(initial.hashes.metadata);
  delete snapshot.trainingExclusions; expect(() => describeLinearRankerInputs(snapshot)).toThrow('provenance_required');
});
