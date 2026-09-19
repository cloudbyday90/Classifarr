/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { validateDescriptionBenchmarkOptions, selectAdditionalDescriptionBenchmarkSample } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { assertRepresentativeSnapshotBudget, inspectRepresentativeCoverage, validateRepresentativeCoverage } from './inventoryRepresentativeCoverage.mjs';
import { REPRESENTATIVE_RECOVERY_WORK_COMPONENTS } from './inventoryRepresentativeStability.mjs';
import { fitInventoryRepresentativeProfile } from './inventoryRepresentativeProfileFit.mjs';
import { coverageTrainingSnapshot } from './inventoryCoverageMasks.mjs';
import { validateRepresentativeMembership, validatedRecoveryGroups } from './inventoryRepresentativeMembership.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { fitAdaptiveGroups } from './inventoryAdaptiveGroups.mjs';
import { measureGroupQuality, compareNearestGroups, measureSmallGroupRetention } from './inventoryGroupQuality.mjs';
import { createCoverageMetrics, recordCoverageDecision } from './inventoryCoverageMetrics.mjs';

/** Fixed protocol, complete-cache, zero-generation paired evaluation. Not a runtime profile format. */
export async function runInventoryAdaptiveGroupBenchmark(snapshot, dimensions, rawOptions, { signal, onProgress,
  fit = fitInventoryRepresentativeProfile } = {}) {
  const options = validateDescriptionBenchmarkOptions(rawOptions);
  if (!options.folds || options.generateCases) throw new Error('adaptive_groups_require_grouped_zero_generation');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60_000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  assertRepresentativeSnapshotBudget(snapshot, dimensions);
  // Two starts, six levels, 32 passes, plus summaries/validation; no all-pairs matrix.
  if (snapshot.corpus.documents.length * dimensions * (REPRESENTATIVE_RECOVERY_WORK_COMPONENTS + 1200) * options.folds > 400_000_000_000) {
    throw new Error('adaptive_groups_work_budget');
  }
  if (snapshot.vectors.size !== snapshot.corpus.texts.size) throw new Error('adaptive_groups_complete_cache_required');
  for (const hash of snapshot.corpus.texts.keys()) normalizeDescriptionVector(snapshot.vectors.get(hash), dimensions);
  const selection = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options), sample = selection.sample;
  const folds = planDescriptionBenchmarkFolds(snapshot.corpus, sample, snapshot.libraries, options);
  const strata = [...snapshot.libraries].sort((a, b) => a.id - b.id);
  const arms = ['fixed_groups', 'adaptive_groups'].map(name => ({ name, ...createCoverageMetrics(),
    mediaTypes: ['movie', 'tv'].map(mediaType => ({ mediaType, ...createCoverageMetrics() })),
    libraries: strata.map((library, index) => ({ stratum: index + 1, mediaType: library.media_type, ...createCoverageMetrics() })) }));
  const quality = [], timing = { controlMs: 0, adaptiveMs: 0 };
  for (let fold = 0; fold < options.folds; fold++) {
    abort.throwIfAborted();
    const training = coverageTrainingSnapshot(snapshot, folds.held[fold]);
    let started = performance.now();
    const model = await fit(training, dimensions, { signal: abort });
    timing.controlMs += performance.now() - started;
    const coverage = inspectRepresentativeCoverage(training), { index } = coverage;
    if (model.libraries.size !== index.scope.size || [...index.scope].some(([id, type]) => model.libraries.get(id)?.mediaType !== type)) {
      throw new Error('adaptive_groups_scope_changed');
    }
    const buckets = new Map([...index.scope.keys()].map(id => [id, []]));
    for (const group of index.groups.values()) if (group.libraries.size === 1) {
      buckets.get([...group.libraries][0]).push({ hash: group.hash,
        vector: normalizeDescriptionVector(training.vectors.get(group.hash), dimensions) });
    }
    const control = [], treatment = [];
    for (const [stratum, library] of strata.entries()) {
      const items = buckets.get(library.id), profile = model.libraries.get(library.id);
      validateRepresentativeCoverage(profile.coverage);
      if (Object.entries(coverage.libraries.get(library.id)).some(([key, value]) => profile.coverage[key] !== value)) {
        throw new Error('adaptive_groups_coverage_changed');
      }
      // The current fitter deliberately supplies no members for a library below three descriptions.
      validateRepresentativeMembership(profile, new Set((profile.coverage.status === 'complete' ? items : []).map(row => row.hash)));
      const hashes = await validatedRecoveryGroups(profile, training.vectors, dimensions, abort);
      const baseline = hashes ? profile.starts[profile.selectedStart].groups.map((group, i) => ({ ...group, hashes: hashes[i] })) : [];
      started = performance.now();
      const adaptive = await fitAdaptiveGroups(items, dimensions, { signal: abort });
      timing.adaptiveMs += performance.now() - started;
      control.push({ id: library.id, mediaType: library.media_type, available: Boolean(hashes), groups: baseline });
      treatment.push({ id: library.id, mediaType: library.media_type, available: adaptive.groups.length > 0, groups: adaptive.groups });
      quality.push({ fold: fold + 1, stratum: stratum + 1, mediaType: library.media_type, controlAvailable: Boolean(hashes),
        control: await measureGroupQuality(baseline, items, abort), adaptive: await measureGroupQuality(adaptive.groups, items, abort),
        smallestControlGroups: measureSmallGroupRetention(baseline, adaptive.groups), splitting: adaptive.diagnostics });
    }
    for (const doc of sample.filter(row => folds.foldByHash.get(row.hash) === fold)) {
      abort.throwIfAborted();
      const vector = normalizeDescriptionVector(snapshot.vectors.get(doc.hash), dimensions);
      const decisions = [control, treatment].map(libraries => compareNearestGroups(libraries, doc.type, vector, doc.libraryIds));
      arms.forEach((arm, index) => {
        recordCoverageDecision(arm, decisions[index], decisions[0]);
        recordCoverageDecision(arm.mediaTypes.find(row => row.mediaType === doc.type), decisions[index], decisions[0]);
        strata.forEach((library, stratum) => {
          if (doc.libraryIds.includes(library.id)) recordCoverageDecision(arm.libraries[stratum], decisions[index], decisions[0]);
        });
      });
    }
    onProgress?.({ stage: 'adaptive_groups', fold: fold + 1, evaluated: arms[0].evaluated });
  }
  abort.throwIfAborted();
  return { protocol: 'inventory_adaptive_groups_v1', status: 'complete', calls: 0, independentLabels: 0, accuracy: null,
    observedPlacementIsGroundTruth: false, livePromotionAllowed: false, metric: 'nearest_group_placement_agreement_not_routing_accuracy',
    sampledDescriptions: sample.length, sampleShortfall: options.size - sample.length,
    sampleFingerprint: createHash('sha256').update(JSON.stringify(sample.map(doc => doc.key))).digest('hex'),
    excludedPriorDescriptions: selection.excluded.size, evaluation: { ...folds.summary, priorCohortSizes: selection.priorCohortSizes,
      priorSampleFingerprints: selection.priorSampleFingerprints, previousSampleOverlap: sample.filter(doc => selection.excluded.has(doc.hash)).length,
      priorItemsAvailableForTraining: true, geometryIsDiagnosticOnly: true },
    timing: Object.fromEntries(Object.entries(timing).map(([key, value]) => [key, Math.round(value)])),
    snapshotComponents: describeInventorySnapshotDigests(snapshot, snapshot.vectors), quality, arms };
}
