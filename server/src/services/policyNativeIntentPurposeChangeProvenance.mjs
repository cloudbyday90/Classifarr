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
  POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS,
  classifyPolicyDeclaredPurposeRuleProvenance,
} from './policyDeclaredPurposeProvenance.mjs';

export const POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS = Object.freeze({
  DECLARED_NATIVE: POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.DECLARED_NATIVE,
  PROFILE_DERIVED: POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.PROFILE_DERIVED,
  MIXED: 'mixed',
  UNVERIFIED: POLICY_DECLARED_PURPOSE_RULE_PROVENANCE_IDS.UNVERIFIED,
});

const KNOWN_PROVENANCE_IDS = new Set(
  Object.values(POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS),
);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Reduces stored rule provenance to one fixed status for the administrator
 * purpose-maintenance read. It deliberately omits the per-rule source and
 * inference state so a profile remains descriptive evidence, never browser
 * authority or a configuration projection.
 */
export function buildPolicyNativeIntentPurposeChangeProvenance(purposeRules = []) {
  const provenanceIds = new Set(
    asArray(purposeRules).map(classifyPolicyDeclaredPurposeRuleProvenance),
  );
  const id = provenanceIds.size === 1
    ? [...provenanceIds][0]
    : provenanceIds.size > 1
      ? POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS.MIXED
      : POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS.UNVERIFIED;
  const normalizedId = KNOWN_PROVENANCE_IDS.has(id)
    ? id
    : POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS.UNVERIFIED;

  return Object.freeze({
    id: normalizedId,
    declarationRequired:
      normalizedId !== POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS.DECLARED_NATIVE,
    rawRuleProvenanceExposed: false,
  });
}

export function isPolicyNativeIntentPurposeChangeProvenance(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const keys = Object.keys(value).sort();
  if (keys.length !== 3 || keys.join('|') !== 'declarationRequired|id|rawRuleProvenanceExposed') {
    return false;
  }

  return KNOWN_PROVENANCE_IDS.has(value.id) &&
    value.declarationRequired === (
      value.id !== POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS.DECLARED_NATIVE
    ) &&
    value.rawRuleProvenanceExposed === false;
}
