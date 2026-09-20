/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { memoryUsage, resourceUsage } from 'node:process';
import { validateDescriptionBenchmarkOptions, selectAdditionalDescriptionBenchmarkSample } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';
import { prepareLinearRankerSource, selectLinearRankerTraining, buildLinearRankerMatrix, describeLinearRankerInputs } from './inventoryLinearRankerSource.mjs';
import { LINEAR_RANKER_SETTINGS, validateLinearTraining } from './inventoryLinearRankerMath.mjs';
import { fitLinearRanker } from './inventoryLinearRankerFit.mjs';
import { learnInventoryProfiles } from './inventoryLearnedProfiles.mjs';
import { perturbLinearTraining, compareLinearRankers, createLinearRankerMetrics } from './inventoryLinearRankerComparison.mjs';

/** Observational evaluation only. No learned weights, labels or decisions leave this runner. */
export async function runInventoryLinearRankerBenchmark(snapshot, dimensions, rawOptions, { signal, onProgress, fit = fitLinearRanker } = {}) {
  const options = validateDescriptionBenchmarkOptions(rawOptions);
  if (!options.folds || options.generateCases) throw new Error('linear_ranker_requires_exclusive_grouped_zero_generation');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60_000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  const source = prepareLinearRankerSource(snapshot, dimensions);
  const selection = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options), sample = selection.sample;
  const folds = planDescriptionBenchmarkFolds(snapshot.corpus, sample, snapshot.libraries, options);
  const metrics = createLinearRankerMetrics(snapshot.libraries), fits = [];
  const training = folds.held.map(held => selectLinearRankerTraining(source, held));
  // Bound all fitting before starting any worker; include the initial objective pass.
  const worstWork = training.reduce((sum, { documents }) => sum + ['movie', 'tv'].reduce((work, type) => {
    const rows = documents.filter(doc => doc.type === type), classes = new Set(rows.map(doc => doc.libraryIds[0])).size;
    const components = rows.length * dimensions * classes * 2 * (LINEAR_RANKER_SETTINGS.epochs + 1);
    if (classes >= 2 && components > LINEAR_RANKER_SETTINGS.maxFitComponents) throw new Error('inventory_linear_fit_work_budget');
    return work + (classes >= 2 ? components * 2 : 0);
  }, 0), 0);
  if (worstWork > LINEAR_RANKER_SETTINGS.maxBenchmarkComponents) throw new Error('inventory_linear_benchmark_work_budget');
  for (let fold = 0; fold < options.folds; fold++) {
    abort.throwIfAborted();
    if (!folds.held[fold].size) continue;
    const { documents, counts } = training[fold];
    const profile = learnInventoryProfiles(documents, source.metadata, [...source.libraries.values()]);
    for (const type of ['movie', 'tv']) {
      abort.throwIfAborted();
      const queries = sample.filter(doc => doc.type === type && folds.foldByHash.get(doc.hash) === fold);
      if (!queries.length) continue;
      const input = buildLinearRankerMatrix(source, documents, type), started = performance.now();
      let clean = null, noisy = null, changed = 0;
      if (input.classes.length >= 2) {
        const numericInput = { ...input, classCount: input.classes.length };
        validateLinearTraining(numericInput);
        clean = await fit(numericInput, { signal: abort });
        abort.throwIfAborted();
        const perturbation = perturbLinearTraining(input, documents.filter(doc => doc.type === type), options.seed);
        changed = perturbation.changed;
        noisy = await fit({ ...numericInput, labels: perturbation.labels }, { signal: abort });
      }
      abort.throwIfAborted();
      const summary = { fold: fold + 1, mediaType: type, status: clean ? 'available' : 'insufficient_classes',
        trainingDescriptions: input.labels.length, trainedClasses: input.classes.length, perturbedLabels: changed,
        exclusionsAcrossMedia: counts, clean: clean?.summary ?? null, noisy: noisy?.summary ?? null,
        fitMs: Math.round(performance.now() - started), memory: { ...memoryUsage(), maxRSSKiB: resourceUsage().maxRSS } };
      fits.push(summary);
      for (const doc of queries) {
        abort.throwIfAborted();
        const choices = compareLinearRankers(input, source.vectors.get(doc.hash), source.metadata.get(doc.key), profile, clean, noisy);
        metrics.record(doc, choices, input.classes, source.exclusions.has(doc.key));
      }
      onProgress?.({ stage: 'linear_ranker_fold', ...summary });
    }
  }
  const trainingComplete = fits.length > 0 && fits.every(row => row.status === 'available');
  return { protocol: 'inventory_linear_ranker_v1', status: trainingComplete ? 'complete' : 'completed_with_errors',
    trainingComplete, calls: 0, seed: options.seed,
    settings: { ...LINEAR_RANKER_SETTINGS, labelNoiseFraction: 0.1 }, independentLabels: 0, accuracy: null,
    livePromotionAllowed: false, observedPlacementIsGroundTruth: false, provenanceComplete: false,
    metric: 'held_out_placement_agreement_not_verified_accuracy', sampledDescriptions: sample.length,
    sampleShortfall: options.size - sample.length, sampleFingerprint: createHash('sha256').update(JSON.stringify(sample.map(doc => doc.key))).digest('hex'),
    excludedPriorDescriptions: selection.excluded.size,
    evaluation: { ...folds.summary, priorCohortSizes: selection.priorCohortSizes, priorSampleFingerprints: selection.priorSampleFingerprints,
      priorItemsAvailableForTraining: true, trainingHistoryExclusion: 'decisions_reconciliations_unknown_capture',
      legacySourceObservations: 'weak_labels_not_independently_verified',
      candidateSelection: 'all_admitted_same_media_classes', baselinePopulation: 'same_admitted_descriptions',
      rawBaseline: 'maximum_cosine_per_library', metadataBaseline: 'existing_organic_field_score',
      noise: 'floor_ten_percent_per_class_seeded_hash_order_next_class', worstFitWorkComponents: worstWork },
    snapshotComponents: describeLinearRankerInputs(snapshot), fits, comparison: metrics.read() };
}
