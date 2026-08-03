import {
  POLICY_INTENT_AUTHORITY_CONTRACT_VERSION,
  POLICY_INTENT_AUTHORITY_SOURCE_IDS,
  POLICY_INTENT_DECLARATION_STATUS_IDS,
  POLICY_INTENT_LEGACY_PROJECTION_STATUS_IDS,
  POLICY_INTENT_OBSERVED_EVIDENCE_STATUS_IDS,
  POLICY_INTENT_ROUTING_TARGET_STATUS_IDS,
  POLICY_INTENT_VALIDATION_STATUS_IDS,
  buildPolicyIntentAuthorityContract,
  validatePolicyIntentAuthorityContract,
} from '../../services/policyIntentAuthorityContract.mjs';

function nativeReadPath(overrides = {}) {
  return {
    sourceId: POLICY_INTENT_AUTHORITY_SOURCE_IDS.NATIVE_INTENT,
    statusId: 'native_intent_active',
    policy_intent_contract: {
      policy_id: 14,
      library_id: 4,
      source: 'native_intent',
      purpose: [{
        intent_role: 'purpose',
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Animation'] },
        constraint_mode: 'advisory',
        semantics: 'identity',
      }],
      hard_limits: [{
        intent_role: 'hard_limit',
        signal_type: 'certifications',
        operator: 'max',
        values: { max: 'PG-13' },
        constraint_mode: 'strict',
        semantics: 'compatibility',
      }],
      helpful_hints: [{
        intent_role: 'helpful_hint',
        signal_type: 'keywords',
        operator: 'prefer',
        values: { prefer: ['anime'] },
        constraint_mode: 'advisory',
        semantics: 'compatibility',
      }],
      avoid: [{
        intent_role: 'avoid',
        signal_type: 'certifications',
        operator: 'exclude',
        values: { exclude: ['NC-17'] },
        constraint_mode: 'advisory',
        semantics: 'compatibility',
      }],
      review_behavior: { require_ai_validation: true },
      warnings: [{
        reason_code: 'profile_stale',
        severity: 'warning',
        summary: 'Observed profile needs refresh.',
      }],
      validation: {
        valid: true,
        error_count: 0,
        warning_count: 1,
        errors: [],
        warnings: [{ code: 'profile_stale' }],
      },
    },
    ...overrides,
  };
}

describe('policyIntentAuthorityContract', () => {
  test('publishes native declared intent with bounded server-owned references', () => {
    const contract = buildPolicyIntentAuthorityContract({
      policy: { id: 14, library_id: 4 },
      runtimeReadPath: nativeReadPath(),
      authorityContext: {
        routing_target: {
          arr_type: 'radarr',
          target_status: 'configured',
          arr_root_folder_path: '/private/media',
        },
        observed_evidence_reference: {
          source_id: 'stored_library_profile',
          capture_state: 'captured',
          capture_reason_id: 'stored_profile_captured',
          profile_freshness_state: 'current',
          expires_at: '2026-08-16T00:00:00.000Z',
          snapshot_payload: { private: 'must not be exposed' },
        },
      },
    });

    expect(contract).toEqual(expect.objectContaining({
      version: POLICY_INTENT_AUTHORITY_CONTRACT_VERSION,
      authority: {
        source_id: POLICY_INTENT_AUTHORITY_SOURCE_IDS.NATIVE_INTENT,
        status_id: 'native_intent_active',
        authoritative: true,
      },
      declared_intent: expect.objectContaining({
        status_id: POLICY_INTENT_DECLARATION_STATUS_IDS.DECLARED,
        purpose: [expect.objectContaining({ signal_type: 'genres' })],
        helpful_matches: [expect.objectContaining({ signal_type: 'keywords' })],
      }),
      hard_limits: expect.objectContaining({
        status_id: POLICY_INTENT_DECLARATION_STATUS_IDS.DECLARED,
        rules: [expect.objectContaining({ signal_type: 'certifications' })],
      }),
      avoid_rules: expect.objectContaining({
        status_id: POLICY_INTENT_DECLARATION_STATUS_IDS.DECLARED,
        rules: [expect.objectContaining({ operator: 'exclude' })],
      }),
      observed_evidence_reference: expect.objectContaining({
        status_id: POLICY_INTENT_OBSERVED_EVIDENCE_STATUS_IDS.AVAILABLE,
        source_id: 'stored_library_profile',
      }),
      routing_target: {
        status_id: POLICY_INTENT_ROUTING_TARGET_STATUS_IDS.CONFIGURED,
        arr_type: 'radarr',
      },
      validation_status: expect.objectContaining({
        status_id: POLICY_INTENT_VALIDATION_STATUS_IDS.WARNING,
        warning_codes: ['profile_stale'],
      }),
      legacy_projection: {
        status_id: POLICY_INTENT_LEGACY_PROJECTION_STATUS_IDS.NOT_USED,
        final_authority: false,
      },
    }));
    expect(JSON.stringify(contract)).not.toContain('snapshot_payload');
    expect(JSON.stringify(contract)).not.toContain('/private/media');
    expect(validatePolicyIntentAuthorityContract(contract)).toEqual({
      valid: true,
      error_count: 0,
      errors: [],
    });
  });

  test('marks compatibility projection as inferred and read-only rather than declared authority', () => {
    const contract = buildPolicyIntentAuthorityContract({
      policy: { id: 14, library_id: 4 },
      runtimeReadPath: nativeReadPath({
        sourceId: POLICY_INTENT_AUTHORITY_SOURCE_IDS.COMPATIBILITY_BRIDGE,
        statusId: 'compatibility_bridge_fallback',
        policy_intent_contract: {
          ...nativeReadPath().policy_intent_contract,
          source: 'legacy_presets',
        },
      }),
    });

    expect(contract.authority).toEqual({
      source_id: POLICY_INTENT_AUTHORITY_SOURCE_IDS.COMPATIBILITY_BRIDGE,
      status_id: 'compatibility_bridge_fallback',
      authoritative: false,
    });
    expect(contract.declared_intent).toEqual({
      status_id: POLICY_INTENT_DECLARATION_STATUS_IDS.NOT_DECLARED,
      purpose: [],
      helpful_matches: [],
    });
    expect(contract.hard_limits.status_id)
      .toBe(POLICY_INTENT_DECLARATION_STATUS_IDS.INFERRED_COMPATIBILITY);
    expect(contract.legacy_projection).toEqual({
      status_id: POLICY_INTENT_LEGACY_PROJECTION_STATUS_IDS.READ_ONLY_COMPATIBILITY_BRIDGE,
      final_authority: false,
    });
  });

  test('fails closed when a compatibility projection claims authority or raw evidence', () => {
    const contract = buildPolicyIntentAuthorityContract({
      runtimeReadPath: nativeReadPath({
        sourceId: POLICY_INTENT_AUTHORITY_SOURCE_IDS.COMPATIBILITY_BRIDGE,
        statusId: 'compatibility_bridge_fallback',
      }),
    });
    contract.authority.authoritative = true;
    contract.observed_evidence_reference.projection = { raw: true };

    expect(validatePolicyIntentAuthorityContract(contract)).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: 'compatibility_bridge_marked_authoritative' }),
        expect.objectContaining({ code: 'raw_observed_evidence_exposed' }),
      ]),
    }));
  });
});
