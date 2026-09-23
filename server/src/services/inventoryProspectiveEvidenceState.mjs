/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Describe missing prospective evidence without treating a diagnostic as a routing grant. */
export function inventoryProspectiveEvidenceState({ coverage, media, kinds, sampleSize }) {
  if (coverage.captured === 0) return {
    phase: 'awaiting_live_comparisons', missing: ['complete_live_comparisons'],
  };
  if (sampleSize === 0) return coverage.awaitingOutcome > 0 ? {
    phase: 'awaiting_operator_outcomes', missing: ['exact_event_outcomes'],
  } : {
    phase: 'no_eligible_outcomes', missing: ['eligible_exact_event_outcomes'],
  };

  const missing = [];
  if (media.movie.sampled === 0) missing.push('movie_outcomes');
  if (media.tv.sampled === 0) missing.push('tv_outcomes');
  if (kinds.correction.sampled === 0) missing.push('correction_outcomes');
  if (kinds.correction.companyObserved === 0) missing.push('company_observed_corrections');
  return { phase: 'diagnostic_only', missing };
}
