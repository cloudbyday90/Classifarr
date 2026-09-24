/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { prepareDescriptionBenchmark } from './inventoryDescriptionBenchmarkSample.mjs';
import { validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSelection.mjs';
import { prepareSourceDescriptionEvaluationCohort } from './sourceDescriptionEvaluationCohort.mjs';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rate = (numerator, denominator) => denominator ? Number((numerator / denominator).toFixed(6)) : null;
const empty = () => ({ cases: 0, changedShortlists: 0, changedLeaders: 0, correctionCases: 0,
  baseline: { noEvidence: 0, candidateHits: 0, leadingMatches: 0, leadingMismatches: 0 },
  sourceAware: { noEvidence: 0, candidateHits: 0, leadingMatches: 0, leadingMismatches: 0 },
  candidateGains: 0, candidateRegressions: 0, leadingGains: 0, leadingRegressions: 0 });

function finish(value) {
  for (const arm of [value.baseline, value.sourceAware]) {
    arm.candidateRecallAt3 = rate(arm.candidateHits, value.correctionCases);
    arm.leadingProposalMismatchRate = rate(arm.leadingMismatches, arm.leadingMatches + arm.leadingMismatches);
    arm.labeledProposals = arm.leadingMatches + arm.leadingMismatches;
  }
  return value;
}

function add(value, baseline, sourceAware, label) {
  value.cases++;
  value.changedShortlists += Number(JSON.stringify([...baseline.ids].sort()) !== JSON.stringify([...sourceAware.ids].sort()));
  value.changedLeaders += Number(baseline.leader !== sourceAware.leader);
  for (const [name, result] of [['baseline', baseline], ['sourceAware', sourceAware]]) {
    value[name].noEvidence += Number(result.leader === null);
    if (!label) continue;
    value[name].candidateHits += Number(result.ids.includes(label.libraryId));
    value[name].leadingMatches += Number(result.leader === label.libraryId);
    value[name].leadingMismatches += Number(result.leader !== null && result.leader !== label.libraryId);
  }
  if (!label) return;
  value.correctionCases++;
  const a = baseline.ids.includes(label.libraryId), b = sourceAware.ids.includes(label.libraryId);
  value.candidateGains += Number(!a && b); value.candidateRegressions += Number(a && !b);
  value.leadingGains += Number(baseline.leader !== label.libraryId && sourceAware.leader === label.libraryId);
  value.leadingRegressions += Number(baseline.leader === label.libraryId && sourceAware.leader !== label.libraryId);
}

/** One frozen snapshot, one held-out cohort, identical existing scorer, two training populations. */
export function evaluateSourceDescriptionPair(source, identity, rawOptions = {}) {
  validateDescriptionRepresentation(identity);
  const options = validateDescriptionBenchmarkOptions({ seed: 'source-description-paired-v1', size: 300, ...rawOptions });
  if (options.generateCases || options.excludePriorSize || options.excludePriorSizes.length) throw new Error('source_pair_options_invalid');
  const cohort = prepareSourceDescriptionEvaluationCohort(source, options);
  const { sample, corrections, feedbackExcludedHashes, holdoutGroupsByHash } = cohort;
  // Freeze fold assignment before dropping source-only training rows in the baseline.
  const foldPlan = planDescriptionBenchmarkFolds(source.corpus, sample, source.libraries, { seed: options.seed, folds: 3 });
  foldPlan.held = foldPlan.held.map(hashes => new Set([...feedbackExcludedHashes,
    ...[...hashes].flatMap(hash => [...holdoutGroupsByHash.get(hash)])]));
  const libraryCoverage = foldPlan.summary.libraryCoverage.map((row, index) => {
    const library = [...source.libraries].sort((a, b) => a.id - b.id)[index];
    const training = foldPlan.held.map(held => new Set(source.corpus.documents
      .filter(doc => doc.libraryIds.includes(library.id) && !held.has(doc.hash)).map(doc => doc.hash)).size);
    return { ...row, minimumTrainingDescriptions: Math.min(...training), maximumTrainingDescriptions: Math.max(...training) };
  });
  foldPlan.summary = { ...foldPlan.summary, protocol: 'known_identity_grouped_folds_v1', libraryCoverage,
    librariesWithoutTrainingInSomeFold: libraryCoverage.filter(row => row.minimumTrainingDescriptions === 0).length,
    librariesBelowThreeTrainingInSomeFold: libraryCoverage.filter(row => row.minimumTrainingDescriptions < 3).length };
  const sourceDocs = source.corpus.documents.filter(doc => doc.id === null);
  const missing = new Set([...source.corpus.texts.keys()].filter(hash => !source.vectors.has(hash)));
  const sampleCoverage = { byMedia: Object.fromEntries(['movie', 'tv'].map(type =>
    [type, sample.filter(doc => doc.type === type).length])),
    byQueryIdentity: { source_only: sample.filter(doc => doc.id === null).length,
      tmdb_linked: sample.filter(doc => doc.id !== null).length },
    libraries: [...source.libraries].sort((a, b) => a.id - b.id).map((library, index) => ({ stratum: index + 1,
      mediaType: library.media_type, sampled: sample.filter(doc => doc.libraryIds.includes(library.id)).length })) };
  const snapshotHash = createHash('sha256').update(JSON.stringify({
    snapshot: describeInventorySnapshotDigests(source, source.vectors), representation: identity }));
  for (const row of source.rows) snapshotHash.update(JSON.stringify(row)).update('\n');
  for (const row of source.operatorFeedbackRows) snapshotHash.update(JSON.stringify(row)).update('\n');
  const fingerprint = snapshotHash.digest('hex');
  const report = { version: 'source_description_pair_v1', status: missing.size ? 'cache_incomplete' : sample.length ? 'complete' : 'no_eligible_cases',
    requested: options.size, sampled: sample.length, sampleShortfall: Math.max(0, options.size - sample.length),
    snapshotFingerprint: fingerprint, sampleFingerprint: digest(sample.map(doc => doc.key).sort()),
    sampleCoverage, evaluation: { folds: 3, holdout: 'known_identity_grouped_folds', feedbackGroupsExcludedFromEveryFold: true },
    coverage: { ...source.corpus.coverage, sourceOnlyIdentities: sourceDocs.length,
      tmdbLinkedIdentities: source.corpus.documents.length - sourceDocs.length,
      missingCachedDescriptions: missing.size,
      sourceOnlyMissingCachedDescriptions: new Set(sourceDocs.filter(doc => missing.has(doc.hash)).map(doc => doc.hash)).size,
      sourceOnlyTrainingIdentitiesByFold: foldPlan.held.map(held => sourceDocs.filter(doc => !held.has(doc.hash)).length),
      ...cohort.coverage },
    limits: { scope: 'retrieval_shortlist_ablation', independentBlindLabels: 0,
      sourceOnlyQualityLabelsAvailable: sourceDocs.some(doc => corrections.has(doc.key)),
      fullPipelineAccuracy: null, wrongAutomaticRoutingRate: null, manualReviewRate: null, promotionAllowed: false,
      trainingMembershipIsObserved: true, unknownIdentityAliasesExcluded: false,
      libraryStrataBasis: 'observed_query_membership_nonexclusive' },
    metrics: null, byMedia: null, byQueryIdentity: null, libraries: null };
  if (missing.size || !sample.length) return report;
  const sampleKeys = new Set(sample.map(doc => doc.key));
  function arm(includeSourceItems) {
    const documents = source.corpus.documents.filter(doc => includeSourceItems || doc.id !== null || sampleKeys.has(doc.key));
    const hashes = new Set(documents.map(doc => doc.hash));
    const corpus = { ...source.corpus, documents, texts: new Map([...source.corpus.texts].filter(([hash]) => hashes.has(hash))) };
    // Identical expanded folds in both arms; no query alias or feedback group trains its prediction.
    const prepared = prepareDescriptionBenchmark({ ...source, corpus }, source.vectors, identity.dimensions,
      { ...options, folds: 3 }, { learnedProfiles: true, preserveDescriptionCandidate: true,
        includeComparisonEvidence: true, eligibleSampleKeys: sampleKeys, fixedFoldPlan: foldPlan,
        trainingExcludedKeys: new Set(includeSourceItems ? [] : sourceDocs.map(doc => doc.key)) });
    const results = new Map(prepared.cases.map(entry => [entry.descriptionHash, {
      ids: entry.candidates.filter(candidate => candidate.eligible > 0).map(candidate => candidate.id),
      leader: entry.investigationCandidates.find(candidate => candidate.eligible > 0)?.id ?? null,
    }]));
    if (results.size !== sample.length || sample.some(doc => !results.has(doc.hash))) throw new Error('source_pair_cohort_mismatch');
    return results;
  }
  const baseline = arm(false), sourceAware = arm(true), metrics = empty();
  const byMedia = { movie: empty(), tv: empty() }, byQueryIdentity = { tmdb_linked: empty(), source_only: empty() };
  const libraries = [...source.libraries].sort((a, b) => a.id - b.id).map((library, index) => ({ id: library.id, stratum: index + 1,
    mediaType: library.media_type, metrics: empty(), sourceOnlyTrainingDescriptionsByFold: foldPlan.held.map(held => new Set(sourceDocs
      .filter(doc => doc.libraryIds.includes(library.id) && !held.has(doc.hash)).map(doc => doc.hash)).size) }));
  for (const doc of sample) {
    const a = baseline.get(doc.hash), b = sourceAware.get(doc.hash), label = corrections.get(doc.key);
    for (const target of [metrics, byMedia[doc.type], byQueryIdentity[doc.id === null ? 'source_only' : 'tmdb_linked'],
      ...libraries.filter(library => doc.libraryIds.includes(library.id)).map(library => library.metrics)]) add(target, a, b, label);
  }
  return { ...report, metrics: finish(metrics), byMedia: Object.fromEntries(Object.entries(byMedia).map(([key, value]) => [key, finish(value)])),
    byQueryIdentity: Object.fromEntries(Object.entries(byQueryIdentity).map(([key, value]) => [key, finish(value)])),
    libraries: libraries.map(({ id: _id, ...library }) => ({ ...library, metrics: finish(library.metrics) })) };
}
