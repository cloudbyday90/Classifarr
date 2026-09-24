/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { evaluateSourceDescriptionPair } from '../../services/sourceDescriptionPairedEvaluation.mjs';
import { prepareSourceDescriptionEvaluationCohort } from '../../services/sourceDescriptionEvaluationCohort.mjs';
import { sourcePairFixture, sourcePairIdentity as identity, sourcePairSnapshot } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { prepareDescriptionBenchmark } from '../../services/inventoryDescriptionBenchmarkSample.mjs';
import { inventorySourceDescriptionKey } from '../../services/inventorySourceDescriptionIdentity.mjs';

const options = { seed: 'source-pair-test-seed', size: 8 };
test('a prior source-only outcome excludes the known alias after TMDB attachment without transferring its label', () => {
  const source = sourcePairFixture();
  const row = source.rows.find(candidate => candidate.tmdb_id !== null);
  const current = source.corpus.documents.find(doc => doc.key === `${row.media_type}:${row.tmdb_id}`);
  source.operatorFeedbackRows = [{ identity_key: inventorySourceDescriptionKey({ ...row, tmdb_id: null }),
    tmdb_id: null, media_type: row.media_type, selected_library_id: row.library_id,
    was_correction: true, origin: 'manual_correction' }];
  const cohort = prepareSourceDescriptionEvaluationCohort(source, options);
  expect(cohort.corrections.size).toBe(0);
  expect(cohort.feedbackExcludedHashes.has(current.hash)).toBe(true);
});
test('durable source-only outcomes supply labels and exclude their entire group from training', () => {
  const source = sourcePairFixture();
  const doc = source.corpus.documents.find(candidate => candidate.id === null);
  source.operatorFeedbackRows = [{ identity_key: doc.key, tmdb_id: null, media_type: doc.type,
    selected_library_id: doc.libraryIds[0], was_correction: true, origin: 'manual_correction' }];
  const cohort = prepareSourceDescriptionEvaluationCohort(source, options);
  expect(cohort.corrections.has(doc.key)).toBe(true);
  expect(cohort.feedbackExcludedHashes.has(doc.hash)).toBe(true);
  const report = evaluateSourceDescriptionPair(source, identity, options);
  expect(report.qualityStatus).toBe('correction_cohort_measured');
  expect(report.limits.sourceOnlyQualityLabelsAvailable).toBe(true);
  expect(report.byQueryIdentity.source_only.correctionCases).toBe(1);
});
test('pairs the same cases and reports strata without exposing content or claiming routing quality', () => {
  const source = sourcePairFixture(), report = evaluateSourceDescriptionPair(source, identity, options);
  expect(report).toMatchObject({ version: 'source_description_pair_v2', status: 'complete',
    qualityStatus: 'no_correction_labels', requested: 8, sampled: 8, sampleShortfall: 0,
    metrics: { cases: 8, correctionCases: 0, baseline: { candidateRecallAt3: null, leadingProposalMismatchRate: null } },
    limits: { fullPipelineAccuracy: null, manualReviewRate: null, promotionAllowed: false } });
  expect(report.byMedia.movie.cases).toBe(4); expect(report.byMedia.tv.cases).toBe(4);
  expect(report.byQueryIdentity.source_only.cases).toBe(4);
  expect(report.libraries).toHaveLength(4);
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|tmdb_id|external_id|overview|library_id/);
  for (const doc of source.corpus.documents) expect(JSON.stringify(report)).not.toContain(doc.hash);
  expect(evaluateSourceDescriptionPair(source, identity, options)).toEqual(report);
});

test('missing source vectors block both arms rather than silently changing the evidence population', () => {
  const source = sourcePairFixture(), doc = source.corpus.documents.find(doc => doc.id === null);
  source.vectors.delete(doc.hash);
  expect(evaluateSourceDescriptionPair(source, identity, options)).toMatchObject({ status: 'cache_incomplete',
    qualityStatus: 'not_evaluated', metrics: null,
    sampleCoverage: { byMedia: { movie: 4, tv: 4 }, byQueryIdentity: { source_only: 4, tmdb_linked: 4 } },
    coverage: { missingCachedDescriptions: 1, sourceOnlyMissingCachedDescriptions: 1 } });
});

