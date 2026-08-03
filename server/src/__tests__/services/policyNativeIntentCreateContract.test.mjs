import {
  NATIVE_POLICY_CREATE_ALLOWED_FIELDS,
  PolicyNativeIntentCreateRequestError,
  buildNativeIntentCreateRequest,
  validateNativePolicyCreateIdentity,
} from '../../services/policyNativeIntentCreateContract.mjs';

const IDEMPOTENCY_KEY = '6fe3d170-9390-4ec5-95f7-42ad6f8ec777';

function validPayload(overrides = {}) {
  return {
    library_id: 4,
    name: 'Animation Policy',
    native_intent_establishment: {
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
    },
    ...overrides,
  };
}

describe('policyNativeIntentCreateContract', () => {
  test('builds a validated initial-establishment request from declared intent only', () => {
    expect(buildNativeIntentCreateRequest({
      payload: validPayload(),
      actorId: 7,
      idempotencyKey: IDEMPOTENCY_KEY,
    })).toEqual({
      schema_version: 1,
      idempotency_key: IDEMPOTENCY_KEY,
      declared_intent: validPayload().native_intent_establishment.declared_intent,
    });
  });

  test('does not activate native establishment when the field is absent', () => {
    expect(buildNativeIntentCreateRequest({
      payload: { name: 'Animation' },
      actorId: 7,
      idempotencyKey: IDEMPOTENCY_KEY,
    })).toBeNull();
  });

  test('allows only the bounded native policy-create request fields', () => {
    expect(buildNativeIntentCreateRequest({
      payload: {
        library_id: 4,
        name: 'Animation Policy',
        ...validPayload(),
      },
      actorId: 7,
      idempotencyKey: IDEMPOTENCY_KEY,
    })).toEqual(expect.objectContaining({
      declared_intent: validPayload().native_intent_establishment.declared_intent,
    }));
    expect(NATIVE_POLICY_CREATE_ALLOWED_FIELDS).toEqual([
      'library_id',
      'name',
      'native_intent_establishment',
    ]);
  });

  test('validates and normalizes the bounded native policy identity', () => {
    expect(validateNativePolicyCreateIdentity({
      library_id: '4',
      name: '  Animation Policy  ',
      ...validPayload(),
    })).toEqual({ libraryId: 4, name: 'Animation Policy' });

    expect(() => validateNativePolicyCreateIdentity({
      ...validPayload(),
      library_id: 0,
    })).toThrow(PolicyNativeIntentCreateRequestError);
  });

  test.each([
    ['legacy presets are present', { legacyPresetCount: 1 }],
    ['the actor is missing', { actorId: null }],
    ['a hidden legacy setting is present', {
      payload: validPayload({ auto_classify_threshold: 100 }),
    }],
    ['the shape contains unrecognized keys', {
      payload: validPayload({
        native_intent_establishment: {
          declared_intent: validPayload().native_intent_establishment.declared_intent,
          idempotency_key: IDEMPOTENCY_KEY,
        },
      }),
    }],
  ])('rejects native creation when %s', (_description, overrides) => {
    expect(() => buildNativeIntentCreateRequest({
      payload: validPayload(),
      actorId: 7,
      idempotencyKey: IDEMPOTENCY_KEY,
      ...overrides,
    })).toThrow(PolicyNativeIntentCreateRequestError);
  });
});
