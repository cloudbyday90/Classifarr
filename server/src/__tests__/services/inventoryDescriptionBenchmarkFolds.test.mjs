/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { prepareDescriptionBenchmark } from '../../services/inventoryDescriptionBenchmarkSample.mjs';
import { selectAdditionalDescriptionBenchmarkSample, selectDescriptionBenchmarkSample, validateDescriptionBenchmarkOptions } from '../../services/inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from '../../services/inventoryDescriptionBenchmarkFolds.mjs';
import { runDescriptionBenchmark } from '../../services/inventoryDescriptionBenchmarkRunner.mjs';
import { buildDescriptionBenchmarkPrompt } from '../../services/inventoryDescriptionBenchmarkPrompt.mjs';

const seed = 'benchmark-test-seed-2026';

test('retaining private contrastive vectors does not change snapshot provenance or baseline prompts', () => {
  const snapshot = fixture(), options = { seed, size: 100, folds: 5 };
  const baseline = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 2, options, { learnedProfiles: true });
  const contrastive = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 2, options,
    { learnedProfiles: true, includeContrastiveVectors: true });
  expect(contrastive.fingerprint).toBe(baseline.fingerprint);
  expect(contrastive.sampleFingerprint).toBe(baseline.sampleFingerprint);
  expect(baseline.vectors).toBeUndefined();
  expect(contrastive.vectors.size).toBe(snapshot.vectors.size);
  expect(contrastive.cases.every((entry, index) => buildDescriptionBenchmarkPrompt(entry, contrastive.texts, 9).prompt ===
    buildDescriptionBenchmarkPrompt(baseline.cases[index], baseline.texts, 9).prompt)).toBe(true);
});
function fixture(sizes = [29, 300, 350, 45, 67, 350]) {
  const libraries = sizes.map((_, index) => ({ id: index + 1, name: `Private library ${index}`, media_type: index < 3 ? 'movie' : 'tv' }));
  const rows = libraries.flatMap((library, index) => Array.from({ length: sizes[index] }, (_, item) => ({
    library_id: library.id, media_type: library.media_type, tmdb_id: library.id * 1000 + item,
    overview: `Private synopsis ${library.id} item ${item}`,
  })));
  const corpus = prepareInventoryDescriptionCorpus(rows);
  const candidateMetadata = new Map(corpus.documents.map(doc => [doc.key, { genres: [`genre ${doc.libraryIds[0]}`], studio: '', rating: '' }]));
  return { corpus, libraries, candidateMetadata, vectors: new Map([...corpus.texts.keys()].map(hash => [hash, [1, 0]])) };
}

test('selects 300 new distinct titles after sequential 100 and 200 cohorts without silently repeating exhausted libraries', () => {
  const snapshot = fixture();
  const first = selectDescriptionBenchmarkSample(snapshot.corpus, { seed, size: 100 });
  const previous = new Set(first.map(doc => doc.hash));
  const second = selectDescriptionBenchmarkSample({ ...snapshot.corpus,
    documents: snapshot.corpus.documents.filter(doc => !previous.has(doc.hash)) }, { seed, size: 200 });
  second.forEach(doc => previous.add(doc.hash));
  const selected = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, { seed, size: 300, excludePriorSizes: [100, 200] });
  expect(selected.excluded).toEqual(previous);
  expect(selected.sample).toHaveLength(300);
  expect(new Set(selected.sample.map(doc => doc.hash)).size).toBe(300);
  expect(selected.sample.every(doc => !previous.has(doc.hash))).toBe(true);
  expect(selected.sample.some(doc => doc.type === 'tv')).toBe(true);
  expect(selected.sample.some(doc => doc.type === 'movie')).toBe(true);
  expect(selected.sample.some(doc => doc.libraryIds.includes(1))).toBe(false);
  expect(selectAdditionalDescriptionBenchmarkSample({ ...snapshot.corpus, documents: [...snapshot.corpus.documents].reverse() },
    { seed, size: 300, excludePriorSizes: [100, 200] })).toEqual(selected);
});

