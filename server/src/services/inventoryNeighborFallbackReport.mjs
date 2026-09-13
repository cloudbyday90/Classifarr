/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_NEIGHBOR_FALLBACK_VERSION, isInventoryNeighborFallbackTarget } from './inventoryNeighborFallback.mjs';
import { LIBRARY_MATCH_BASELINE_VERSION } from './libraryMatchBaseline.mjs';

/** Aggregate weak-label outcomes only. Missing inference is never a failed or successful review. */
export function summarizeInventoryNeighborFallback(rows) {
  const targets = rows.filter(row => isInventoryNeighborFallbackTarget(row.prepared.neighborFallback));
  const strictControls = rows.filter(row => row.prepared.neighborFallback?.proposal.strict === true &&
    row.generated?.neighborFallback?.version === INVENTORY_NEIGHBOR_FALLBACK_VERSION);
  const evaluated = targets.filter(row => row.generated?.neighborFallback?.version === INVENTORY_NEIGHBOR_FALLBACK_VERSION);
  const resolved = evaluated.filter(row => row.generated.neighborFallback.wouldResolve === true);
  const added = resolved.filter(row => row.generated.neighborFallback.baseline.wouldResolve === false);
  const familiarityStates = ['familiar', 'unusual', 'sparse', 'degenerate'];
  const familiarity = row => {
    const calibration = row.prepared.matchCalibration;
    const status = calibration?.version === LIBRARY_MATCH_BASELINE_VERSION
      ? calibration.candidates.find(candidate => candidate.libraryId === row.generated.destinationId)?.status : null;
    return familiarityStates.includes(status) ? status : 'unavailable';
  };
  const qualified = added.filter(row => familiarity(row) === 'familiar');
  const agrees = row => row.sample.observedLibraryIds.includes(row.generated.destinationId);
  const reasons = evaluated.map(row => row.generated.neighborFallback.reason);
  return { version: INVENTORY_NEIGHBOR_FALLBACK_VERSION, sampled: rows.length,
    strictNeighborSupported: rows.filter(row => row.prepared.neighborFallback?.proposal.strict === true).length,
    selected: targets.length, selectedPlacementAgreement: targets.filter(row =>
      row.sample.observedLibraryIds.includes(row.prepared.neighborFallback.proposal.selected)).length,
    adjudicationReady: targets.filter(row => row.prepared.status === 'ready').length,
    generationsFinished: targets.filter(row => row.generated).length, evaluated: evaluated.length,
    strictControlsEvaluated: strictControls.length,
    comparisonScope: strictControls.length ? 'includes_strict_controls' : 'fallback_targets_only',
    aiProposalChanged: evaluated.filter(row => row.generated.status === 'proposed' &&
      row.generated.destinationId !== row.prepared.neighborFallback.proposal.selected).length,
    strictPreserved: resolved.length - added.length + strictControls.filter(row =>
      row.generated.neighborFallback.baseline.wouldResolve && row.generated.neighborFallback.wouldResolve).length,
    strictLost: [...evaluated, ...strictControls].filter(row =>
      row.generated.neighborFallback.baseline.wouldResolve && !row.generated.neighborFallback.wouldResolve).length,
    additionalReviewResolutions: added.length,
    additionalPlacementAgreement: added.filter(agrees).length,
    additionalPlacementDisagreement: added.filter(row => !agrees(row)).length,
    afterFamiliarityCheck: qualified.length,
    familiarityWithheldStates: Object.fromEntries(['unusual', 'sparse', 'degenerate', 'unavailable']
      .map(status => [status, added.filter(row => familiarity(row) === status).length])),
    familiarPlacementAgreement: qualified.filter(agrees).length,
    familiarPlacementDisagreement: qualified.filter(row => !agrees(row)).length,
    reasons: Object.fromEntries([...new Set(reasons)].sort().map(reason => [reason, reasons.filter(value => value === reason).length])),
    livePromotionAllowed: false, administrativeConfirmationEvaluated: false,
    liveIdentityAndReceiptChecksEvaluated: false, probabilityCalibrated: false };
}