test('shortages remain explicit; empty and entirely held-out training sets do not invent predictions', () => {
  const source = sourcePairFixture(4);
  source.operatorFeedbackRows = source.rows.map(row => ({ media_type: row.media_type, tmdb_id: row.tmdb_id,
    selected_library_id: row.library_id, was_correction: true }));
  const report = evaluateSourceDescriptionPair(source, identity, options);
  expect(report).toMatchObject({ sampled: 4, sampleShortfall: 4, metrics: { correctionCases: 4,
    baseline: { noEvidence: 4, candidateRecallAt3: 0, labeledProposals: 0, leadingProposalMismatchRate: null },
    sourceAware: { noEvidence: 4, candidateRecallAt3: 0, labeledProposals: 0 } } });
  expect(report.metrics.baseline.correctionOutcomes.noTrainingEvidence).toBe(4);
  for (const metrics of [report.metrics, ...Object.values(report.byMedia), ...Object.values(report.byQueryIdentity),
    ...report.libraries.map(row => row.metrics)]) {
    for (const arm of [metrics.baseline, metrics.sourceAware]) {
      expect(Object.values(arm.correctionOutcomes).reduce((a, b) => a + b, 0)).toBe(metrics.correctionCases);
    }
  }
  expect(evaluateSourceDescriptionPair(sourcePairFixture(0), identity, options)).toMatchObject({ status: 'no_eligible_cases',
    qualityStatus: 'not_evaluated', sampled: 0, metrics: null });
});

test('held-out aliases cannot improve retrieval or metadata-profile training', () => {
  const source = sourcePairFixture();
  const cohort = prepareSourceDescriptionEvaluationCohort(source, options);
  const held = new Set(source.corpus.documents.map(doc => doc.hash));
  const prepared = prepareDescriptionBenchmark(source, source.vectors, identity.dimensions, { ...options, folds: 2 },
    { eligibleSampleKeys: new Set(cohort.sample.map(doc => doc.key)), learnedProfiles: true,
      includeComparisonEvidence: true, trainingExcludedHashes: held });
  expect(prepared.profileLearning.folds.every(fold => fold.trainingDescriptions === 0)).toBe(true);
  expect(prepared.cases.every(entry => entry.investigationCandidates.every(candidate => candidate.eligible === 0))).toBe(true);
  expect(prepared.cases.every(entry => entry.heldDescriptionHashes.size === held.size)).toBe(true);
});

test('a labeled paired regression is counted against the correction, never against observed membership', () => {
  const source = sourcePairFixture(40);
  // All queries are TMDB-linked; retain source-only examples as the treatment's training population.
  let settings, query;
  for (let i = 0; i < 100; i++) {
    settings = { seed: `source-pair-case-${i}`, size: 1 };
    query = prepareSourceDescriptionEvaluationCohort(source, settings).sample[0];
    if (query.id !== null) break;
  }
  expect(query.id).not.toBeNull();
  const other = query.libraryIds[0];
  const destination = source.libraries.find(library => library.media_type === query.type && library.id !== other).id;
  source.operatorFeedbackRows = [{ media_type: query.type, tmdb_id: query.id, selected_library_id: destination, was_correction: true }];
  // Remove metadata advantage, then control only the evidence vectors.
  for (const key of source.candidateMetadata.keys()) source.candidateMetadata.set(key, null);
  for (const doc of source.corpus.documents) source.vectors.set(doc.hash,
    doc.key === query.key || doc.id === null && doc.libraryIds.includes(other) ? [1, 0]
      : doc.libraryIds.includes(destination) ? [0.8, 0.6] : [0, 1]);
  const report = evaluateSourceDescriptionPair(source, identity, settings);
  expect(report.metrics).toMatchObject({ correctionCases: 1, leadingRegressions: 1,
    baseline: { leadingMatches: 1, leadingProposalMismatchRate: 0 },
    sourceAware: { leadingMismatches: 1, leadingProposalMismatchRate: 1 } });
});

