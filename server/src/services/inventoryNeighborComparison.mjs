/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { prepareDescriptionBenchmark, validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSample.mjs';
import { createInventoryNeighborCalibration } from './inventoryNeighborCalibration.mjs';
import { NEIGHBOR_MARGIN_VERSION, NEIGHBOR_MARGIN_LIMITS } from './libraryNeighborMargin.mjs';
import { summarizeNeighborComparison } from './inventoryNeighborComparisonReport.mjs';

function fullCorpusCheck(entry, texts) {
  const [selected, ...others] = entry.investigationCandidates;
  const complete = others.length > 0 && entry.investigationCandidates.every(candidate => candidate.items.length >= 3);
  const unique = complete && selected.rank > others[0].rank;
  const normalized = hash => texts.get(hash).trim().toLowerCase();
  const otherDescriptions = new Set(others.flatMap(candidate => candidate.items.slice(0, 3).map(item => normalized(item.hash))));
  const items = selected?.items.slice(0, 3) ?? [];
  const shared = unique && items.some(item => item.libraryIds.size > 1 || otherDescriptions.has(normalized(item.hash)));
  const strict = unique && !shared && Math.min(...items.map(item => item.similarity)) >
    Math.max(...others.flatMap(candidate => candidate.items.slice(0, 3).map(item => item.similarity)));
  return { selected: unique ? selected.id : null, shared, strict };
}

/** Paired, held-out neighbor-only experiment. No generation, policies, receipts, or routing. */
export async function runInventoryNeighborComparison(snapshot, representation, rawOptions, { signal, onProgress } = {}) {
  const options = validateDescriptionBenchmarkOptions(rawOptions);
  if (!options.folds || options.generateCases) throw new Error('neighbor_comparison_requires_folds_without_generation');
  signal?.throwIfAborted();
  const calibration = createInventoryNeighborCalibration({ documents: snapshot.corpus.documents,
    libraries: snapshot.libraries, vectors: snapshot.vectors, representation });
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, representation.dimensions, options,
    { includeComparisonEvidence: true });
  const rows = [], coverage = new Map();
  const strata = new Map(prepared.libraryStrata.map(row => [row.id, row.stratum]));
  let status = 'complete';
  try {
    for (const entry of prepared.cases) {
      signal?.throwIfAborted();
      const full = fullCorpusCheck(entry, prepared.texts);
      const assessment = await calibration.assess(entry, { signal });
      for (const candidate of assessment.candidates) {
        const stratum = strata.get(candidate.libraryId), fold = entry.foldIndex + 1;
        coverage.set(`${fold}:${stratum}`, { fold, stratum, mediaType: entry.mediaType, status: candidate.status,
          referenceDescriptions: candidate.referenceDescriptions, calibrationDescriptions: candidate.calibrationDescriptions });
      }
      const selected = assessment.candidates.find(candidate => candidate.libraryId === full.selected);
      const referenceAvailable = selected?.referenceComplete === true;
      const calibratedAvailable = selected?.status === 'available';
      rows.push({ mediaType: entry.mediaType, strata: entry.observedLibraryIds.map(id => strata.get(id)),
        proposed: full.selected !== null, shared: full.shared, placementAgreement: entry.observedLibraryIds.includes(full.selected),
        arms: {
          full_strict: { available: full.selected !== null, support: full.strict },
          reference_strict: { available: referenceAvailable, support: referenceAvailable && !full.shared && selected.strict },
          reference_mean: { available: referenceAvailable, support: referenceAvailable && !full.shared && selected.mean },
          reference_calibrated: { available: calibratedAvailable, support: calibratedAvailable && !full.shared && selected.calibrated },
        } });
      onProgress?.({ protocol: 'inventory_neighbor_comparison_v1', completed: rows.length, total: prepared.cases.length });
      await setImmediate(undefined, { signal });
    }
  } catch (error) {
    if (!signal?.aborted) throw error;
    status = 'interrupted';
  }
  return { protocol: 'inventory_neighbor_comparison_v1', status, calls: 0, requestedTitles: options.size,
    sampledTitles: prepared.cases.length, sampleShortfall: options.size - prepared.cases.length,
    sampleFingerprint: prepared.sampleFingerprint, snapshotFingerprint: prepared.fingerprint,
    evaluation: prepared.evaluation, calibration: { version: NEIGHBOR_MARGIN_VERSION, limits: NEIGHBOR_MARGIN_LIMITS,
      coverage: [...coverage.values()].sort((a, b) => a.fold - b.fold || a.stratum - b.stratum) },
    ...summarizeNeighborComparison(rows),
    byMedia: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarizeNeighborComparison(rows.filter(row => row.mediaType === mediaType)) })),
    byLibrary: prepared.libraryStrata.map(({ stratum }) => ({ stratum,
      ...summarizeNeighborComparison(rows.filter(row => row.strata.includes(stratum))) })),
    independentLabels: 0, accuracy: null, observedPlacementIsGroundTruth: false, livePromotionAllowed: false,
    liveRoutingChanged: false, userQuestionsCreated: 0 };
}
