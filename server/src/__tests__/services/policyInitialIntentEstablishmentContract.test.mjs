import {
  POLICY_INITIAL_INTENT_AUTHORITY_SOURCE_ID,
  PolicyInitialIntentEstablishmentRequestError,
  buildInitialIntentRequestFingerprint,
  buildInitialPolicyIntentContract,
  validatePolicyInitialIntentEstablishmentRequest,
} from '../../services/policyInitialIntentEstablishmentContract.mjs';

function request(overrides = {}) {
  return {
    schema_version: 1,
    idempotency_key: '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
    declared_intent: {
      purpose: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Animation'] },
      }],
      hard_limits: [],
      helpful_hints: [],
      avoid: [],
    },
    ...overrides,
  };
}

describe('policyInitialIntentEstablishmentContract', () => {
  test('builds native authority only from explicit declared rules', () => {
    const parsed = validatePolicyInitialIntentEstablishmentRequest(request());
    const contract = buildInitialPolicyIntentContract({
      policy: {
        id: 44,
        library_id: 6,
        auto_classify_threshold: 85,
        prompt_threshold: 60,
      },
      declaredIntent: parsed.declared_intent,
    });

    expect(contract.validation.valid).toBe(true);
    expect(contract.source).toBe('native_intent');
    expect(contract.inference_state).toBe('inferred');
    expect(contract.template_links).toEqual([]);
    expect(contract.purpose).toEqual([expect.objectContaining({
      intent_role: 'purpose',
      source: POLICY_INITIAL_INTENT_AUTHORITY_SOURCE_ID,
      inference_state: 'inferred',
      semantics: 'identity',
    })]);
    expect(JSON.stringify(contract)).not.toContain('profile');
  });

  test('rejects client supplied provenance, template links, and observed profile content', () => {
    expect(() => validatePolicyInitialIntentEstablishmentRequest(request({
      source: 'native_intent',
      observed_profile: { genres: ['Animation'] },
    }))).toThrow(PolicyInitialIntentEstablishmentRequestError);

    expect(() => validatePolicyInitialIntentEstablishmentRequest(request({
      declared_intent: {
        ...request().declared_intent,
        template_links: [{ preset_id: 1 }],
      },
    }))).toThrow(PolicyInitialIntentEstablishmentRequestError);
  });

  test('rejects purpose rules that cannot establish destination identity', () => {
    expect(() => validatePolicyInitialIntentEstablishmentRequest(request({
      declared_intent: {
        ...request().declared_intent,
        purpose: [{
          signal_type: 'runtime',
          operator: 'runtime_range',
          values: { min_minutes: 90 },
        }],
      },
    }))).toThrow(PolicyInitialIntentEstablishmentRequestError);
  });

  test('fingerprints declared content independently from the retry key', () => {
    const first = validatePolicyInitialIntentEstablishmentRequest(request());
    const second = validatePolicyInitialIntentEstablishmentRequest(request({
      idempotency_key: 'a8a3d39d-401e-44d4-9fd5-1920cd17c8e8',
    }));
    const changed = validatePolicyInitialIntentEstablishmentRequest(request({
      declared_intent: {
        ...request().declared_intent,
        purpose: [{
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: ['Family'] },
        }],
      },
    }));

    expect(buildInitialIntentRequestFingerprint(first))
      .toBe(buildInitialIntentRequestFingerprint(second));
    expect(buildInitialIntentRequestFingerprint(first))
      .not.toBe(buildInitialIntentRequestFingerprint(changed));
  });
});
