/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const STATUS_PRESENTATIONS = Object.freeze({
  insufficient_data: Object.freeze({
    label: 'Policy confirmation evidence needs more observations',
    message: 'Continue reviewing individual score explanations until the confirmation cohort reaches the displayed threshold. Do not infer a policy-scope gap yet.',
    className: 'border-gray-700 bg-gray-800',
  }),
  declared_scope_review_recommended: Object.freeze({
    label: 'Review declared policy scope',
    message: 'The 95% specialized-evidence interval remains below the review threshold. Review individual score explanations, then refine deterministic purpose, scope, or eligibility if the evidence supports it. This does not change AI or routing.',
    className: 'border-amber-600/70 bg-amber-950/20',
  }),
  evidence_mix_inconclusive: Object.freeze({
    label: 'Policy confirmation evidence is not yet conclusive',
    message: 'The observed specialized-evidence rate is near the review threshold, but its 95% interval overlaps that threshold. Continue reviewing; do not change declared policy scope from this cohort alone.',
    className: 'border-blue-700/60 bg-blue-950/20',
  }),
  evidence_mix_observed: Object.freeze({
    label: 'Specialized declared policy evidence is sufficiently represented',
    message: 'The 95% specialized-evidence interval is at or above the displayed threshold. This is not a correctness guarantee and does not change routing.',
    className: 'border-blue-700/60 bg-blue-950/20',
  }),
});

const UNAVAILABLE_PRESENTATION = Object.freeze({
  label: 'Policy confirmation evidence is unavailable',
  message: 'Policy confirmation evidence monitoring is currently unavailable.',
  className: 'border-gray-700 bg-gray-800',
});

function boundedRatePercent(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100
    ? numericValue
    : null;
}

/**
 * Maps the server-owned fixed readiness vocabulary to display-only copy. The
 * client intentionally ignores unknown statuses instead of rendering a server
 * supplied message or changing maintenance authority.
 */
export function getPolicyConfirmationEvidenceStatusPresentation(statusId) {
  return STATUS_PRESENTATIONS[statusId] || UNAVAILABLE_PRESENTATION;
}

/**
 * Formats only the fixed confidence contract emitted by the aggregate service.
 * Invalid or unknown interval shapes remain unavailable rather than becoming a
 * potentially misleading maintenance signal.
 */
export function formatPolicyConfirmationEvidenceConfidenceInterval(interval) {
  if (interval?.methodId !== 'wilson_score' || interval?.confidenceLevelPercent !== 95) {
    return 'Unavailable';
  }

  const lowerRatePercent = boundedRatePercent(interval.lowerRatePercent);
  const upperRatePercent = boundedRatePercent(interval.upperRatePercent);
  if (lowerRatePercent === null || upperRatePercent === null || lowerRatePercent > upperRatePercent) {
    return 'Unavailable';
  }

  return `95% Wilson interval: ${lowerRatePercent}%–${upperRatePercent}%`;
}
