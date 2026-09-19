/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateDescriptionBenchmarkOptions, selectAdditionalDescriptionBenchmarkSample } from './inventoryDescriptionBenchmarkSelection.mjs';
import { planDescriptionBenchmarkFolds } from './inventoryDescriptionBenchmarkFolds.mjs';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { assertRepresentativeSnapshotBudget } from './inventoryRepresentativeCoverage.mjs';
import { REPRESENTATIVE_RECOVERY_WORK_COMPONENTS } from './inventoryRepresentativeStability.mjs';
import { createMultiScaleProfileLoader } from './inventoryMultiScaleCache.mjs';
import { prepareMultiScaleAiCase, buildMultiScaleAiPrompt } from './inventoryMultiScaleAiCase.mjs';
import { createMultiScaleAiInference } from './inventoryMultiScaleAiInference.mjs';
import { createMultiScaleAiMetrics } from './inventoryMultiScaleAiMetrics.mjs';
import { DESCRIPTION_BENCHMARK_OUTPUT_TOKENS } from './localDescriptionBenchmarkClient.mjs';

/** Content-only paired experiment. It cannot persist learned state or authorize media routing. */
export async function runInventoryMultiScaleAiBenchmark(snapshot, representation, rawOptions, { signal, onProgress,
  client, identity, createLoader = createMultiScaleProfileLoader } = {}) {
  const options = validateDescriptionBenchmarkOptions(rawOptions), dimensions = representation.dimensions;
  if (!options.folds || options.generateCases > 100) throw new Error('multi_scale_ai_requires_grouped_bounded_mode');
  if (options.generateCases && (!client || !identity || options.context > identity.contextLength)) throw new Error('multi_scale_ai_local_model_required');
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60_000), ...(signal ? [signal] : [])]);
  abort.throwIfAborted();
  assertRepresentativeSnapshotBudget(snapshot, dimensions);
  const n = snapshot.corpus.texts.size;
  if ((n * (n - 1) + snapshot.corpus.documents.length * (REPRESENTATIVE_RECOVERY_WORK_COMPONENTS + 256)) * dimensions * options.folds > 400_000_000_000) {
    throw new Error('multi_scale_ai_work_budget');
  }
  const selection = selectAdditionalDescriptionBenchmarkSample(snapshot.corpus, options), sample = selection.sample;
  const folds = planDescriptionBenchmarkFolds(snapshot.corpus, sample, snapshot.libraries, options);
  const metrics = createMultiScaleAiMetrics(snapshot.libraries), packets = new Map(), loader = createLoader();
  const inference = createMultiScaleAiInference(options, { client, identity, signal: abort, onProgress });
  let packetBytes = 0;
  const profiles = [];
  try {
    // Finish fitting/preflight before sending any query to the local generation model.
    for (let fold = 0; fold < options.folds; fold++) {
      abort.throwIfAborted();
      if (!folds.held[fold].size) continue;
      const started = performance.now();
      const { profile } = await loader.load(snapshot, representation, { held: folds.held[fold], signal: abort });
      const summary = profile.summary();
      profiles.push({ fold: fold + 1, localStatus: summary.localStatus, fitMs: Math.round(performance.now() - started),
        ...(['time_budget', 'invalid_groups', 'discovery_failed'].includes(summary.localFailureReason)
          ? { localFailureReason: summary.localFailureReason } : {}) });
      for (const doc of sample.filter(row => folds.foldByHash.get(row.hash) === fold)) {
        const result = await profile.retrieve({ type: doc.type, hash: doc.hash, vector: snapshot.vectors.get(doc.hash) }, abort);
        const plan = prepareMultiScaleAiCase(snapshot, doc, folds.held[fold], result);
        const prompts = plan.status === 'ready' ? [false, true].map(enhanced => [false, true].map(reverse => buildMultiScaleAiPrompt(plan, enhanced, reverse))) : [];
        const bytes = prompts.flat().map(prompt => Buffer.byteLength(prompt));
        const overBudget = bytes.some(value => value > (options.context - DESCRIPTION_BENCHMARK_OUTPUT_TOKENS) * 3);
        metrics.prepare(doc, plan, overBudget);
        // Preserve the sample's round-robin order, not fold order or favorable model outcomes.
        if (plan.status === 'ready' && !overBudget && sample.indexOf(doc) < options.generateCases) {
          packetBytes += bytes.reduce((sum, value) => sum + value, 0);
          if (packetBytes > 64 * 1024 * 1024) throw new Error('multi_scale_ai_packet_budget');
          packets.set(doc.hash, { plan, prompts });
        }
      }
      onProgress?.({ stage: 'multi_scale_ai_preflight', ...profiles.at(-1), prepared: metrics.read().sampled });
    }
  } finally { loader.clear(); }
  const contextComplete = profiles.every(profile => profile.localStatus === 'available');
  for (const [ordinal, doc] of (contextComplete ? sample.slice(0, options.generateCases) : []).entries()) {
    const packet = packets.get(doc.hash);
    if (!packet) continue;
    const choices = await inference.compare(packet.plan, packet.prompts, ordinal);
    if (choices) metrics.record(doc, choices);
    if (abort.aborted || inference.read().status === 'completed_with_errors') break;
  }
  const measurement = { ...inference.read(), ...(!contextComplete ? { status: 'not_run_incomplete_context' } : {}) }, totals = metrics.read();
  return { protocol: 'inventory_multi_scale_ai_v1', status: contextComplete ? measurement.status : 'completed_with_errors',
    contextComplete, calls: measurement.calls,
    seed: options.seed, independentLabels: 0, accuracy: null, livePromotionAllowed: false, observedPlacementIsGroundTruth: false,
    metric: 'paired_content_choice_not_verified_routing_accuracy', sampledDescriptions: sample.length,
    sampleShortfall: options.size - sample.length, availableGenerationCases: packets.size,
    generationShortfall: options.generateCases - measurement.completePairs,
    sampleFingerprint: createHash('sha256').update(JSON.stringify(sample.map(doc => doc.key))).digest('hex'),
    generationSampleFingerprint: createHash('sha256').update(JSON.stringify(sample.slice(0, options.generateCases).map(doc => doc.key))).digest('hex'),
    excludedPriorDescriptions: selection.excluded.size, evaluation: { ...folds.summary, priorCohortSizes: selection.priorCohortSizes,
      priorSampleFingerprints: selection.priorSampleFingerprints, priorItemsAvailableForTraining: true,
      candidateSelection: 'top_three_raw_similarity_without_observed_destination', anonymousCandidates: true,
      productionPolicyReplay: false, candidateOrders: 2, armsPerCase: 2 },
    snapshotComponents: describeInventorySnapshotDigests(snapshot, snapshot.vectors), profiles,
    comparison: totals, inference: measurement,
    arms: measurement.arms.map((arm, index) => ({ ...arm, ...totals.arms[index], estimatedInputBudgetExceeded: totals.contextBudgetExceeded })) };
}
