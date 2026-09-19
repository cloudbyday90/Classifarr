/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { validateDescriptionBenchmarkOptions, selectAdditionalDescriptionBenchmarkSample } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { assertRepresentativeSnapshotBudget } from './inventoryRepresentativeCoverage.mjs';
import { REPRESENTATIVE_RECOVERY_WORK_COMPONENTS } from './inventoryRepresentativeStability.mjs';
import { createCoverageMetrics, recordCoverageDecision } from './inventoryCoverageMetrics.mjs';
import { createMultiScaleProfileLoader } from './inventoryMultiScaleCache.mjs';
import { MULTI_SCALE_VERSION } from './inventoryMultiScaleSource.mjs';

const counters = () => ({ queries: 0, candidates: 0, rawExamples: 0, mergedExamples: 0, addedExamples: 0,
  localCandidates: 0, sparseCandidates: 0, sharedExamples: 0, ungroupedNearestQueries: 0,
  omittedCandidates: 0, lostRawExamples: 0, duplicateExamples: 0 });

function recordContext(metrics, result, expectedCandidates) {
  metrics.queries++;
  metrics.candidates += result.candidates.length;
  metrics.omittedCandidates += expectedCandidates.filter(id => !result.candidates.some(row => row.id === id)).length;
  metrics.sharedExamples += result.shared.length;
  metrics.ungroupedNearestQueries += Number(!result.nearestGrouped);
  for (const candidate of result.candidates) {
    const hashes = new Set(candidate.evidence.map(row => row.hash));
    metrics.rawExamples += candidate.raw.length; metrics.mergedExamples += candidate.evidence.length;
    metrics.addedExamples += candidate.evidence.length - candidate.raw.length;
    metrics.localCandidates += Number(Boolean(candidate.local)); metrics.sparseCandidates += Number(!candidate.broadAvailable);
    metrics.lostRawExamples += candidate.raw.filter(row => !hashes.has(row.hash)).length;
    metrics.duplicateExamples += candidate.evidence.length - hashes.size;
  }
}

/** Coverage/performance admission only: no generation, writes, labels or routing changes. */
export async function runInventoryMultiScaleBenchmark(snapshot, representation, rawOptions, { signal, onProgress,
  createLoader = createMultiScaleProfileLoader } = {}) {
  const options = validateDescriptionBenchmarkOptions(rawOptions), dimensions = representation.dimensions;
  if (!options.folds || options.generateCases) throw new Error('multi_scale_requires_grouped_zero_generation');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60_000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  assertRepresentativeSnapshotBudget(snapshot, dimensions);
  const n = snapshot.corpus.texts.size;
  const work = (n * (n - 1) + snapshot.corpus.documents.length * (REPRESENTATIVE_RECOVERY_WORK_COMPONENTS + 256)) * dimensions * options.folds;
  if (work > 400_000_000_000) throw new Error('multi_scale_work_budget');
  const selection = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options), sample = selection.sample;
  const folds = planDescriptionBenchmarkFolds(snapshot.corpus, sample, snapshot.libraries, options);
  const arm = { name: 'unchanged_broad_decision', ...createCoverageMetrics(),
    mediaTypes: ['movie', 'tv'].map(mediaType => ({ mediaType, ...createCoverageMetrics() })) };
  const context = { ...counters(), mediaTypes: ['movie', 'tv'].map(mediaType => ({ mediaType, ...counters() })) };
  const quality = [], caching = [], loader = createLoader();
  try {
    for (let fold = 0; fold < options.folds; fold++) {
      abort.throwIfAborted();
      if (!folds.held[fold].size) continue;
      let started = performance.now();
      const cold = await loader.load(snapshot, representation, { held: folds.held[fold], signal: abort });
      const coldMs = Math.round(performance.now() - started);
      started = performance.now();
      const warm = await loader.load(snapshot, representation, { held: folds.held[fold], signal: abort });
      caching.push({ fold: fold + 1, cold: cold.cache, warm: warm.cache, reused: cold.profile === warm.profile,
        coldMs, warmMs: Math.round(performance.now() - started), localStatus: cold.profile.summary().localStatus });
      quality.push(...cold.profile.summary().quality.map(row => ({ fold: fold + 1, ...row })));
      for (const doc of sample.filter(row => folds.foldByHash.get(row.hash) === fold)) {
        const result = await cold.profile.retrieve({ type: doc.type, hash: doc.hash, vector: snapshot.vectors.get(doc.hash) }, abort);
        const expected = snapshot.libraries.filter(row => row.media_type === doc.type).map(row => row.id);
        recordContext(context, result, expected);
        recordContext(context.mediaTypes.find(row => row.mediaType === doc.type), result, expected);
        const decision = { ...result.baseline, agreement: doc.libraryIds.includes(result.baseline.id) };
        recordCoverageDecision(arm, decision, decision);
        recordCoverageDecision(arm.mediaTypes.find(row => row.mediaType === doc.type), decision, decision);
      }
      onProgress?.({ stage: 'multi_scale_context', fold: fold + 1, evaluated: arm.evaluated });
    }
  } finally { loader.clear(); }
  abort.throwIfAborted();
  return { protocol: MULTI_SCALE_VERSION, status: 'complete', calls: 0, independentLabels: 0, accuracy: null,
    livePromotionAllowed: false, observedPlacementIsGroundTruth: false, metric: 'retrieval_coverage_not_routing_accuracy',
    sampledDescriptions: sample.length, sampleShortfall: options.size - sample.length,
    sampleFingerprint: createHash('sha256').update(JSON.stringify(sample.map(doc => doc.key))).digest('hex'),
    excludedPriorDescriptions: selection.excluded.size, evaluation: { ...folds.summary, priorCohortSizes: selection.priorCohortSizes,
      priorSampleFingerprints: selection.priorSampleFingerprints, previousSampleOverlap: sample.filter(doc => selection.excluded.has(doc.hash)).length,
      priorItemsAvailableForTraining: true, nonSelfGeometryIsDiagnosticOnly: true },
    snapshotComponents: describeInventorySnapshotDigests(snapshot, snapshot.vectors), context, caching, quality, arms: [arm] };
}
