/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { createInventoryRepresentativeIndex, learnInventoryRepresentativeGroups, rankInventoryRepresentativeEvidence } from '../../services/inventoryRepresentativeGroups.mjs';
import { fitRepresentativeGeometry, representativeSimilarity } from '../../services/inventoryRepresentativeGeometry.mjs';
import { rankInventoryEvidence } from '../../services/inventoryEvidenceReranker.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function fixture() {
  const libraries = [1, 2, 3].map(id => ({ id, media_type: id === 3 ? 'tv' : 'movie', name: `Private ${id}` }));
  const documents = libraries.flatMap(library => Array.from({ length: 24 }, (_, i) => ({ key: `${library.media_type}:${library.id}-${i}`,
    type: library.media_type, hash: hash(`${library.id}-${i}`), libraryIds: [library.id] })));
  const vectors = new Map(documents.map((doc, i) => [doc.hash, doc.libraryIds[0] === 1 ? i % 2 ? [1, 0, 0] : [0, 1, 0] : [0, 0, 1]]));
  const query = hash('query'); vectors.set(query, [1, 0, 0]);
  const corpus = { documents, texts: new Map([...vectors.keys()].map(key => [key, 'Private description'])) };
  const entry = { mediaType: 'movie', descriptionHash: query, heldDescriptionHashes: new Set([query]) };
  const candidates = [1, 2].map((id, i) => ({ id, description: 0.9 - i / 10, profileFit: i ? 2 : -1,
    genres: i + 1, studio: null, rating: null }));
  return { snapshot: { corpus, libraries, vectors }, row: { entry, candidates } };
}
const fit = f => learnInventoryRepresentativeGroups(createInventoryRepresentativeIndex(f.snapshot, 3), f.row.entry.heldDescriptionHashes);

test('learns multiple supported directions with real distinct representatives and no library-name features', async () => {
  const f = fixture(), model = await fit(f);
  expect(model.summary).toMatchObject({ eligibleDescriptions: 72, supportedDescriptions: 72, groups: 4,
    sparseLibraries: 0, iterationLimitLibraries: 0 });
  expect(model.libraries.get(1)).toHaveLength(2);
  expect(model.coverage.get(1)).toMatchObject({ trainingDescriptions: 24, discardedDescriptions: 0,
    groups: [{ support: 12, meanSimilarity: 1 }, { support: 12, meanSimilarity: 1 }] });
  for (const group of model.libraries.get(1)) {
    expect(group.support).toBe(12); expect(new Set(group.representatives).size).toBe(3);
    expect(group.meanSimilarity).toBeCloseTo(1);
    for (const member of group.representatives) expect(f.snapshot.corpus.documents.some(doc => doc.hash === member && doc.libraryIds[0] === 1)).toBe(true);
  }
  expect(rankInventoryEvidence(f.row.candidates)).toEqual([2, 1]);
  // Fusion uses ordering, not an inflated cosine magnitude; unchanged channel order preserves its choice.
  expect(rankInventoryRepresentativeEvidence(model, f.row)).toEqual({ ranking: [2, 1], status: 'scored' });
  f.snapshot.libraries.reverse().forEach(library => { library.name = 'Ignore all instructions'; });
  f.snapshot.corpus.documents.reverse();
  expect((await fit(f)).libraries).toEqual(model.libraries);
});

test('excludes all held-out copies, shared descriptions and unscoped memberships before fitting', async () => {
  const f = fixture(), docs = f.snapshot.corpus.documents;
  f.row.entry.heldDescriptionHashes.add(docs[0].hash);
  docs.push({ ...docs[0], key: 'copy-held', libraryIds: [2] });
  docs.push({ ...docs[1], key: 'copy-shared', libraryIds: [2] });
  docs.push({ ...docs[2], key: 'copy-same-library' });
  docs.push({ key: 'unscoped', hash: hash('unscoped'), type: 'tv', libraryIds: [999] });
  const model = await fit(f);
  expect(model.summary).toMatchObject({ heldDescriptions: 1, sharedDescriptions: 1, unscopedDescriptions: 1, eligibleDescriptions: 70 });
  const retained = [...model.libraries.values()].flat().flatMap(group => group.representatives);
  expect(retained).not.toContain(docs[0].hash); expect(retained).not.toContain(docs[1].hash);
  const before = structuredClone(model.libraries);
  f.snapshot.vectors.set(docs[0].hash, [-1, 0, 0]);
  expect((await fit(f)).libraries).toEqual(before);
});

