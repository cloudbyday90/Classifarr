/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const POLICY_NATIVE_READINESS_INTENT_VERSION = 'policy.intent.v1';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildStoredRuleProjection(rule = {}) {
  return {
    signal_type: rule?.signal_type ?? null,
    operator: rule?.operator ?? null,
    source: 'stored_native_intent',
  };
}

function buildNativeReadinessIntent(nativeContract = {}) {
  const validationValid = nativeContract?.validation?.valid === true;

  return {
    version: POLICY_NATIVE_READINESS_INTENT_VERSION,
    source: 'stored_native_intent',
    belongs_here: asArray(nativeContract?.purpose).map(buildStoredRuleProjection),
    helpful_matches: asArray(nativeContract?.helpful_hints).map(buildStoredRuleProjection),
    hard_limits: asArray(nativeContract?.hard_limits).map(buildStoredRuleProjection),
    avoid: asArray(nativeContract?.avoid).map(buildStoredRuleProjection),
    ask_when: validationValid ? [] : [{
      source: 'stored_native_intent',
      reasonCode: 'native_intent_validation_requires_review',
    }],
    routing_target: [],
    confidence: {
      level: validationValid ? 'high' : 'low',
      score: validationValid ? 1 : 0,
      reasonCodes: [],
    },
    assumptions: [],
    warnings: validationValid ? [] : [{
      severity: 'warning',
      reasonCode: 'native_intent_validation_requires_review',
    }],
    learningSideEffects: [],
  };
}

export {
  POLICY_NATIVE_READINESS_INTENT_VERSION,
  buildNativeReadinessIntent,
};