test.each(['gain', 'regression'])('candidate recall records a paired %s when the corrected destination enters or leaves the top three', kind => {
  const fixture = sourcePairFixture(80);
  fixture.libraries.forEach(library => { library.media_type = 'movie'; });
  fixture.rows.forEach(row => { row.media_type = 'movie'; });
  const source = sourcePairSnapshot(fixture.rows, fixture.libraries);
  let settings, query;
  for (let i = 0; i < 100; i++) {
    settings = { seed: `source-pair-case-${i}`, size: 1 };
    query = prepareSourceDescriptionEvaluationCohort(source, settings).sample[0];
    if (query.id !== null) break;
  }
  expect(query.id).not.toBeNull();
  const destination = query.libraryIds[0], others = source.libraries.filter(library => library.id !== destination).map(library => library.id);
  source.operatorFeedbackRows = [{ media_type: 'movie', tmdb_id: query.id, selected_library_id: destination, was_correction: true }];
  for (const key of source.candidateMetadata.keys()) source.candidateMetadata.set(key, null);
  for (const doc of source.corpus.documents) {
    const library = doc.libraryIds[0];
    const similarity = kind === 'gain' ? library === destination ? doc.id === null ? 1 : 0.1 : 0.8
      : library === destination ? 0.8 : others.slice(0, 2).includes(library) ? 0.9 : doc.id === null ? 1 : 0.1;
    source.vectors.set(doc.hash, doc.key === query.key ? [1, 0] : [similarity, Math.sqrt(1 - similarity ** 2)]);
  }
  const report = evaluateSourceDescriptionPair(source, identity, settings);
  expect(report.metrics.correctionCases).toBe(1);
  expect(report.metrics[kind === 'gain' ? 'candidateGains' : 'candidateRegressions']).toBe(1);
  expect(report.metrics.baseline.candidateRecallAt3).toBe(kind === 'gain' ? 0 : 1);
  expect(report.metrics.sourceAware.candidateRecallAt3).toBe(kind === 'gain' ? 1 : 0);
});

test('snapshot fingerprints include grouping aliases and feedback, but contain no per-item data', () => {
  const source = sourcePairFixture(), original = evaluateSourceDescriptionPair(source, identity, options);
  source.rows[0].imdb_id = 'tt12345';
  expect(evaluateSourceDescriptionPair(source, identity, options).snapshotFingerprint).not.toBe(original.snapshotFingerprint);
});

test('duplicate synopsis cases are not manufactured to meet the requested count', () => {
  const source = sourcePairFixture(20);
  source.rows.forEach(row => { row.overview = 'One common PRIVATE synopsis'; });
  const report = evaluateSourceDescriptionPair(sourcePairSnapshot(source.rows, source.libraries), identity, options);
  expect(report.sampled).toBe(1); expect(report.sampleShortfall).toBe(7);
});

test('the complete 300-case paired path exercises both types and arbitrary libraries', () => {
  const report = evaluateSourceDescriptionPair(sourcePairFixture(640), identity);
  expect(report.status).toBe('complete'); expect(report.metrics.cases).toBe(300);
  expect(report.byMedia.movie.cases + report.byMedia.tv.cases).toBe(300);
  expect(report.byQueryIdentity.source_only.cases + report.byQueryIdentity.tmdb_linked.cases).toBe(300);
  expect(report.sampleCoverage.libraries.every(library => library.sampled > 0)).toBe(true);
});

test('source-only queries in other folds never become training evidence in the TMDB-only baseline', () => {
  const source = sourcePairFixture(48);
  source.rows.forEach(row => { row.tmdb_id = null; });
  const report = evaluateSourceDescriptionPair(sourcePairSnapshot(source.rows, source.libraries), identity, options);
  expect(report.metrics.baseline.noEvidence).toBe(8);
  expect(report.metrics.sourceAware.noEvidence).toBe(0);
  expect(report.metrics.changedLeaders).toBe(8);
  expect(report.byQueryIdentity.source_only.cases).toBe(8);
  expect(report.coverage.sourceOnlyTrainingIdentitiesByFold.every(count => count > 0 && count < 48)).toBe(true);
});

test('an invalid external fold assignment cannot silently pair different cases', () => {
  const source = sourcePairFixture();
  expect(() => prepareDescriptionBenchmark(source, source.vectors, identity.dimensions, { ...options, folds: 3 },
    { fixedFoldPlan: { held: [new Set(), new Set(), new Set()], foldByHash: new Map() } })).toThrow('fixed_fold_plan_invalid');
});

test.each([{ size: 301 }, { generateCases: 1 }, { excludePriorSize: 1 }])('rejects unsupported evaluation options: %j', override => {
  expect(() => evaluateSourceDescriptionPair(sourcePairFixture(), identity, { ...options, ...override })).toThrow();
});
