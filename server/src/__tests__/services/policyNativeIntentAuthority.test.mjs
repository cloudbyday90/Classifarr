import {
  POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS,
  buildNativeIntentAuthority,
  isNativeIntentAuthorityAmbiguous,
  normalizeNativeIntentAuthority,
} from '../../services/policyNativeIntentAuthority.mjs';

describe('policyNativeIntentAuthority', () => {
  test('recognizes exactly one active intent as the authority', () => {
    expect(buildNativeIntentAuthority({
      activeIntents: [{
        id: 42,
        source: 'native_intent',
        inference_state: 'inferred',
        validation_status: 'valid',
        purpose_rule_count: 1,
      }],
    })).toEqual({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.SINGLE_ACTIVE_NATIVE_INTENT,
      activeIntentCount: 1,
      authoritative: true,
    });
  });

  test('does not treat a structurally present empty row as authority', () => {
    expect(buildNativeIntentAuthority({
      activeIntents: [{
        id: 42,
        source: 'empty',
        inference_state: 'empty',
        validation_status: 'valid',
        purpose_rule_count: 0,
      }],
    })).toEqual({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.SINGLE_NON_AUTHORITATIVE_ACTIVE_INTENT,
      activeIntentCount: 1,
      authoritative: false,
      integrityStatusId: 'empty_active_intent',
    });
  });

  test('bounds an ambiguous active-intent state without exposing row identifiers', () => {
    const authority = buildNativeIntentAuthority({
      activeIntents: [{ id: 42 }, { id: 43 }, { id: 44 }],
    });

    expect(authority).toEqual({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS,
      activeIntentCount: 2,
      authoritative: false,
    });
    expect(authority).not.toHaveProperty('intentIds');
    expect(isNativeIntentAuthorityAmbiguous(authority)).toBe(true);
  });

  test('normalizes only recognized authority states', () => {
    expect(normalizeNativeIntentAuthority({
      state_id: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS,
      active_intent_count: 9,
    })).toEqual({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS,
      activeIntentCount: 2,
      authoritative: false,
    });
    expect(normalizeNativeIntentAuthority({
      stateId: 'unknown',
      activeIntentCount: 2,
    })).toBeNull();
  });
});