test('five grouped folds preserve the small library, reuse prior observations only for training, and exclude every test copy', () => {
  const snapshot = fixture();
  const options = { seed, size: 300, excludePriorSizes: [100, 200], folds: 5 };
  const { sample, excluded } = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options);
  const duplicate = { ...sample[0], id: 999999, key: `${sample[0].type}:999999`, libraryIds: [2, 3] };
  snapshot.corpus.documents.push(duplicate);
  // Re-select after introducing a copy: seed selection intentionally depends on the frozen snapshot.
  const selected = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options);
  const plan = planDescriptionBenchmarkFolds(snapshot.corpus, selected.sample, snapshot.libraries, options);
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 2, options, { learnedProfiles: true });
  expect(prepared.evaluation).toMatchObject({ folds: 5, previousSampleOverlap: 0, priorCohortSizes: [100, 200],
    librariesWithoutTrainingInSomeFold: 0, priorItemsAvailableForTraining: true });
  expect(prepared.evaluation.libraryCoverage[0].minimumTrainingDescriptions).toBe(29);
  expect(prepared.profileLearning.folds).toHaveLength(5);
  expect(prepared.profileLearning.folds.every(fold => fold.trainedLibraries === 6)).toBe(true);
  for (const entry of prepared.cases) {
    const held = plan.held[entry.foldIndex];
    expect(held.has(snapshot.corpus.documents.find(doc => doc.key === `${entry.mediaType}:${entry.itemIdentity.tmdbId}`).hash)).toBe(true);
    expect(entry.investigationCandidates.every(candidate => candidate.items.every(item => !held.has(item.hash)))).toBe(true);
  }
  expect(prepared.cases.some(entry => entry.investigationCandidates.some(candidate => candidate.items.some(item => excluded.has(item.hash))))).toBe(true);
});

test('folds group all description copies and memberships, balance rare libraries and remain name/order agnostic', () => {
  const snapshot = fixture([29, 60, 60, 30, 30, 60]);
  const sample = selectDescriptionBenchmarkSample(snapshot.corpus, { seed, size: 200 });
  snapshot.corpus.documents.push({ ...sample[0], key: 'tv:999999', id: 999999, type: 'tv', libraryIds: [4, 5] });
  const options = { seed, folds: 5 };
  const planned = planDescriptionBenchmarkFolds(snapshot.corpus, sample, snapshot.libraries, options);
  expect(planned.held.flatMap(held => [...held])).toHaveLength(200);
  expect(new Set(planned.held.flatMap(held => [...held])).size).toBe(200);
  expect(planned.held.filter(held => held.has(sample[0].hash))).toHaveLength(1);
  expect(planned.summary.libraryCoverage[0].minimumTrainingDescriptions).toBeGreaterThanOrEqual(23);
  const reordered = planDescriptionBenchmarkFolds({ ...snapshot.corpus, documents: [...snapshot.corpus.documents].reverse() },
    [...sample].reverse(), [...snapshot.libraries].reverse().map(library => ({ ...library, name: 'renamed' })), options);
  expect(reordered).toEqual(planned);
});

test('the own-fold metadata cannot affect its learned rankings; protocols have different fingerprints', () => {
  const snapshot = fixture([40, 40, 40, 40, 40, 40]);
  const options = { seed, size: 100, folds: 5 };
  const sample = selectDescriptionBenchmarkSample(snapshot.corpus, options);
  const plan = planDescriptionBenchmarkFolds(snapshot.corpus, sample, snapshot.libraries, options);
  const before = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 2, options, { learnedProfiles: true });
  // Change metadata of other test groups in fold 0; keep the query metadata itself unchanged.
  const query = sample.find(doc => plan.foldByHash.get(doc.hash) === 0);
  for (const doc of snapshot.corpus.documents) if (doc.hash !== query.hash && plan.held[0].has(doc.hash)) {
    snapshot.candidateMetadata.set(doc.key, { genres: ['poisoned'], studio: 'poisoned', rating: 'poisoned' });
  }
  const after = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 2, options, { learnedProfiles: true });
  expect(after.cases.find(entry => entry.itemIdentity.tmdbId === query.id)).toEqual(before.cases.find(entry => entry.itemIdentity.tmdbId === query.id));
  expect(after.profileLearning.folds[0]).toEqual(before.profileLearning.folds[0]);
  const baseline = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 2, { seed, size: 100 }, { learnedProfiles: true });
  expect(after.fingerprint).not.toBe(baseline.fingerprint);
  expect(after.sampleFingerprint).toBe(baseline.sampleFingerprint);
});