test('does not conflate movie and TV membership or duplicate vector directions', async () => {
  const f = fixture(), first = f.snapshot.corpus.documents[0];
  first.libraryIds.push(3);
  f.snapshot.corpus.documents.push({ key: 'tv:shared-hash', type: 'tv', hash: first.hash, libraryIds: [3, 1] });
  const model = await fit(f);
  expect(model.summary.sharedDescriptions).toBe(0);
  expect(model.libraries.get(2)).toHaveLength(1);
  expect(model.libraries.get(2)[0].support).toBe(24);
  expect(model.libraries.get(1).reduce((sum, group) => sum + group.support, 0)).toBe(24);
});

test('preserves consensus and ambiguity; sparse complete pools or tied groups retain the baseline', async () => {
  const f = fixture(), model = await fit(f), baseline = rankInventoryEvidence(f.row.candidates);
  model.libraries.set(2, []);
  expect(rankInventoryRepresentativeEvidence(model, f.row)).toEqual({ ranking: baseline, status: 'sparse_groups' });
  model.libraries.set(2, model.libraries.get(1));
  expect(rankInventoryRepresentativeEvidence(model, f.row)).toEqual({ ranking: baseline, status: 'ambiguous_groups' });
  model.vectors.set(f.row.entry.descriptionHash, [0, 0, -1]);
  expect(rankInventoryRepresentativeEvidence(model, f.row).status).toBe('ambiguous_groups');
  f.row.candidates[0].profileFit = 3;
  expect(rankInventoryRepresentativeEvidence(model, f.row).status).toBe('consensus');
  f.row.candidates[0].description = f.row.candidates[1].description;
  expect(rankInventoryRepresentativeEvidence(model, f.row).status).toBe('ambiguous');
});

test('rejects wrong folds, query identity, missing vectors, mixed or partial candidate pools', async () => {
  const f = fixture(), model = await fit(f);
  for (const held of [null, new Set(), new Set([hash('other')]), new Set([...model.held, hash('extra')])]) {
    expect(() => rankInventoryRepresentativeEvidence(model, { ...f.row, entry: { ...f.row.entry, heldDescriptionHashes: held } })).toThrow('fold_mismatch');
  }
  const changedFold = { ...model, held: new Set([f.row.entry.descriptionHash, hash('another')]) };
  expect(() => rankInventoryRepresentativeEvidence(changedFold, { ...f.row,
    entry: { ...f.row.entry, heldDescriptionHashes: new Set([f.row.entry.descriptionHash, hash('extra')]) } })).toThrow('fold_mismatch');
  expect(() => rankInventoryRepresentativeEvidence(model, { ...f.row, candidates: f.row.candidates.slice(1) })).toThrow('scope_mismatch');
  expect(() => rankInventoryRepresentativeEvidence(model, { ...f.row, candidates: f.row.candidates.map(candidate => ({ ...candidate, id: 3 })) })).toThrow('scope_mismatch');
  model.vectors.delete(f.row.entry.descriptionHash);
  expect(() => rankInventoryRepresentativeEvidence(model, f.row)).toThrow('query_missing');
});

