/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_RUNTIME_READ_SOURCE_IDS,
  buildPolicyIntentRuntimeReadPath,
} from './policyIntentRuntimeReadPath.mjs';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function hasAttachedNativeIntent(policy = {}) {
  return Boolean(policy.native_intent || policy.nativeIntent) ||
    Boolean(policy.native_intent_authority?.stateId);
}

function applyNativeReviewBehavior(policy = {}, reviewBehavior = {}) {
  const review = asObject(reviewBehavior);
  const autoClassifyThreshold = finiteNumber(review.auto_classify_threshold);
  const promptThreshold = finiteNumber(review.prompt_threshold);

  return {
    ...policy,
    ...(autoClassifyThreshold === null ? {} : { auto_classify_threshold: autoClassifyThreshold }),
    ...(promptThreshold === null ? {} : { prompt_threshold: promptThreshold }),
    ...(typeof review.trust_patterns === 'boolean' ? { trust_patterns: review.trust_patterns } : {}),
    ...(typeof review.trust_rag === 'boolean' ? { trust_rag: review.trust_rag } : {}),
    ...(typeof review.trust_history === 'boolean' ? { trust_history: review.trust_history } : {}),
    ...(typeof review.combination_mode === 'string' ? { combination_mode: review.combination_mode } : {}),
  };
}

export function isNativePolicyRuntimeAuthority(policy = {}) {
  return policy?.policy_runtime_authority?.sourceId === POLICY_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT;
}

export function hasAttachedNativePolicyIntent(policy = {}) {
  return hasAttachedNativeIntent(policy);
}

export function requiresLegacyPolicyPresetsForRuntime(policy = {}) {
  return buildPolicyIntentRuntimeReadPath({ policy }).sourceId ===
    POLICY_RUNTIME_READ_SOURCE_IDS.COMPATIBILITY_BRIDGE;
}

export function withPolicyEngineRuntimeAuthority(policy = {}) {
  const readPath = buildPolicyIntentRuntimeReadPath({ policy });
  const projection = {
    configuration_view: readPath.configuration_view,
    policy_intent_contract: readPath.policy_intent_contract,
    policy_intent_read_trace: readPath.trace,
    policy_runtime_authority: {
      sourceId: readPath.sourceId,
      statusId: readPath.statusId,
      validationOk: readPath.validation?.ok === true &&
        readPath.policy_intent_contract?.validation?.valid === true,
      dependsOnCustomSignals: readPath.dependsOnCustomSignals === true,
      trace: readPath.trace,
    },
  };

  if (readPath.sourceId !== POLICY_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT) {
    return {
      ...policy,
      ...projection,
    };
  }

  return {
    ...applyNativeReviewBehavior(policy, readPath.policy_intent_contract?.review_behavior),
    ...projection,
    // A converted policy must never re-enter the legacy scoring branch.
    presets: [],
  };
}
