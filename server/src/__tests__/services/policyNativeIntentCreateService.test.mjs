import { jest } from '@jest/globals';

const applyPolicyInitialIntentEstablishmentInTransaction = jest.fn();

jest.unstable_mockModule('../../services/policyInitialIntentEstablishmentService.mjs', () => ({
  POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS: {
    ESTABLISHED: 'initial_intent_established',
    REPLAYED: 'initial_intent_establishment_replayed',
  },
  applyPolicyInitialIntentEstablishmentInTransaction,
}));

const {
  PolicyNativeIntentCreateConflictError,
  createNativeIntentPolicyInTransaction,
} = await import('../../services/policyNativeIntentCreateService.mjs');

const IDEMPOTENCY_KEY = '6fe3d170-9390-4ec5-95f7-42ad6f8ec777';

function establishmentRequest() {
  return {
    schema_version: 1,
    idempotency_key: IDEMPOTENCY_KEY,
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
  };
}

function policy() {
  return {
    libraryId: 4,
    name: 'Animation Policy',
    description: null,
    enabled: true,
    priority: 5,
    sortOrder: 0,
    autoClassifyThreshold: 85,
    promptThreshold: 60,
    requireAiValidation: true,
    trustPatterns: true,
    trustRag: true,
    trustHistory: true,
    presetWeight: 0.35,
    profileWeight: 0.25,
    patternWeight: 0.15,
    ragWeight: 0.15,
    historyWeight: 0.1,
    combinationMode: 'best_match',
  };
}

function clientFor({ acquired = true, receipt = null } = {}) {
  return {
    query: jest.fn(async (sql) => {
      const statement = String(sql);
      if (statement.includes('pg_try_advisory_xact_lock')) {
        return { rows: [{ acquired }] };
      }
      if (statement.includes('FROM policy_initial_intent_establishments establishment')) {
        return { rows: receipt ? [receipt] : [] };
      }
      if (statement.includes('INSERT INTO library_policies')) {
        return { rows: [{ id: 71, library_id: 4, name: 'Animation Policy' }] };
      }
      return { rows: [] };
    }),
  };
}

describe('policyNativeIntentCreateService', () => {
  beforeEach(() => {
    applyPolicyInitialIntentEstablishmentInTransaction.mockReset();
    applyPolicyInitialIntentEstablishmentInTransaction.mockResolvedValue({
      statusId: 'initial_intent_established',
      establishment: { intentId: 301, applied: true, replayed: false },
      summary: { routingConfigured: true, ruleCount: 1 },
    });
  });

  test('creates the policy and first native authority in one caller-owned transaction', async () => {
    const client = clientFor();

    const result = await createNativeIntentPolicyInTransaction({
      client,
      policy: policy(),
      actorId: 7,
      establishmentRequest: establishmentRequest(),
    });

    expect(result.policy.id).toBe(71);
    expect(result.nativeIntentEstablishment.statusId).toBe('initial_intent_established');
    expect(applyPolicyInitialIntentEstablishmentInTransaction).toHaveBeenCalledWith({
      client,
      policyId: 71,
      actorId: 7,
      request: establishmentRequest(),
    });
  });

  test('replays the original persisted result without inserting another policy', async () => {
    const { buildInitialIntentRequestFingerprint } = await import(
      '../../services/policyInitialIntentEstablishmentContract.mjs'
    );
    const client = clientFor({
      receipt: {
        policy_id: 71,
        library_id: 4,
        intent_id: 301,
        policy_name: 'Animation Policy',
        accepted_by: 7,
        state: 'established',
        request_fingerprint: buildInitialIntentRequestFingerprint(establishmentRequest()),
        rule_count: 1,
        routing_configured: true,
      },
    });

    const result = await createNativeIntentPolicyInTransaction({
      client,
      policy: policy(),
      actorId: 7,
      establishmentRequest: establishmentRequest(),
    });

    expect(result).toEqual(expect.objectContaining({
      policy: expect.objectContaining({ id: 71, name: 'Animation Policy' }),
      nativeIntentEstablishment: expect.objectContaining({
        statusId: 'initial_intent_establishment_replayed',
        establishment: expect.objectContaining({ replayed: true, intentId: 301 }),
      }),
    }));
    expect(applyPolicyInitialIntentEstablishmentInTransaction).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO library_policies'),
      expect.anything()
    );
  });

  test('returns a bounded conflict when the same key is already in progress', async () => {
    await expect(createNativeIntentPolicyInTransaction({
      client: clientFor({ acquired: false }),
      policy: policy(),
      actorId: 7,
      establishmentRequest: establishmentRequest(),
    })).rejects.toMatchObject({
      name: PolicyNativeIntentCreateConflictError.name,
      code: 'POLICY_NATIVE_INTENT_CREATE_IDEMPOTENCY_KEY_IN_PROGRESS',
    });
  });

  test('rejects a replay key when the identity or payload no longer matches', async () => {
    const client = clientFor({
      receipt: {
        policy_id: 71,
        library_id: 4,
        intent_id: 301,
        policy_name: 'Another Policy',
        accepted_by: 7,
        state: 'established',
        request_fingerprint: 'different',
      },
    });

    await expect(createNativeIntentPolicyInTransaction({
      client,
      policy: policy(),
      actorId: 7,
      establishmentRequest: establishmentRequest(),
    })).rejects.toMatchObject({
      name: PolicyNativeIntentCreateConflictError.name,
      code: 'POLICY_NATIVE_INTENT_CREATE_IDEMPOTENCY_KEY_REUSED',
    });
  });
});
