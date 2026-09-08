/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import { POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS } from './policyPurposeLifecycleReceiptSources.mjs';

export const HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_SOURCE_VERSION =
  'policy.held_out_semantic_study_lifecycle_reaudit_source.v2';

export const HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_MAXIMUM_ATTEMPTS = 3;

function nonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : 0;
}

/**
 * Normalizes a source change detector to a fixed, library-agnostic receipt.
 * Every source value is a count; no per-policy or provider detail is present.
 */
export function buildHeldOutSemanticStudyLifecycleReauditSource(record = {}, purposeEvidence = {}) {
  const lifecycleTransitionCounts = Object.freeze({
    [POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS.INITIAL_INTENT_ESTABLISHMENT]:
      nonNegativeInteger(record.initial_intent_establishment_count),
    [POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS.NATIVE_INTENT_CHANGE]:
      nonNegativeInteger(record.native_intent_change_count),
    [POLICY_PURPOSE_LIFECYCLE_TRANSITION_IDS.LIBRARY_REBUILD_REPLACEMENT]:
      nonNegativeInteger(record.library_rebuild_replacement_count),
  });
  const transitionCount = Object.values(lifecycleTransitionCounts)
    .reduce((total, count) => total + count, 0);
  const normalLifecycleReceiptCount = Math.min(
    nonNegativeInteger(record.normal_lifecycle_receipt_count),
    transitionCount,
  );
  const completePolicyEvidenceCount = nonNegativeInteger(
    purposeEvidence.completePolicyEvidenceCount,
  );

  return Object.freeze({
    version: HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_SOURCE_VERSION,
    normalLifecycleReceiptCount,
    completePolicyEvidenceCount,
    completePolicyEvidenceAvailable: completePolicyEvidenceCount > 0,
    lifecycleTransitionCounts,
    rawConfigurationExposed: false,
    libraryIdentityExposed: false,
    mediaIdentityExposed: false,
  });
}

export function heldOutSemanticStudyLifecycleReauditSourceFingerprint(source) {
  return createHash('sha256')
    .update(JSON.stringify(source), 'utf8')
    .digest('hex');
}

export function isHeldOutSemanticStudyLifecycleReauditSourceChanged({ source, state } = {}) {
  if (!state || typeof state.sourceFingerprint !== 'string') return true;
  return heldOutSemanticStudyLifecycleReauditSourceFingerprint(source) !== state.sourceFingerprint;
}
