import {
  attachActiveNativeIntentForPolicy,
  attachActiveNativeIntentsForPolicies,
  attachNativeIntentToPolicy,
  buildNativeContractFromRows,
  fetchActiveNativeIntentForPolicy,
  fetchActiveNativeIntentsForPolicies,
} from '../../services/policyNativePolicyReadService.mjs';
import {
  POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS,
} from '../../services/policyNativeIntentAuthority.mjs';

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Animated Movies',
    library_media_type: 'movie',
    name: 'Animated Policy',
    presets: [{
      id: 7,
      key: 'family',
      name: 'Family',
      signals: {
        genres: { require_any: ['Family'] },
      },
      custom_signals: {
        genres: { require_any: ['Family'] },
      },
    }],
    ...overrides,
  };
}

function intent(overrides = {}) {
  return {
    id: 501,
    policy_id: 14,
    library_id: 4,
    schema_version: 1,
    intent_version: 2,
    active: true,
    source: 'native_intent',
    inference_state: 'inferred',
    review_behavior: {
      auto_classify_threshold: 85,
      prompt_threshold: 60,
      require_ai_validation: true,
    },
    validation_status: 'valid',
    purpose_rule_count: 1,
    ...overrides,
  };
}

function rule(overrides = {}) {
  return {
    intent_role: 'purpose',
    collection: 'purpose',
    signal_type: 'genres',
    operator: 'require_any',
    values: { require_any: ['Animation'] },
    constraint_mode: 'advisory',
    semantics: 'identity',
    source: 'native_intent',
    inference_state: 'inferred',
    sort_order: 0,
    ...overrides,
  };
}

function createNativeIntentDbClient(rows) {
  const calls = [];

  return {
    calls,
    async query(...args) {
      calls.push(args);
      return { rows };
    },
  };
}

describe('policyNativePolicyReadService', () => {
  test('builds a native contract from persisted native rows', () => {
    const contract = buildNativeContractFromRows({
      policy: policy(),
      intent: intent(),
      rules: [
        rule(),
        rule({
          intent_role: 'avoid',
          collection: 'avoid',
          signal_type: 'certifications',
          operator: 'exclude',
          values: { exclude: ['NC-17'] },
          semantics: 'compatibility',
        }),
      ],
      templates: [{
        preset_id: 7,
        preset_key: 'family',
        preset_name: 'Family',
        weight: '1.000',
        signal_count: 1,
        link_state: 'applied',
      }],
      validation: {
        status: 'valid',
        error_count: 0,
        warning_count: 0,
        errors: [],
        warnings: [],
      },
    });

    expect(contract).toEqual(expect.objectContaining({
      source: 'native_intent',
      inference_state: 'inferred',
      policy_id: 14,
      library_id: 4,
      validation: expect.objectContaining({
        valid: true,
        error_count: 0,
      }),
    }));
    expect(contract.purpose).toEqual([
      expect.objectContaining({
        signal_type: 'genres',
        values: { require_any: ['Animation'] },
      }),
    ]);
    expect(contract.avoid).toEqual([
      expect.objectContaining({
        signal_type: 'certifications',
        values: { exclude: ['NC-17'] },
      }),
    ]);
    expect(contract.template_links).toEqual([
      expect.objectContaining({
        preset_id: 7,
        preset_key: 'family',
        weight: 1,
      }),
    ]);
  });

  test('attaches active native intent without deleting legacy preset context', () => {
    const attached = attachNativeIntentToPolicy({
      policy: policy(),
      intent: intent(),
      rules: [rule()],
      templates: [],
      validation: {
        status: 'valid',
        error_count: 0,
        warning_count: 0,
        errors: [],
        warnings: [],
      },
    });

    expect(attached.presets).toHaveLength(1);
    expect(attached.native_intent_active).toBe(true);
    expect(attached.native_intent_version).toBe(2);
    expect(attached.native_intent.contract.source).toBe('native_intent');
    expect(attached.native_intent.contract.purpose[0].values)
      .toEqual({ require_any: ['Animation'] });
  });

  test('does not select a native intent when duplicate active rows are returned', async () => {
    const dbClient = createNativeIntentDbClient([
      intent({ id: 501, intent_version: 2 }),
      intent({ id: 502, intent_version: 1 }),
    ]);

    const nativeIntent = await fetchActiveNativeIntentForPolicy(dbClient, 14);

    expect(nativeIntent).toEqual({
      authority: {
        stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS,
        activeIntentCount: 2,
        authoritative: false,
      },
      intent: null,
      rules: [],
      templates: [],
      validation: null,
    });
    expect(dbClient.calls).toHaveLength(1);
    expect(dbClient.calls[0][0]).toContain('LIMIT 2');
  });

  test('attaches only bounded authority metadata when the active native row is ambiguous', async () => {
    const dbClient = createNativeIntentDbClient([
      intent({ id: 501 }),
      intent({ id: 502, intent_version: 1 }),
    ]);

    const attached = await attachActiveNativeIntentForPolicy({
      dbClient,
      policy: policy(),
    });

    expect(attached.native_intent).toBeUndefined();
    expect(attached.native_intent_authority).toEqual({
      stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS,
      activeIntentCount: 2,
      authoritative: false,
    });
  });

  test('batch-loads child rows only for policies with exactly one active native intent', async () => {
    const calls = [];
    const dbClient = {
      async query(query) {
        calls.push(query);
        if (query.includes('ranked_active_intents')) {
          return {
            rows: [
              intent({ id: 501, policy_id: 14 }),
              intent({ id: 502, policy_id: 15 }),
              intent({ id: 503, policy_id: 15, intent_version: 1 }),
            ],
          };
        }
        if (query.includes('policy_intent_rules')) {
          return { rows: [rule({ intent_id: 501 })] };
        }
        if (query.includes('policy_intent_template_applications')) {
          return { rows: [] };
        }
        if (query.includes('policy_intent_validation_status')) {
          return { rows: [{ intent_id: 501, status: 'valid', error_count: 0, warning_count: 0 }] };
        }
        throw new Error(`Unexpected query: ${query}`);
      },
    };

    const nativeIntents = await fetchActiveNativeIntentsForPolicies(dbClient, [14, 15, 16]);
    const attached = await attachActiveNativeIntentsForPolicies({
      dbClient,
      policies: [policy(), policy({ id: 15 }), policy({ id: 16 })],
    });

    expect(nativeIntents.get(14)).toEqual(expect.objectContaining({
      intent: expect.objectContaining({ id: 501 }),
      rules: [expect.objectContaining({ intent_id: 501 })],
    }));
    expect(nativeIntents.get(15)).toEqual(expect.objectContaining({
      authority: expect.objectContaining({
        stateId: POLICY_NATIVE_INTENT_AUTHORITY_STATE_IDS.AMBIGUOUS_ACTIVE_NATIVE_INTENTS,
      }),
      intent: null,
      rules: [],
    }));
    expect(nativeIntents.has(16)).toBe(false);
    expect(calls.filter((query) => /^\s*SELECT \*\s+FROM policy_intent_rules/m.test(query))).toHaveLength(2);
    expect(attached[0].native_intent.contract.purpose).toHaveLength(1);
    expect(attached[1].native_intent).toBeUndefined();
    expect(attached[1].native_intent_authority.authoritative).toBe(false);
  });
});
