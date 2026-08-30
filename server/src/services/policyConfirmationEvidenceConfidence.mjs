/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CONFIRMATION_EVIDENCE_CONFIDENCE_METHOD_ID = 'wilson_score';
export const POLICY_CONFIRMATION_EVIDENCE_CONFIDENCE_LEVEL_PERCENT = 95;

const WILSON_95_PERCENT_Z_SCORE = 1.959963984540054;

function nonnegativeCount(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : 0;
}

function ratePercent(value) {
  return Math.round(value * 1000) / 10;
}

/**
 * Produces a fixed 95% Wilson score interval for an aggregate binomial rate.
 * The input is deliberately count-only so callers cannot accidentally carry
 * policy, library, item, provider, or classification identity into reporting.
 */
export function buildPolicyConfirmationEvidenceConfidenceInterval({
  successCount,
  observationCount,
} = {}) {
  const total = nonnegativeCount(observationCount);
  if (total === 0) return null;

  const successes = Math.min(nonnegativeCount(successCount), total);
  const observedRate = successes / total;
  const zSquared = WILSON_95_PERCENT_Z_SCORE ** 2;
  const denominator = 1 + zSquared / total;
  const center = (observedRate + zSquared / (2 * total)) / denominator;
  const spread = WILSON_95_PERCENT_Z_SCORE / denominator * Math.sqrt(
    observedRate * (1 - observedRate) / total + zSquared / (4 * total ** 2),
  );

  return Object.freeze({
    methodId: POLICY_CONFIRMATION_EVIDENCE_CONFIDENCE_METHOD_ID,
    confidenceLevelPercent: POLICY_CONFIRMATION_EVIDENCE_CONFIDENCE_LEVEL_PERCENT,
    lowerRatePercent: ratePercent(Math.max(0, center - spread)),
    upperRatePercent: ratePercent(Math.min(1, center + spread)),
  });
}
