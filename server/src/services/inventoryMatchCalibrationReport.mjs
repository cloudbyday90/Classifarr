/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { LIBRARY_MATCH_BASELINE_VERSION, LIBRARY_MATCH_BASELINE_LIMITS } from './libraryMatchBaseline.mjs';

const states = values => Object.fromEntries(['familiar', 'unusual', 'sparse', 'degenerate'].map(status =>
  [status, values.filter(value => value?.status === status).length]));

/** Describe paired qualification and weak placement labels without exporting content or IDs. */
export function summarizeInventoryMatchCalibration(rows) {
  const prepared = rows.filter(row => row.prepared.matchCalibration?.version === LIBRARY_MATCH_BASELINE_VERSION);
  const candidates = prepared.flatMap(row => row.prepared.matchCalibration.candidates);
  const observed = prepared.flatMap(row => row.prepared.matchCalibration.candidates
    .filter(candidate => row.sample.observedLibraryIds.includes(candidate.libraryId)));
  const proposed = prepared.filter(row => row.generated?.status === 'proposed');
  const selected = row => row.prepared.matchCalibration.candidates.find(candidate => candidate.libraryId === row.generated.destinationId);
  const before = proposed.filter(row => row.generated.learnedReview?.wouldResolve === true);
  const qualified = before.filter(row => selected(row)?.status === 'familiar');
  const agrees = row => row.sample.observedLibraryIds.includes(row.generated.destinationId);
  const fits = new Map();
  for (const row of prepared) for (const candidate of row.prepared.matchCalibration.candidates) {
    fits.set(`${row.prepared.matchCalibration.snapshotId}:${candidate.libraryId}`, candidate);
  }
  const trained = [...fits.values()].filter(candidate => candidate.calibrationDescriptions > 0);
  return { version: LIBRARY_MATCH_BASELINE_VERSION, sampled: prepared.length, candidateStates: states(candidates),
    observedPlacementStates: states(observed), proposalStates: states(proposed.map(selected)),
    beforeNoveltyCheck: before.length, afterNoveltyCheck: qualified.length,
    withheldStates: states(before.filter(row => selected(row)?.status !== 'familiar').map(selected)),
    placementAgreement: qualified.filter(agrees).length, placementDisagreement: qualified.filter(row => !agrees(row)).length,
    policyLeaderDisagreement: qualified.filter(row => row.generated.destinationId !== row.prepared.policyResult.ranked[0]?.library_id).length,
    libraryFoldModels: fits.size, trainedLibraryFoldModels: trained.length,
    minimumReferenceDescriptions: trained.length ? Math.min(...trained.map(candidate => candidate.referenceDescriptions)) : null,
    minimumCalibrationDescriptions: trained.length ? Math.min(...trained.map(candidate => candidate.calibrationDescriptions)) : null,
    tailFraction: LIBRARY_MATCH_BASELINE_LIMITS.tail, probabilityCalibrated: false, livePromotionAllowed: false };
}
