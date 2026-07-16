import {
  POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS,
  POLICY_NATIVE_INTENT_MATERIALIZATION_STATE_IDS,
  buildNativeIntentAuthorityEligibility,
  buildNativeIntentAuthoritySqlPredicate,
  buildNativeIntentMaterializationEligibility,
} from '../../services/policyNativeIntentAuthorityEligibility.mjs';

function activeIntent(overrides = {}) {
  return {
    id: 41,
    active: true,
    source: 'native_intent',
    inference_state: 'inferred',
    validation_status: 'valid',
    purpose_rule_count: 1,
    ...overrides,
  };
}

describe('policyNativeIntentAuthorityEligibility', () => {
  test('requires a materialized native header and persisted purpose rule for authority', () => {
    expect(buildNativeIntentAuthorityEligibility({
      activeIntents: [activeIntent()],
    })).toEqual({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.AUTHORITATIVE_NATIVE_INTENT,
      activeIntentCount: 1,
      authoritative: true,
      purposeRuleCount: 1,
    });
  });

  test.each([
    ['empty placeholders', activeIntent({
      source: 'empty',
      inference_state: 'empty',
      validation_status: 'valid',
      purpose_rule_count: 0,
    }), POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.EMPTY_ACTIVE_INTENT],
    ['legacy headers', activeIntent({ source: 'legacy_presets' }), POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_NOT_NATIVE],
    ['partial inference', activeIntent({ inference_state: 'partial' }), POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_INFERENCE_INCOMPLETE],
    ['unsafe validation', activeIntent({ validation_status: 'pending_validation' }), POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_VALIDATION_UNSAFE],
    ['missing purpose rules', activeIntent({ purpose_rule_count: 0 }), POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_MISSING_PURPOSE],
  ])('does not authorize %s', (_label, intent, stateId) => {
    expect(buildNativeIntentAuthorityEligibility({ activeIntents: [intent] })).toEqual({
      stateId,
      activeIntentCount: 1,
      authoritative: false,
      purposeRuleCount: intent.purpose_rule_count,
    });
  });

  test('does not select between multiple active rows', () => {
    expect(buildNativeIntentAuthorityEligibility({
      activeIntents: [activeIntent(), activeIntent({ id: 42 })],
    })).toEqual({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_ELIGIBILITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS,
      activeIntentCount: 2,
      authoritative: false,
    });
  });

  test('requires a non-empty, inferred, valid contract with purpose before materialization', () => {
    expect(buildNativeIntentMaterializationEligibility({
      source: 'legacy_presets',
      inference_state: 'inferred',
      purpose: [{}],
      validation: { valid: true },
    })).toEqual({
      stateId: POLICY_NATIVE_INTENT_MATERIALIZATION_STATE_IDS.MATERIALIZABLE,
      materializable: true,
      purposeRuleCount: 1,
    });

    expect(buildNativeIntentMaterializationEligibility({
      source: 'empty',
      inference_state: 'empty',
      purpose: [],
      validation: { valid: true },
    })).toEqual({
      stateId: POLICY_NATIVE_INTENT_MATERIALIZATION_STATE_IDS.EMPTY_CONTRACT,
      materializable: false,
      purposeRuleCount: 0,
    });
  });

  test('builds a static semantic-authority predicate without accepting arbitrary SQL', () => {
    const predicate = buildNativeIntentAuthoritySqlPredicate({
      intentAlias: 'active_intent',
    });

    expect(predicate).toContain("active_intent.source = 'native_intent'");
    expect(predicate).toContain("authority_purpose_rule.intent_role = 'purpose'");
    expect(() => buildNativeIntentAuthoritySqlPredicate({ intentAlias: 'intent; DROP TABLE policy_intents' }))
      .toThrow('intentAlias must be a simple SQL identifier');
  });
});
