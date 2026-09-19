/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateDescriptionBenchmarkOptions, selectAdditionalDescriptionBenchmarkSample } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { assertRepresentativeSnapshotBudget, inspectRepresentativeCoverage } from './inventoryRepresentativeCoverage.mjs';
import { REPRESENTATIVE_RECOVERY_WORK_COMPONENTS } from './inventoryRepresentativeStability.mjs';
import { fitInventoryRepresentativeProfile } from './inventoryRepresentativeProfileFit.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { COVERAGE_BENCHMARK_ARMS, coverageTrainingSnapshot, createCoverageMask } from './inventoryCoverageMasks.mjs';
import { coverageBenchmarkDecision, createCoverageMetrics, recordCoverageDecision } from './inventoryCoverageMetrics.mjs';

/** Read-only, zero-generation stress test. Held-out models never enter the runtime profile cache. */
export async function runInventoryCoverageBenchmark(snapshot, dimensions, rawOptions, { signal, onProgress,
  fit = fitInventoryRepresentativeProfile } = {}) {
  const options = validateDescriptionBenchmarkOptions(rawOptions);
  if (!options.folds || options.generateCases) throw new Error('coverage_benchmark_requires_grouped_zero_generation');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60_000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  assertRepresentativeSnapshotBudget(snapshot, dimensions);
  const plannedWork = snapshot.corpus.documents.length * dimensions * REPRESENTATIVE_RECOVERY_WORK_COMPONENTS *
    options.folds * COVERAGE_BENCHMARK_ARMS.length;
  if (plannedWork > 2_000_000_000_000) throw new Error('coverage_benchmark_work_budget');
  if (snapshot.vectors.size !== snapshot.corpus.texts.size) throw new Error('coverage_benchmark_complete_cache_required');
  // Validate queries too, even if a sparse fold would never compare them.
  for (const vector of snapshot.vectors.values()) normalizeDescriptionVector(vector, dimensions);
  const selection = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options), sample = selection.sample;
  const folds = planDescriptionBenchmarkFolds(snapshot.corpus, sample, snapshot.libraries, options);
  const strata = [...snapshot.libraries].sort((a, b) => a.id - b.id);
  const arms = COVERAGE_BENCHMARK_ARMS.map(name => ({ name, ...createCoverageMetrics(),
    mediaTypes: ['movie', 'tv'].map(mediaType => ({ mediaType, ...createCoverageMetrics() })),
    libraries: strata.map((row, index) => ({ stratum: index + 1, mediaType: row.media_type, ...createCoverageMetrics() })), folds: [] }));
  for (let fold = 0; fold < options.folds; fold++) {
    abort.throwIfAborted();
    const training = coverageTrainingSnapshot(snapshot, folds.held[fold]);
    const cases = sample.filter(doc => folds.foldByHash.get(doc.hash) === fold);
    const baseline = await fit(training, dimensions, { signal: abort });
    const completeDecisions = cases.map(doc => coverageBenchmarkDecision(baseline, doc, snapshot.vectors.get(doc.hash), dimensions));
    for (const arm of arms) {
      abort.throwIfAborted();
      const missing = createCoverageMask(training, dimensions, arm.name, `${options.seed}:fold:${fold}`, baseline);
      const masked = { ...training, vectors: new Map([...training.vectors].filter(([hash]) => !missing.has(hash))) };
      const model = arm.name === 'complete' ? baseline : await fit(masked, dimensions, { signal: abort });
      const coverage = inspectRepresentativeCoverage(masked);
      arm.folds.push({ fold: fold + 1, removedDescriptions: missing.size,
        libraries: strata.map((row, index) => ({ stratum: index + 1, ...coverage.libraries.get(row.id) })) });
      cases.forEach((doc, index) => {
        const decision = coverageBenchmarkDecision(model, doc, snapshot.vectors.get(doc.hash), dimensions);
        recordCoverageDecision(arm, decision, completeDecisions[index]);
        recordCoverageDecision(arm.mediaTypes.find(row => row.mediaType === doc.type), decision, completeDecisions[index]);
        // Multi-library placements contribute to each relevant stratum, not extra overall votes.
        strata.forEach((library, stratum) => {
          if (doc.libraryIds.includes(library.id)) recordCoverageDecision(arm.libraries[stratum], decision, completeDecisions[index]);
        });
      });
      onProgress?.({ phase: 'coverage_robustness', fold: fold + 1, arm: arm.name, evaluated: arm.evaluated });
    }
  }
  abort.throwIfAborted();
  return { protocol: 'inventory_coverage_robustness_v2', status: 'complete', calls: 0, livePromotionAllowed: false,
    metric: 'historical_placement_agreement_not_verified_correctness', sampledDescriptions: sample.length,
    sampleShortfall: options.size - sample.length, excludedPriorDescriptions: selection.excluded.size,
    sampleFingerprint: createHash('sha256').update(JSON.stringify(sample.map(doc => doc.key))).digest('hex'),
    evaluation: { ...folds.summary, priorCohortSizes: selection.priorCohortSizes,
      priorSampleFingerprints: selection.priorSampleFingerprints, previousSampleOverlap: sample.filter(doc => selection.excluded.has(doc.hash)).length,
      priorItemsAvailableForTraining: true }, snapshotComponents: describeInventorySnapshotDigests(snapshot, snapshot.vectors), arms };
}
