import {
  POLICY_INTENT_WRITE_OPERATION_IDS,
  PolicyIntentWriteAdmissionError,
  buildPolicyCreateWriteAdmission,
  buildPolicyIntentWriteResult,
  buildPolicyUpdateWriteAdmission,
} from '../../services/policyIntentWriteAdmission.mjs';

const IDEMPOTENCY_KEY = '6fe3d170-9390-4ec5-95f7-42ad6f8ec777';

function nativePayload() {
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
  };
}

describe('policyIntentWriteAdmission', () => {
  test('admits an allow-listed native create with a header-owned idempotency key', () => {
    const admission = buildPolicyCreateWriteAdmission({
      payload: nativePayload(),
      actorId: 7,
      actorRole: 'admin',
      headers: { 'idempotency-key': `"${IDEMPOTENCY_KEY}"` },
    });

    expect(admission).toEqual(expect.objectContaining({
      operationId: POLICY_INTENT_WRITE_OPERATION_IDS.NATIVE_INITIAL_INTENT_CREATE,
      authorityMode: 'native_intent',
      intentWritePreflight: null,
      nativeCreate: expect.objectContaining({
        identity: { libraryId: 4, name: 'Animation Policy' },
      }),
    }));
    expect(admission.nativeCreate.establishmentRequest.idempotency_key).toBe(IDEMPOTENCY_KEY);
  });

  test('requires a native-create key and explicitly rejects native establishment on update', () => {
    expect(() => buildPolicyCreateWriteAdmission({
      payload: nativePayload(),
      actorId: 7,
      actorRole: 'admin',
      headers: {},
    })).toThrow('Idempotency-Key');

    expect(() => buildPolicyUpdateWriteAdmission({
      payload: nativePayload(),
    })).toThrow(PolicyIntentWriteAdmissionError);
  });

  test('returns only bounded outcome metadata for a validated sidecar', () => {
    const admission = {
      operationId: POLICY_INTENT_WRITE_OPERATION_IDS.LEGACY_COMPATIBILITY_CREATE,
      authorityMode: 'legacy_compatibility',
      intentWritePreflight: {
        draft_schema_version: 1,
      },
    };

    expect(buildPolicyIntentWriteResult({ admission })).toEqual({
      version: 1,
      operation_id: 'legacy_compatibility_create',
      authority_mode: 'legacy_compatibility',
      persistence_status: 'committed',
      retry: {
        mode: 'not_available_for_legacy_compatibility',
        replayed: false,
      },
      draft_sidecar: {
        status: 'validated_not_persisted',
        schema_version: 1,
      },
    });
  });
});
