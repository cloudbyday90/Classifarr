/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { prepareDescriptionBenchmark, validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSample.mjs';
import { prepareInventoryRerankerRows, prepareInventoryRerankerTraining } from './inventoryEvidenceRerankerSample.mjs';
import { rankInventoryEvidence, selectInventoryEvidenceRecipe } from './inventoryEvidenceReranker.mjs';

const summarize = rows => ({ evaluated: rows.length, baselineAgreed: rows.filter(row => row.before).length,
  rerankerAgreed: rows.filter(row => row.after).length, gainedAgreement: rows.filter(row => !row.before && row.after).length,
  lostAgreement: rows.filter(row => row.before && !row.after).length, changed: rows.filter(row => row.changed).length });

/** Offline nested comparison. No model generation, routing, policy or label writes. */
export async function runInventoryEvidenceRerankerComparison(snapshot, dimensions, settings,
  { signal, onProgress = () => {} } = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60000), ...(signal ? [signal] : [])]);
  if (!options.folds || options.generateCases) throw new Error('inventory_reranker_requires_grouped_zero_generation');
  if (snapshot.corpus.texts.size * dimensions * (options.size + 100 * options.folds) > 20_000_000_000) {
    throw new Error('inventory_reranker_work_budget');
  }
  abort.throwIfAborted();
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, dimensions, options, { includeComparisonEvidence: true });
  const rows = prepareInventoryRerankerRows(snapshot, prepared), results = [], selections = [];
  for (let fold = 0; fold < options.folds; fold++) {
    await setImmediate();
    abort.throwIfAborted();
    const outer = rows.filter(row => row.entry.foldIndex === fold);
    if (!outer.length) continue;
    const training = prepareInventoryRerankerTraining(snapshot, dimensions, options, outer[0].entry.heldDescriptionHashes);
    for (const mediaType of ['movie', 'tv']) {
      const libraryIds = snapshot.libraries.filter(library => library.media_type === mediaType).map(library => library.id);
      const selected = selectInventoryEvidenceRecipe(training.filter(row => row.entry.mediaType === mediaType), libraryIds);
      if (outer.some(row => row.entry.mediaType === mediaType)) selections.push({ fold: fold + 1, mediaType, ...selected });
      for (const row of outer.filter(row => row.entry.mediaType === mediaType && row.candidates.length)) {
        const before = rankInventoryEvidence(row.candidates)[0], after = rankInventoryEvidence(row.candidates, selected.recipe)[0];
        const description = [...row.candidates].sort((a, b) => b.description - a.description);
        const metadata = [...row.candidates].sort((a, b) => b.profileFit - a.profileFit);
        const consensus = description[0].id === metadata[0].id && metadata[0].profileFit > 0 &&
          description[0].description > description[1].description && metadata[0].profileFit > metadata[1].profileFit;
        results.push({ mediaType, memberships: row.observedLibraryIds, consensus,
          before: row.observedLibraryIds.includes(before), after: row.observedLibraryIds.includes(after), changed: before !== after });
      }
    }
    onProgress({ stage: 'evidence_reranker', completedFolds: fold + 1, folds: options.folds, evaluated: results.length });
  }
  await setImmediate();
  abort.throwIfAborted();
  return { version: 1, protocol: 'inventory_evidence_reranker_v1', status: 'complete', seed: options.seed,
    sampleFingerprint: prepared.sampleFingerprint, snapshotFingerprint: prepared.fingerprint,
    snapshotComponents: prepared.snapshotComponents, evaluation: prepared.evaluation,
    sampledTitles: prepared.cases.length, sampleShortfall: Math.max(0, options.size - prepared.cases.length),
    incompleteEvidence: rows.filter(row => !row.candidates.length).length, calls: 0, arms: [], selections,
    comparison: summarize(results), consensusControls: summarize(results.filter(row => row.consensus)),
    disagreements: summarize(results.filter(row => !row.consensus)),
    media: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarize(results.filter(row => row.mediaType === mediaType)) })),
    libraries: prepared.libraryStrata.map(({ id, stratum }) => ({ stratum,
      ...summarize(results.filter(row => row.memberships.includes(id))) })),
    independentLabels: 0, accuracy: null, observedPlacementIsGroundTruth: false,
    liveRoutingChanged: false, livePromotionAllowed: false, userQuestionsCreated: 0, verifiedLabelsCreated: 0 };
}
