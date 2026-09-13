/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const NEIGHBOR_COMPARISON_ARMS = Object.freeze(['full_strict', 'reference_strict', 'reference_mean', 'reference_calibrated']);
const pairs = [['full_strict', 'reference_strict'], ['reference_strict', 'reference_mean'], ['reference_mean', 'reference_calibrated']];
const crossFitArms = ['cross_fit_strict', 'cross_fit_mean', 'cross_fit_calibrated'];
const crossFitPairs = [['reference_strict', 'cross_fit_strict'], ['cross_fit_strict', 'cross_fit_mean'],
  ['cross_fit_mean', 'cross_fit_calibrated'], ['reference_calibrated', 'cross_fit_calibrated'], ['full_strict', 'cross_fit_calibrated']];

/** Public output contains aggregate counts, never individual decisions or library identities. */
export function summarizeNeighborComparison(rows, { crossFit = false } = {}) {
  return {
    evaluated: rows.length,
    noUniqueProposal: rows.filter(row => !row.proposed).length,
    sharedDescriptionBlocked: rows.filter(row => row.shared).length,
    arms: [...NEIGHBOR_COMPARISON_ARMS, ...(crossFit ? crossFitArms : [])].map(arm => {
      const available = rows.filter(row => row.arms[arm].available);
      const supported = available.filter(row => row.arms[arm].support);
      return { arm, available: available.length, unavailable: rows.length - available.length,
        neighborSupport: supported.length, neighborReview: available.length - supported.length,
        supportedPlacementAgreement: supported.filter(row => row.placementAgreement).length,
        supportedPlacementDisagreement: supported.filter(row => !row.placementAgreement).length };
    }),
    paired: [...pairs, ...(crossFit ? crossFitPairs : [])].map(([from, to]) => {
      const available = rows.filter(row => row.arms[from].available && row.arms[to].available);
      const gained = available.filter(row => !row.arms[from].support && row.arms[to].support);
      return { from, to, available: available.length, gainedSupport: gained.length,
        gainedPlacementAgreement: gained.filter(row => row.placementAgreement).length,
        gainedPlacementDisagreement: gained.filter(row => !row.placementAgreement).length,
        lostSupport: available.filter(row => row.arms[from].support && !row.arms[to].support).length,
        ...(crossFit ? { gainedAvailability: rows.filter(row => !row.arms[from].available && row.arms[to].available).length,
          lostAvailability: rows.filter(row => row.arms[from].available && !row.arms[to].available).length } : {}) };
    }),
  };
}
