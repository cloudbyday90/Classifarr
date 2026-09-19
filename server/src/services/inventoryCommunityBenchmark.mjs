/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setImmediate } from 'node:timers/promises';
import { validateDescriptionBenchmarkOptions, selectAdditionalDescriptionBenchmarkSample } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { assertRepresentativeSnapshotBudget } from './inventoryRepresentativeCoverage.mjs';
import { REPRESENTATIVE_RECOVERY_WORK_COMPONENTS } from './inventoryRepresentativeStability.mjs';
import { fitInventoryRepresentativeProfile } from './inventoryRepresentativeProfileFit.mjs';
import { coverageTrainingSnapshot } from './inventoryCoverageMasks.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { readGroupBenchmarkControl } from './inventoryGroupBenchmarkControl.mjs';
import { discoverCommunityParticipation, communityEvidenceDecision } from './inventoryCommunityParticipation.mjs';
import { measureGroupQuality, compareNearestGroups, measureSmallGroupRetention } from './inventoryGroupQuality.mjs';
import { createCoverageMetrics, recordCoverageDecision } from './inventoryCoverageMetrics.mjs';

/** Frozen, zero-inference experiment. Aggregate-only output; never authorizes a route. */
export async function runInventoryCommunityBenchmark(snapshot, dimensions, rawOptions, { signal, onProgress,
  fit = fitInventoryRepresentativeProfile } = {}) {
  const options = validateDescriptionBenchmarkOptions(rawOptions);
  if (!options.folds || options.generateCases) throw new Error('local_communities_require_grouped_zero_generation');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60_000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  assertRepresentativeSnapshotBudget(snapshot, dimensions);
  const n = snapshot.corpus.texts.size;
  // Conservative upper bound: all hashes in both media scopes, control and summaries.
  const work = (n * (n - 1) + snapshot.corpus.documents.length * (REPRESENTATIVE_RECOVERY_WORK_COMPONENTS + 256)) * dimensions * options.folds;
  if (work > 400_000_000_000) throw new Error('local_communities_work_budget');
  if (snapshot.vectors.size !== n) throw new Error('local_communities_complete_cache_required');
  for (const hash of snapshot.corpus.texts.keys()) normalizeDescriptionVector(snapshot.vectors.get(hash), dimensions);
  const selection = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options), sample = selection.sample;
  const folds = planDescriptionBenchmarkFolds(snapshot.corpus, sample, snapshot.libraries, options);
  const strata = [...snapshot.libraries].sort((a, b) => a.id - b.id);
  const arms = ['fixed_groups', 'community_geometry', 'community_supported'].map(name => ({ name, ...createCoverageMetrics(),
    mediaTypes: ['movie', 'tv'].map(mediaType => ({ mediaType, ...createCoverageMetrics() })),
    libraries: strata.map((library, index) => ({ stratum: index + 1, mediaType: library.media_type, ...createCoverageMetrics() })) }));
  const quality = [], discovery = [], timing = { controlMs: 0, communityMs: 0 };
  for (let fold = 0; fold < options.folds; fold++) {
    abort.throwIfAborted();
    const training = coverageTrainingSnapshot(snapshot, folds.held[fold]);
    let started = performance.now();
    const model = await fit(training, dimensions, { signal: abort });
    timing.controlMs += performance.now() - started;
    const { index, buckets, libraries: control } = await readGroupBenchmarkControl(training, model, dimensions, abort);
    started = performance.now();
    const communities = await discoverCommunityParticipation(index, training.vectors, dimensions, abort);
    timing.communityMs += performance.now() - started;
    for (const [mediaType, media] of communities.media) discovery.push({ fold: fold + 1, mediaType,
      ...await measureGroupQuality(media.fitted.groups, media.rows, abort, { includeMargins: false }),
      sharedDescriptions: media.sharedDescriptions, sharedAssigned: media.sharedAssigned,
      projectedDescriptions: media.projected.size, graph: media.fitted.diagnostics });
    for (const [stratum, library] of strata.entries()) {
      const baseline = control.find(row => row.id === library.id), treatment = communities.libraries.find(row => row.id === library.id);
      const items = buckets.get(library.id);
      quality.push({ fold: fold + 1, stratum: stratum + 1, mediaType: library.media_type, controlAvailable: baseline.available,
        control: await measureGroupQuality(baseline.groups, items, abort, { includeMargins: false }),
        communities: await measureGroupQuality(treatment.groups, items, abort, { includeMargins: false }),
        smallestControlGroups: measureSmallGroupRetention(baseline.groups, treatment.groups) });
    }
    for (const doc of sample.filter(row => folds.foldByHash.get(row.hash) === fold)) {
      await setImmediate();
      abort.throwIfAborted();
      const vector = normalizeDescriptionVector(snapshot.vectors.get(doc.hash), dimensions);
      const geometry = compareNearestGroups(communities.libraries, doc.type, vector, doc.libraryIds);
      const decisions = [compareNearestGroups(control, doc.type, vector, doc.libraryIds), geometry,
        communityEvidenceDecision(communities.media.get(doc.type), vector, geometry)];
      arms.forEach((arm, i) => {
        recordCoverageDecision(arm, decisions[i], decisions[0]);
        recordCoverageDecision(arm.mediaTypes.find(row => row.mediaType === doc.type), decisions[i], decisions[0]);
        strata.forEach((library, stratum) => {
          if (doc.libraryIds.includes(library.id)) recordCoverageDecision(arm.libraries[stratum], decisions[i], decisions[0]);
        });
      });
    }
    onProgress?.({ stage: 'local_communities', fold: fold + 1, evaluated: arms[0].evaluated });
  }
  abort.throwIfAborted();
  return { protocol: 'inventory_local_communities_v1', status: 'complete', calls: 0, independentLabels: 0, accuracy: null,
    observedPlacementIsGroundTruth: false, livePromotionAllowed: false, metric: 'nearest_group_placement_agreement_not_routing_accuracy',
    sampledDescriptions: sample.length, sampleShortfall: options.size - sample.length,
    sampleFingerprint: createHash('sha256').update(JSON.stringify(sample.map(doc => doc.key))).digest('hex'),
    excludedPriorDescriptions: selection.excluded.size, evaluation: { ...folds.summary, priorCohortSizes: selection.priorCohortSizes,
      priorSampleFingerprints: selection.priorSampleFingerprints, previousSampleOverlap: sample.filter(doc => selection.excluded.has(doc.hash)).length,
      priorItemsAvailableForTraining: true, geometryIsDiagnosticOnly: true },
    timing: Object.fromEntries(Object.entries(timing).map(([key, value]) => [key, Math.round(value)])),
    snapshotComponents: describeInventorySnapshotDigests(snapshot, snapshot.vectors), quality, discovery, arms };
}