test('sparse and exhausted cohorts report shortfalls, not padded cases or hidden training gaps', () => {
  const snapshot = fixture([1, 2, 3, 0, 0, 0]);
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 2, { seed, size: 300, folds: 5 });
  expect(prepared.cases).toHaveLength(6);
  expect(prepared.evaluation.librariesWithoutTrainingInSomeFold).toBe(4);
  expect(prepared.evaluation.libraryCoverage[0].minimumTrainingDescriptions).toBe(0);
  const exhausted = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 2,
    { seed, size: 300, folds: 5, excludePriorSizes: [100, 200] });
  expect(exhausted.cases).toHaveLength(0);
  expect(exhausted.excludedPriorDescriptions).toBe(6);
});

test('per-library reports retain all sample denominators without exposing private identifiers', async () => {
  const snapshot = fixture([40, 40, 40, 40, 40, 40]);
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 2, { seed, size: 10, folds: 5 });
  let count = 0;
  const report = await runDescriptionBenchmark(prepared, { seed, size: 10, folds: 5, generateCases: 10 }, {
    client: { generate: async () => {
      if (++count % 4 === 0) throw new Error('Private provider error');
      return { response: '{"candidate":1}', latencyMs: 1 };
    } },
  });
  expect(report.evaluation.foldSizes.reduce((a, b) => a + b, 0)).toBe(10);
  expect(report.arms.every(arm => arm.libraryAgreement.reduce((sum, row) => sum + row.sampled, 0) === 10)).toBe(true);
  expect(report.arms.every(arm => arm.libraryAgreement.reduce((sum, row) => sum + row.finished, 0) === 10)).toBe(true);
  expect(report.accuracy).toBeNull();
  expect(JSON.stringify(report)).not.toMatch(/Private|synopsis|overview|tmdb|libraryIds|poisoned/);
});

test('the maximum 300-case budget runs exactly 900 comparisons and counts missing examples per library', async () => {
  const snapshot = fixture();
  const options = { seed, size: 300, folds: 5, generateCases: 300 };
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, 2, options);
  let calls = 0;
  const client = { generate: async () => { calls++; return { response: '{"candidate":0}' }; } };
  const report = await runDescriptionBenchmark(prepared, options, { client });
  expect(calls).toBe(900);
  expect(report.status).toBe('complete');
  expect(report.arms.every(arm => arm.finished === 300 && arm.statuses.abstained === 300)).toBe(true);
  prepared.cases[0].candidates.forEach(candidate => { candidate.items = []; });
  const missing = await runDescriptionBenchmark(prepared, { ...options, generateCases: 1 }, { client });
  expect(calls).toBe(900);
  expect(missing.arms.every(arm => arm.statuses.no_examples === 1 &&
    arm.libraryAgreement.reduce((sum, row) => sum + row.finished, 0) === 1)).toBe(true);
});

test.each([{ folds: 1 }, { folds: 11 }, { folds: 2.5 }, { excludePriorSizes: [0] }, { excludePriorSizes: [301] },
  { excludePriorSizes: '100,200' }, { excludePriorSizes: Array(11).fill(1) }, { excludePriorSize: 1, excludePriorSizes: [1] }])('invalid grouped options fail early: %j', invalid => {
  expect(() => validateDescriptionBenchmarkOptions({ seed, ...invalid })).toThrow('options_invalid');
});

test('fold planner bounds and unknown memberships fail closed', () => {
  const snapshot = fixture([1, 1, 1]);
  const sample = snapshot.corpus.documents;
  expect(() => planDescriptionBenchmarkFolds(snapshot.corpus, sample, snapshot.libraries, { seed, folds: 11 })).toThrow('fold_budget');
  expect(() => planDescriptionBenchmarkFolds(snapshot.corpus, sample, [], { seed, folds: 5 })).toThrow('fold_membership');
  expect(() => planDescriptionBenchmarkFolds(snapshot.corpus, [{ hash: 'unknown' }], snapshot.libraries, { seed, folds: 5 })).toThrow('fold_membership');
});
