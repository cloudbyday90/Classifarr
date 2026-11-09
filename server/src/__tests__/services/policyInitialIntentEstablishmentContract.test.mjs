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
  test.each(['genres', 'keywords', 'studios', 'media_type'].flatMap(signal =>
    ['require_any', 'require_all', 'include', 'prefer'].flatMap(operator =>
      ['identity', 'compatibility'].map(semantics => [signal, operator, semantics]))))(
    'materializes explicit %s / %s / %s without changing its meaning', (signal_type, operator, semantics) => {
      const parsed = validatePolicyInitialIntentEstablishmentRequest(request({ declared_intent: {
        purpose: [{ signal_type, operator, semantics, values: { [operator]: ['custom-category-token'] } }],
      } }));
      const before = buildInitialIntentRequestFingerprint(parsed);
      const contract = buildInitialPolicyIntentContract({ policy: { id: 44, library_id: 6 }, declaredIntent: parsed.declared_intent });
      expect(contract.validation.valid).toBe(true);
      expect(contract.purpose[0].semantics).toBe(semantics);
      expect(buildInitialIntentRequestFingerprint(parsed)).toBe(before);
    });

  test('retains nullish purpose defaults and all other role mappings and fingerprint distinctions', () => {
    const fingerprints = [undefined, null, 'identity', 'compatibility'].map(semantics => {
      const rule = { signal_type: 'genres', operator: 'include', values: { include: ['custom-token'] },
        ...(semantics === undefined ? {} : { semantics }) };
      const parsed = validatePolicyInitialIntentEstablishmentRequest(request({ declared_intent: {
        purpose: [rule], helpful_hints: [{ ...rule, semantics: 'compatibility' }],
        avoid: [{ signal_type: 'genres', operator: 'exclude', values: { exclude: ['other-token'] } }],
        hard_limits: [{ signal_type: 'runtime', operator: 'runtime_range', values: { max_minutes: 120 }, constraint_mode: 'strict' }],
      } }));
      const contract = buildInitialPolicyIntentContract({ policy: { id: 44, library_id: 6 }, declaredIntent: parsed.declared_intent });
      expect(contract.purpose[0].semantics).toBe(semantics ?? 'identity');
      expect(contract.helpful_hints[0].semantics).toBe('compatibility');
      expect(contract.avoid[0].semantics).toBeNull();
      expect(contract.hard_limits[0]).toMatchObject({ constraint_mode: 'strict', semantics: null });
      return buildInitialIntentRequestFingerprint(parsed);
    });
    expect(new Set(fingerprints).size).toBe(4);
  });
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
