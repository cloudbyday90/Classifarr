/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateDescriptionBenchmarkOptions, selectAdditionalDescriptionBenchmarkSample } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { assertRepresentativeSnapshotBudget, representativeCoverageReady } from './inventoryRepresentativeCoverage.mjs';
import { REPRESENTATIVE_RECOVERY_WORK_COMPONENTS } from './inventoryRepresentativeStability.mjs';
import { fitInventoryRepresentativeProfile } from './inventoryRepresentativeProfileFit.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { coverageTrainingSnapshot } from './inventoryCoverageMasks.mjs';
import { createCoverageMetrics, recordCoverageDecision } from './inventoryCoverageMetrics.mjs';
import { inspectRepresentativeCandidates } from './representativeCandidateComparison.mjs';
import { buildCandidateSupportRanges, candidateSupportSlice } from './inventoryCandidateSupportRange.mjs';
import { createCandidateLocalIndex, retrieveCandidateLocalEvidence } from './inventoryCandidateLocalIndex.mjs';
import { resolveCandidateLocalEvidence, combineCandidateLocalEvidence } from './inventoryCandidateLocalEvidence.mjs';

function pairedDecision(candidates, vector, dimensions) {
  const reason = candidates.length < 2 ? 'insufficient_candidates'
    : candidates.some(([, profile]) => profile.coverage.status === 'waiting') ? 'incomplete_profiles'
    : candidates.some(([, profile]) => !representativeCoverageReady(profile.coverage)) ? 'sparse_profiles' : null;
  return reason ? { aligned: { reason }, independent: { reason } }
    : inspectRepresentativeCandidates(candidates.map(([, profile]) => profile), vector, dimensions);
}

function withPlacement(decision, candidates, doc) {
  if (decision.reason !== 'selected') return decision;
  const id = candidates[decision.index][0];
  return { reason: 'selected', id, agreement: doc.libraryIds.includes(id) };
}

const summarize = ({ pairedWithComplete, ...metrics }, localEvidence) => ({ ...metrics,
  [localEvidence ? 'pairedWithIndependent' : 'pairedWithAligned']: pairedWithComplete });

