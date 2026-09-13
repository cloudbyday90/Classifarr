/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { prepareDescriptionBenchmark, validateDescriptionBenchmarkOptions } from './inventoryDescriptionBenchmarkSample.mjs';
import { createInventoryNeighborCalibration } from './inventoryNeighborCalibration.mjs';
import { NEIGHBOR_MARGIN_VERSION, NEIGHBOR_MARGIN_LIMITS } from './libraryNeighborMargin.mjs';
import { NEIGHBOR_CROSS_FIT_VERSION, NEIGHBOR_CROSS_FIT_LIMITS } from './libraryNeighborCrossFit.mjs';
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
export async function runInventoryNeighborComparison(snapshot, representation, rawOptions, { signal, onProgress, crossFit = false } = {}) {
  const options = validateDescriptionBenchmarkOptions(rawOptions);
  if (!options.folds || options.generateCases) throw new Error('neighbor_comparison_requires_folds_without_generation');
  signal?.throwIfAborted();
  if (typeof crossFit !== 'boolean') throw new Error('neighbor_calibration_mode_invalid');
  const input = { documents: snapshot.corpus.documents, libraries: snapshot.libraries, vectors: snapshot.vectors, representation };
  const calibration = createInventoryNeighborCalibration(input);
  const crossFitCalibration = crossFit ? createInventoryNeighborCalibration(input, { crossFit: true }) : null;
  const prepared = prepareDescriptionBenchmark(snapshot, snapshot.vectors, representation.dimensions, options,
    { includeComparisonEvidence: true });
  const rows = [], coverage = new Map(), crossFitCoverage = new Map();
  const strata = new Map(prepared.libraryStrata.map(row => [row.id, row.stratum]));
  const protocol = crossFit ? 'inventory_neighbor_comparison_v2' : 'inventory_neighbor_comparison_v1';
  const summarize = rows => summarizeNeighborComparison(rows, { crossFit });
  const recordCoverage = (entry, assessment, target) => {
    for (const candidate of assessment.candidates) {
      const stratum = strata.get(candidate.libraryId), fold = entry.foldIndex + 1;
      target.set(`${fold}:${stratum}`, { fold, stratum, mediaType: entry.mediaType, status: candidate.status,
        referenceDescriptions: candidate.referenceDescriptions, calibrationDescriptions: candidate.calibrationDescriptions,
        ...(candidate.minimumCalibrationReferences === undefined ? {} : { minimumCalibrationReferences: candidate.minimumCalibrationReferences }) });
    }
  };
  let status = 'complete';
  try {
    for (const entry of prepared.cases) {
      signal?.throwIfAborted();
      const full = fullCorpusCheck(entry, prepared.texts);
      const assessment = await calibration.assess(entry, { signal });
      recordCoverage(entry, assessment, coverage);
      const crossAssessment = crossFit ? await crossFitCalibration.assess(entry, { signal }) : null;
      if (crossAssessment) recordCoverage(entry, crossAssessment, crossFitCoverage);
      const crossSelected = crossAssessment?.candidates.find(candidate => candidate.libraryId === full.selected);
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
          ...(crossFit ? Object.fromEntries(['strict', 'mean', 'calibrated'].map(kind => {
            const available = kind === 'calibrated' ? crossSelected?.status === 'available' : crossSelected?.referenceComplete === true;
            return [`cross_fit_${kind}`, { available, support: available && !full.shared && crossSelected[kind] }];
          })) : {}),
        } });
      onProgress?.({ protocol, completed: rows.length, total: prepared.cases.length });
      await setImmediate(undefined, { signal });
    }
  } catch (error) {
    if (!signal?.aborted) throw error;
    status = 'interrupted';
  }
  const orderedCoverage = map => [...map.values()].sort((a, b) => a.fold - b.fold || a.stratum - b.stratum);
  return { protocol, status, calls: 0, requestedTitles: options.size,
    sampledTitles: prepared.cases.length, sampleShortfall: options.size - prepared.cases.length,
    sampleFingerprint: prepared.sampleFingerprint, snapshotFingerprint: prepared.fingerprint,
    evaluation: prepared.evaluation, calibration: { version: NEIGHBOR_MARGIN_VERSION, limits: NEIGHBOR_MARGIN_LIMITS,
      coverage: orderedCoverage(coverage) },
    ...(crossFit ? { crossFitCalibration: { version: NEIGHBOR_CROSS_FIT_VERSION, limits: NEIGHBOR_CROSS_FIT_LIMITS,
      coverage: orderedCoverage(crossFitCoverage) } } : {}),
    ...summarize(rows),
    byMedia: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarize(rows.filter(row => row.mediaType === mediaType)) })),
    byLibrary: prepared.libraryStrata.map(({ stratum }) => ({ stratum,
      ...summarize(rows.filter(row => row.strata.includes(stratum))) })),
    independentLabels: 0, accuracy: null, observedPlacementIsGroundTruth: false, livePromotionAllowed: false,
    liveRoutingChanged: false, userQuestionsCreated: 0 };
}
