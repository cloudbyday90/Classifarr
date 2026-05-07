/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
export const DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD = 85;
export const DEFAULT_POLICY_PROMPT_THRESHOLD = 60;
export const POLICY_MAX_DECISION_THRESHOLD = 95;
export const POLICY_PROMPT_SELECT_MIN_CONFIDENCE = 40;
export const POLICY_CLOSE_SCORE_MARGIN = 1;
function isBlankString(value) {
  return typeof value === 'string' && value.trim() === '';
}
export function parseFiniteThreshold(value) {
  if (value === null || value === undefined || isBlankString(value)) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
export function validatePolicyThresholdField(value, fieldName) {
  if (value === undefined) {
    return {
      hasValue: false,
      isValid: true,
      value: undefined,
      error: null,
    };
  }
  const parsed = parseFiniteThreshold(value);
  if (!Number.isFinite(parsed)) {
    return {
      hasValue: true,
      isValid: false,
      value: null,
      error: `${fieldName} must be a finite whole number between 0 and ${POLICY_MAX_DECISION_THRESHOLD}`,
    };
  }
  if (!Number.isInteger(parsed)) {
    return {
      hasValue: true,
      isValid: false,
      value: parsed,
      error: `${fieldName} must be a whole number between 0 and ${POLICY_MAX_DECISION_THRESHOLD}`,
    };
  }
  if (parsed < 0 || parsed > POLICY_MAX_DECISION_THRESHOLD) {
    return {
      hasValue: true,
      isValid: false,
      value: parsed,
      error: `${fieldName} must be between 0 and ${POLICY_MAX_DECISION_THRESHOLD}`,
    };
  }
  return {
    hasValue: true,
    isValid: true,
    value: parsed,
    error: null,
  };
}
export function validatePolicyDecisionThresholds(rawThresholds = {}) {
  const autoClassifyThreshold = parseFiniteThreshold(rawThresholds.auto_classify_threshold);
  const promptThreshold = parseFiniteThreshold(rawThresholds.prompt_threshold);
  const errors = [];
  if (!Number.isFinite(autoClassifyThreshold)) {
    errors.push(`auto_classify_threshold must be a finite number between 0 and ${POLICY_MAX_DECISION_THRESHOLD}`);
  } else if (autoClassifyThreshold < 0 || autoClassifyThreshold > POLICY_MAX_DECISION_THRESHOLD) {
    errors.push(`auto_classify_threshold must be between 0 and ${POLICY_MAX_DECISION_THRESHOLD}`);
  }
  if (!Number.isFinite(promptThreshold)) {
    errors.push(`prompt_threshold must be a finite number between 0 and ${POLICY_MAX_DECISION_THRESHOLD}`);
  } else if (promptThreshold < 0 || promptThreshold > POLICY_MAX_DECISION_THRESHOLD) {
    errors.push(`prompt_threshold must be between 0 and ${POLICY_MAX_DECISION_THRESHOLD}`);
  }
  if (
    Number.isFinite(autoClassifyThreshold)
    && Number.isFinite(promptThreshold)
    && promptThreshold > autoClassifyThreshold
  ) {
    errors.push('prompt_threshold must be less than or equal to auto_classify_threshold');
  }
  return {
    isValid: errors.length === 0,
    errors,
    autoClassifyThreshold,
    promptThreshold,
    thresholds: errors.length === 0
      ? {
        auto_classify: autoClassifyThreshold,
        prompt: promptThreshold,
        prompt_select: POLICY_PROMPT_SELECT_MIN_CONFIDENCE,
      }
      : null,
  };
}
export function normalizePolicyDecisionThresholds(rawThresholds = {}) {
  let autoClassifyThreshold = parseFiniteThreshold(rawThresholds.auto_classify_threshold);
  let promptThreshold = parseFiniteThreshold(rawThresholds.prompt_threshold);
  const reasons = [];
  if (!Number.isFinite(autoClassifyThreshold)) {
    autoClassifyThreshold = POLICY_MAX_DECISION_THRESHOLD;
    reasons.push('auto_classify_threshold was missing or invalid; using conservative fallback');
  } else if (autoClassifyThreshold < 0) {
    autoClassifyThreshold = POLICY_MAX_DECISION_THRESHOLD;
    reasons.push('auto_classify_threshold was below 0; using conservative fallback');
  } else if (autoClassifyThreshold > POLICY_MAX_DECISION_THRESHOLD) {
    autoClassifyThreshold = POLICY_MAX_DECISION_THRESHOLD;
    reasons.push('auto_classify_threshold exceeded the policy-engine ceiling; clamped to 95');
  }
  if (!Number.isFinite(promptThreshold)) {
    promptThreshold = autoClassifyThreshold;
    reasons.push('prompt_threshold was missing or invalid; using conservative fallback');
  } else if (promptThreshold < 0) {
    promptThreshold = autoClassifyThreshold;
    reasons.push('prompt_threshold was below 0; using conservative fallback');
  } else if (promptThreshold > POLICY_MAX_DECISION_THRESHOLD) {
    promptThreshold = autoClassifyThreshold;
    reasons.push('prompt_threshold exceeded the policy-engine ceiling; using conservative fallback');
  }
  if (promptThreshold > autoClassifyThreshold) {
    const conservativeThreshold = promptThreshold;
    autoClassifyThreshold = conservativeThreshold;
    promptThreshold = conservativeThreshold;
    reasons.push('prompt_threshold exceeded auto_classify_threshold; using the higher threshold for both decision bands');
  }
  return {
    autoClassifyThreshold,
    promptThreshold,
    thresholds: {
      auto_classify: autoClassifyThreshold,
      prompt: promptThreshold,
      prompt_select: POLICY_PROMPT_SELECT_MIN_CONFIDENCE,
    },
    wasNormalized: reasons.length > 0,
    reasons,
  };
}
const policyThresholds = {
  DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
  DEFAULT_POLICY_PROMPT_THRESHOLD,
  POLICY_CLOSE_SCORE_MARGIN,
  POLICY_MAX_DECISION_THRESHOLD,
  POLICY_PROMPT_SELECT_MIN_CONFIDENCE,
  normalizePolicyDecisionThresholds,
  parseFiniteThreshold,
  validatePolicyDecisionThresholds,
  validatePolicyThresholdField,
};
export default policyThresholds;