/** Paired zero-generation hold-out evaluation; never publishes profiles or writes routing state. */
export async function runInventoryCandidateStabilityBenchmark(snapshot, dimensions, rawOptions, { signal, onProgress,
  fit = fitInventoryRepresentativeProfile, localEvidence = false } = {}) {
  const options = validateDescriptionBenchmarkOptions(rawOptions);
  if (!options.folds || options.generateCases) throw new Error('candidate_stability_requires_grouped_zero_generation');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60_000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  assertRepresentativeSnapshotBudget(snapshot, dimensions);
  if (snapshot.corpus.documents.length * dimensions * REPRESENTATIVE_RECOVERY_WORK_COMPONENTS * options.folds > 400_000_000_000) {
    throw new Error('candidate_stability_work_budget');
  }
  if (snapshot.vectors.size !== snapshot.corpus.texts.size) throw new Error('candidate_stability_complete_cache_required');
  for (const hash of snapshot.corpus.texts.keys()) normalizeDescriptionVector(snapshot.vectors.get(hash), dimensions);
  const selection = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options), sample = selection.sample;
  const folds = planDescriptionBenchmarkFolds(snapshot.corpus, sample, snapshot.libraries, options);
  const strata = [...snapshot.libraries].sort((a, b) => a.id - b.id);
  const arms = (localEvidence ? ['independent', 'local', 'combined'] : ['aligned', 'independent']).map(name => ({ name, ...createCoverageMetrics(),
    mediaTypes: ['movie', 'tv'].map(mediaType => ({ mediaType, ...createCoverageMetrics() })),
    libraries: strata.map((library, index) => ({ stratum: index + 1, mediaType: library.media_type, ...createCoverageMetrics() })),
    supportRanges: ['within_observed_groups', 'outside_observed_groups', 'unavailable'].map(slice => ({ slice, ...createCoverageMetrics() })),
    ...(localEvidence ? { nearestExamples: ['smallest_supported_group', 'other_supported_group', 'unassigned', 'unavailable']
      .map(slice => ({ slice, ...createCoverageMetrics() })) } : {}) }));
  for (let fold = 0; fold < options.folds; fold++) {
    abort.throwIfAborted();
    const training = coverageTrainingSnapshot(snapshot, folds.held[fold]);
    const model = await fit(training, dimensions, { signal: abort });
    const ranges = await buildCandidateSupportRanges(model, training, dimensions, abort);
    const localIndex = localEvidence ? await createCandidateLocalIndex(snapshot, model, folds.held[fold], dimensions, abort) : null;
    for (const doc of sample.filter(row => folds.foldByHash.get(row.hash) === fold)) {
      abort.throwIfAborted();
      const candidates = [...model.libraries].filter(([, profile]) => profile.mediaType === doc.type);
      // A faulty fitter may not silently remove an unavailable destination from the comparison.
      const expected = snapshot.libraries.filter(row => row.media_type === doc.type);
      if (candidates.length !== expected.length || expected.some(row => !candidates.some(([id]) => id === row.id))) {
        throw new Error('candidate_stability_scope_changed');
      }
      const vector = snapshot.vectors.get(doc.hash), decisions = pairedDecision(candidates, vector, dimensions);
      let nearestSlice;
      if (localIndex) {
        const evidence = await retrieveCandidateLocalEvidence(localIndex, { type: doc.type, hash: doc.hash, vector }, abort);
        const proposal = resolveCandidateLocalEvidence(evidence, snapshot.candidateMetadata?.get(doc.key));
        decisions.local = proposal.reason === 'selected' ? { reason: 'selected',
          index: candidates.findIndex(([id]) => id === evidence.candidates[proposal.index].id) } : proposal;
        decisions.combined = combineCandidateLocalEvidence(decisions.independent, decisions.local);
        nearestSlice = evidence.slice;
      }
      const baseline = withPlacement(localEvidence ? decisions.independent : decisions.aligned, candidates, doc);
      const slice = candidateSupportSlice(candidates, ranges, vector, dimensions);
      for (const arm of arms) {
        const decision = withPlacement(decisions[arm.name], candidates, doc);
        recordCoverageDecision(arm, decision, baseline);
        recordCoverageDecision(arm.mediaTypes.find(row => row.mediaType === doc.type), decision, baseline);
        recordCoverageDecision(arm.supportRanges.find(row => row.slice === slice), decision, baseline);
        if (localEvidence) recordCoverageDecision(arm.nearestExamples.find(row => row.slice === nearestSlice), decision, baseline);
        strata.forEach((library, index) => {
          if (doc.libraryIds.includes(library.id)) recordCoverageDecision(arm.libraries[index], decision, baseline);
        });
      }
    }
    onProgress?.({ phase: localEvidence ? 'candidate_local_evidence' : 'candidate_stability', fold: fold + 1, evaluated: arms[0].evaluated });
  }
  abort.throwIfAborted();
  return { protocol: localEvidence ? 'inventory_candidate_local_evidence_v1' : 'inventory_candidate_stability_v1', status: 'complete', calls: 0, livePromotionAllowed: false,
    independentLabels: 0, accuracy: null, observedPlacementIsGroundTruth: false,
    metric: 'historical_placement_agreement_not_verified_correctness', sampledDescriptions: sample.length,
    sampleShortfall: options.size - sample.length, excludedPriorDescriptions: selection.excluded.size,
    sampleFingerprint: createHash('sha256').update(JSON.stringify(sample.map(doc => doc.key))).digest('hex'),
    evaluation: { ...folds.summary, priorCohortSizes: selection.priorCohortSizes,
      priorSampleFingerprints: selection.priorSampleFingerprints, previousSampleOverlap: sample.filter(doc => selection.excluded.has(doc.hash)).length,
      priorItemsAvailableForTraining: true, supportRangeIsDiagnosticOnly: true,
      ...(localEvidence ? { nearestExampleSliceIsDiagnosticOnly: true, supportingExamples: 3, correlationVeto: 0.98 } : {}) },
    snapshotComponents: describeInventorySnapshotDigests(snapshot, snapshot.vectors),
    arms: arms.map(arm => ({ ...summarize(arm, localEvidence), mediaTypes: arm.mediaTypes.map(row => summarize(row, localEvidence)),
      libraries: arm.libraries.map(row => summarize(row, localEvidence)), supportRanges: arm.supportRanges.map(row => summarize(row, localEvidence)),
      ...(localEvidence ? { nearestExamples: arm.nearestExamples.map(row => summarize(row, localEvidence)) } : {}) })) };
}
