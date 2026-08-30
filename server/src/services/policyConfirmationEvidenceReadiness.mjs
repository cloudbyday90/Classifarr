/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CONFIRMATION_EVIDENCE_READINESS_VERSION =
  'current_library.policy_confirmation_evidence_readiness.v1';

export const POLICY_CONFIRMATION_EVIDENCE_READINESS_STATUS_IDS = Object.freeze({
  INSUFFICIENT_DATA: 'insufficient_data',
  DECLARED_SCOPE_REVIEW_RECOMMENDED: 'declared_scope_review_recommended',
  EVIDENCE_MIX_OBSERVED: 'evidence_mix_observed',
});

export const POLICY_CONFIRMATION_EVIDENCE_READINESS_MINIMUM_OBSERVATIONS = 20;
export const POLICY_CONFIRMATION_EVIDENCE_READINESS_MINIMUM_SPECIALIZED_DECLARED_RATE = 0.60;

const SUPPORTING_EVIDENCE_SOURCES = Object.freeze([
  Object.freeze({ id: 'observed_profile', countField: 'profileEvidenceCount' }),
  Object.freeze({ id: 'confirmed_pattern', countField: 'patternEvidenceCount' }),
  Object.freeze({ id: 'similar_items', countField: 'ragEvidenceCount' }),
  Object.freeze({ id: 'prior_outcomes', countField: 'historyEvidenceCount' }),
]);

function nonnegativeCount(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function boundedCount(value, maximum) {
  return Math.min(nonnegativeCount(value), maximum);
}

function ratePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round(numerator / denominator * 1000) / 10;
}

/**
 * Converts a fixed, content-free confirmation-band aggregate into advisory
 * policy-maintenance readiness. It deliberately has no policy, library, item,
 * provider, model, prompt, response, actor, or routing input.
 */
export function buildPolicyConfirmationEvidenceReadiness(row = {}) {
  const confirmationObservationCount = nonnegativeCount(
    row.confirmationEvidenceObservationCount,
  );
  const specializedDeclaredEvidenceCount = boundedCount(
    row.specializedDeclaredEvidenceCount,
    confirmationObservationCount,
  );
  const compatibilityOnlyEvidenceCount = boundedCount(
    row.compatibilityOnlyEvidenceCount,
    confirmationObservationCount - specializedDeclaredEvidenceCount,
  );
  const noDeclaredEvidenceCount = Math.max(
    0,
    confirmationObservationCount -
      specializedDeclaredEvidenceCount -
      compatibilityOnlyEvidenceCount,
  );
  const hasSufficientData =
    confirmationObservationCount >= POLICY_CONFIRMATION_EVIDENCE_READINESS_MINIMUM_OBSERVATIONS;
  const specializedDeclaredEvidenceRate =
    confirmationObservationCount > 0
      ? specializedDeclaredEvidenceCount / confirmationObservationCount
      : 0;
  const declaredScopeReviewRecommended =
    hasSufficientData &&
    specializedDeclaredEvidenceRate <
      POLICY_CONFIRMATION_EVIDENCE_READINESS_MINIMUM_SPECIALIZED_DECLARED_RATE;
  const statusId = !hasSufficientData
    ? POLICY_CONFIRMATION_EVIDENCE_READINESS_STATUS_IDS.INSUFFICIENT_DATA
    : (declaredScopeReviewRecommended
      ? POLICY_CONFIRMATION_EVIDENCE_READINESS_STATUS_IDS.DECLARED_SCOPE_REVIEW_RECOMMENDED
      : POLICY_CONFIRMATION_EVIDENCE_READINESS_STATUS_IDS.EVIDENCE_MIX_OBSERVED);

  return Object.freeze({
    version: POLICY_CONFIRMATION_EVIDENCE_READINESS_VERSION,
    statusId,
    confirmationObservationCount,
    minimumObservationCount: POLICY_CONFIRMATION_EVIDENCE_READINESS_MINIMUM_OBSERVATIONS,
    declaredScope: Object.freeze({
      specializedEvidenceCount: specializedDeclaredEvidenceCount,
      specializedEvidenceRatePercent: ratePercent(
        specializedDeclaredEvidenceCount,
        confirmationObservationCount,
      ),
      compatibilityOnlyEvidenceCount,
      compatibilityOnlyEvidenceRatePercent: ratePercent(
        compatibilityOnlyEvidenceCount,
        confirmationObservationCount,
      ),
      noDeclaredEvidenceCount,
      noDeclaredEvidenceRatePercent: ratePercent(
        noDeclaredEvidenceCount,
        confirmationObservationCount,
      ),
      minimumSpecializedEvidenceRatePercent:
        POLICY_CONFIRMATION_EVIDENCE_READINESS_MINIMUM_SPECIALIZED_DECLARED_RATE * 100,
    }),
    supportingEvidenceSources: Object.freeze(SUPPORTING_EVIDENCE_SOURCES.map((source) => {
      const count = boundedCount(row[source.countField], confirmationObservationCount);
      return Object.freeze({
        id: source.id,
        count,
        ratePercent: ratePercent(count, confirmationObservationCount),
      });
    })),
    calibration: Object.freeze({
      appliedCount: boundedCount(
        row.calibrationAppliedCount,
        confirmationObservationCount,
      ),
      appliedRatePercent: ratePercent(
        boundedCount(row.calibrationAppliedCount, confirmationObservationCount),
        confirmationObservationCount,
      ),
    }),
  });
}
