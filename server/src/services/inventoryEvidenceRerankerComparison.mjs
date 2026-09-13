/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { prepareDescriptionBenchmark, validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSample.mjs';
import { prepareInventoryRerankerRows, prepareInventoryRerankerTraining } from './inventoryEvidenceRerankerSample.mjs';
import { rankInventoryEvidence, selectInventoryEvidenceRecipe } from './inventoryEvidenceReranker.mjs';
import { createInventoryNeighborhoodIndex, INVENTORY_NEIGHBORHOOD_PROFILE_VERSION } from './inventoryNeighborhoodProfiles.mjs';
import { inventoryEvidenceLeaderState, rankInventoryNeighborhoodEvidence } from './inventoryNeighborhoodReranker.mjs';
import { createInventoryRepresentativeIndex, learnInventoryRepresentativeGroups, rankInventoryRepresentativeEvidence,
  INVENTORY_REPRESENTATIVE_VERSION } from './inventoryRepresentativeGroups.mjs';

const summarize = rows => ({ evaluated: rows.length, baselineAgreed: rows.filter(row => row.before).length,
  rerankerAgreed: rows.filter(row => row.after).length, gainedAgreement: rows.filter(row => !row.before && row.after).length,
  lostAgreement: rows.filter(row => row.before && !row.after).length, changed: rows.filter(row => row.changed).length });

/** Offline grouped comparison. No model generation, routing, policy or label writes. */
export async function runInventoryEvidenceRerankerComparison(snapshot, dimensions, settings,
  { signal, onProgress = () => {}, neighborhoodProfiles = false, representativeGroups = false } = {}) {
  const options = validateDescriptionBenchmarkOptions(settings);
  const abort = AbortSignal.any([AbortSignal.timeout(options.maxMinutes * 60000), ...(signal ? [signal] : [])]);
  if (!options.folds || options.generateCases) throw new Error('inventory_reranker_requires_grouped_zero_generation');
  if (neighborhoodProfiles && representativeGroups) throw new Error('inventory_reranker_representation_conflict');
  if (snapshot.corpus.texts.size * dimensions * (options.size + 100 * options.folds) > 20_000_000_000) {
    throw new Error('inventory_reranker_work_budget');
  }
  abort.throwIfAborted();
  const representativeIndex = representativeGroups ? createInventoryRepresentativeIndex(snapshot, dimensions, options.folds) : null;
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, dimensions, options, { includeComparisonEvidence: true });
  const rows = prepareInventoryRerankerRows(snapshot, prepared), results = [], selections = [];
  const index = neighborhoodProfiles ? createInventoryNeighborhoodIndex(snapshot.corpus.documents,
    snapshot.candidateMetadata, snapshot.libraries) : null;
  const neighborhood = { version: INVENTORY_NEIGHBORHOOD_PROFILE_VERSION, statuses: {}, candidatePools: 0,
    minimumSupport: null, maximumSupport: null };
  const representatives = { version: INVENTORY_REPRESENTATIVE_VERSION, statuses: {}, folds: [], elapsedFitMs: 0 };
  for (let fold = 0; fold < options.folds; fold++) {
    await setImmediate();
    abort.throwIfAborted();
    const outer = rows.filter(row => row.entry.foldIndex === fold);
    if (!outer.length) continue;
    const start = performance.now();
    const model = representativeGroups ? await learnInventoryRepresentativeGroups(representativeIndex, outer[0].entry.heldDescriptionHashes, { signal: abort }) : null;
    if (model) {
      representatives.elapsedFitMs += Math.round(performance.now() - start);
      representatives.folds.push({ fold: fold + 1, ...model.summary,
        libraries: prepared.libraryStrata.map(({ id, stratum }) => ({ stratum, ...model.coverage.get(id) })) });
    }
    const training = neighborhoodProfiles || representativeGroups ? [] : prepareInventoryRerankerTraining(snapshot, dimensions, options, outer[0].entry.heldDescriptionHashes);
    for (const mediaType of ['movie', 'tv']) {
      const libraryIds = snapshot.libraries.filter(library => library.media_type === mediaType).map(library => library.id);
      const selected = neighborhoodProfiles || representativeGroups ? null : selectInventoryEvidenceRecipe(training.filter(row => row.entry.mediaType === mediaType), libraryIds);
      if (selected && outer.some(row => row.entry.mediaType === mediaType)) selections.push({ fold: fold + 1, mediaType, ...selected });
      for (const row of outer.filter(row => row.entry.mediaType === mediaType && row.candidates.length)) {
        const before = rankInventoryEvidence(row.candidates)[0];
        const local = model ? { ...rankInventoryRepresentativeEvidence(model, row), support: [] } : neighborhoodProfiles ? rankInventoryNeighborhoodEvidence(index, row,
          snapshot.candidateMetadata?.get(`${row.entry.mediaType}:${row.entry.itemIdentity.tmdbId}`)) : null;
        const after = local ? local.ranking[0] : rankInventoryEvidence(row.candidates, selected.recipe)[0];
        if (local) {
          const statuses = model ? representatives.statuses : neighborhood.statuses;
          statuses[local.status] = (statuses[local.status] ?? 0) + 1;
          if (local.support.length) {
            neighborhood.candidatePools++;
            neighborhood.minimumSupport = Math.min(neighborhood.minimumSupport ?? Infinity, ...local.support);
            neighborhood.maximumSupport = Math.max(neighborhood.maximumSupport ?? 0, ...local.support);
          }
        }
        const consensus = inventoryEvidenceLeaderState(row.candidates) === 'consensus';
        results.push({ mediaType, memberships: row.observedLibraryIds, consensus,
          before: row.observedLibraryIds.includes(before), after: row.observedLibraryIds.includes(after), changed: before !== after });
      }
    }
    onProgress({ stage: 'evidence_reranker', completedFolds: fold + 1, folds: options.folds, evaluated: results.length });
  }
  await setImmediate();
  abort.throwIfAborted();
  return { version: 1, protocol: representativeGroups ? INVENTORY_REPRESENTATIVE_VERSION : neighborhoodProfiles ? INVENTORY_NEIGHBORHOOD_PROFILE_VERSION : 'inventory_evidence_reranker_v1',
    ...(representativeGroups ? { representatives } : {}),
    ...(neighborhoodProfiles ? { neighborhood } : {}), status: 'complete', seed: options.seed,
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
