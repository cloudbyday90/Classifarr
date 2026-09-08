/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS,
  buildPolicyNativeIntentPurposeChangeProvenance,
  isPolicyNativeIntentPurposeChangeProvenance,
} from '../../services/policyNativeIntentPurposeChangeProvenance.mjs';

function rule(source, inferenceState = 'inferred') {
  return { source, inference_state: inferenceState };
}

describe('policy native intent purpose-change provenance', () => {
  test.each([
    ['native declarations', [rule('native_intent')], 'declared_native', false],
    ['operator declarations', [rule('operator_declared_intent')], 'declared_native', false],
    ['profile evidence', [rule('media_server_library_profile')], 'profile_derived', true],
    ['mixed evidence', [rule('native_intent'), rule('media_server_library_profile')], 'mixed', true],
    ['unverified evidence', [rule('unknown_source')], 'unverified', true],
  ])('reduces %s to a fixed aggregate state', (_label, rules, id, declarationRequired) => {
    const provenance = buildPolicyNativeIntentPurposeChangeProvenance(rules);

    expect(provenance).toEqual({
      id,
      declarationRequired,
      rawRuleProvenanceExposed: false,
    });
    expect(isPolicyNativeIntentPurposeChangeProvenance(provenance)).toBe(true);
  });

  test('rejects extra fields and contradictory declaration requirements', () => {
    expect(isPolicyNativeIntentPurposeChangeProvenance({
      id: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS.DECLARED_NATIVE,
      declarationRequired: true,
      rawRuleProvenanceExposed: false,
    })).toBe(false);
    expect(isPolicyNativeIntentPurposeChangeProvenance({
      id: POLICY_NATIVE_INTENT_PURPOSE_CHANGE_PROVENANCE_IDS.PROFILE_DERIVED,
      declarationRequired: true,
      rawRuleProvenanceExposed: false,
      source: 'media_server_library_profile',
    })).toBe(false);
  });
});