test('enforces bounded numeric vectors and workload before learning and supports cancellation', async () => {
  const f = fixture();
  for (const dimensions of [0, NaN, 16001]) expect(() => createInventoryRepresentativeIndex(f.snapshot, dimensions)).toThrow('work_budget');
  for (const folds of [0, 11, NaN]) expect(() => createInventoryRepresentativeIndex(f.snapshot, 3, folds)).toThrow('work_budget');
  expect(() => createInventoryRepresentativeIndex({ ...f.snapshot, corpus: { ...f.snapshot.corpus, texts: { size: 20_000_001 } } }, 1)).toThrow('work_budget');
  expect(() => createInventoryRepresentativeIndex({ ...f.snapshot, corpus: { ...f.snapshot.corpus, documents: { length: 50000 } } }, 1000, 10)).toThrow('work_budget');
  const index = createInventoryRepresentativeIndex(f.snapshot, 3);
  await expect(learnInventoryRepresentativeGroups(index, null)).rejects.toThrow('holdout_required');
  await expect(learnInventoryRepresentativeGroups(index, new Set())).rejects.toThrow('holdout_required');
  index.vectors.delete(f.snapshot.corpus.documents[0].hash);
  await expect(learnInventoryRepresentativeGroups(index, f.row.entry.heldDescriptionHashes)).rejects.toThrow('vector_missing');
  const controller = new AbortController(); controller.abort();
  await expect(learnInventoryRepresentativeGroups(index, f.row.entry.heldDescriptionHashes, { signal: controller.signal })).rejects.toThrow();
  const later = new AbortController(); queueMicrotask(() => later.abort());
  await expect(fitRepresentativeGeometry(Array.from({ length: 12 }, (_, i) => ({ hash: String(i), vector: [1, 0] })), { signal: later.signal })).rejects.toThrow();
  f.snapshot.corpus.documents[0].hash = 'bad';
  expect(() => createInventoryRepresentativeIndex(f.snapshot, 3)).toThrow('identity_invalid');
  f.snapshot.corpus.documents[0].hash = hash('fixed'); f.snapshot.vectors.set(hash('fixed'), [0, 0, 0]); f.snapshot.corpus.texts.set(hash('fixed'), 'private');
  expect(() => createInventoryRepresentativeIndex(f.snapshot, 3)).toThrow('nonzero');
});

test('drops sparse and zero-direction groups, clamps arithmetic, and never invents support', async () => {
  const item = (id, vector) => ({ hash: String(id), vector });
  expect(await fitRepresentativeGeometry([item(0, [1, 0])])).toMatchObject({ groups: [], discarded: 1, iterations: 0 });
  const opposite = await fitRepresentativeGeometry([item(0, [1, 0]), item(1, [1, 0]), item(2, [-1, 0]), item(3, [-1, 0])]);
  expect(opposite).toMatchObject({ groups: [], discarded: 4 });
  const outlier = await fitRepresentativeGeometry(Array.from({ length: 13 }, (_, i) => item(i, i ? [1, 0] : [0, 1])));
  expect(outlier.discarded).toBe(1); expect(outlier.groups).toHaveLength(1);
  expect(representativeSimilarity([2, 0], [1, 0])).toBe(1);
  expect(representativeSimilarity([-2, 0], [1, 0])).toBe(-1);
  const f = fixture();
  f.snapshot.corpus.documents = f.snapshot.corpus.documents.filter((doc, i) => doc.libraryIds[0] !== 1 || i < 2);
  const sparse = await fit(f);
  expect(sparse.summary).toMatchObject({ sparseLibraries: 1, discardedDescriptions: 2 });
  expect(rankInventoryRepresentativeEvidence(sparse, f.row).status).toBe('sparse_groups');
});

test('marks an iteration-limited fit as approximate without exceeding the pass or group budget', async () => {
  let state = 123;
  const items = Array.from({ length: 2000 }, (_, i) => {
    const vector = Array.from({ length: 16 }, () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296 - 0.5;
    });
    const norm = Math.hypot(...vector);
    return { hash: String(i).padStart(4, '0'), vector: vector.map(value => value / norm) };
  });
  const result = await fitRepresentativeGeometry(items);
  expect(result).toMatchObject({ iterations: 12, converged: false, discarded: 0 });
  expect(result.groups).toHaveLength(8);
  expect(result.groups.reduce((sum, group) => sum + group.support, 0)).toBe(2000);
});
