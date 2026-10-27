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
        source: 'native_intent',
        inference_state: 'inferred',
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
        source: 'operator_declared_intent',
        inference_state: 'inferred',
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
      purpose_provenance: {
        id: 'declared_native',
        declarationRequired: false,
        rawRuleProvenanceExposed: false,
      },
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

  test.each([
    ['native declaration', { source: 'native_intent', inference_state: 'inferred' }, 'declared_native', true],
    ['operator declaration', { source: 'operator_declared_intent', inference_state: 'inferred' }, 'declared_native', true],
    ['profile observation', { source: 'media_server_library_profile', inference_state: 'inferred' }, 'profile_derived', false],
    ['migrated base', { source: 'base', inference_state: 'inferred' }, 'unverified', false],
    ['unknown source', { source: 'provider_supplied_intent', inference_state: 'inferred' }, 'unverified', false],
    ['missing provenance', {}, 'unverified', false],
    ['malformed profile provenance', { source: 'media_server_library_profile', inference_state: 'declared' }, 'unverified', false],
  ])('separates native storage authority from %s purpose', (_name, provenance, provenanceId, declared) => {
    const readPath = nativeReadPath();
    const storedPurpose = readPath.policy_intent_contract.purpose[0];
    delete storedPurpose.source;
    delete storedPurpose.inference_state;
    Object.assign(storedPurpose, provenance);
    readPath.policy_intent_contract.helpful_hints = [{
      ...readPath.policy_intent_contract.helpful_hints[0],
      ...provenance,
      source: provenance.source,
      inference_state: provenance.inference_state,
    }];
    const before = JSON.stringify(readPath);

    const contract = buildPolicyIntentAuthorityContract({ runtimeReadPath: readPath });

    expect(contract.authority).toMatchObject({ source_id: 'native_intent', authoritative: true });
    expect(contract.purpose_provenance).toEqual({
      id: provenanceId,
      declarationRequired: !declared,
      rawRuleProvenanceExposed: false,
    });
    expect(contract.declared_intent.status_id).toBe(declared ? 'declared' : 'not_declared');
    expect(contract.declared_intent.purpose).toHaveLength(declared ? 1 : 0);
    expect(contract.declared_intent.helpful_matches).toHaveLength(declared ? 1 : 0);
    expect(contract.hard_limits.status_id).toBe('declared');
    expect(contract.avoid_rules.status_id).toBe('declared');
    expect(contract.legacy_projection.status_id).toBe('not_used');
    for (const rule of [...contract.declared_intent.purpose, ...contract.declared_intent.helpful_matches]) {
      expect(rule).not.toHaveProperty('source');
      expect(rule).not.toHaveProperty('inference_state');
    }
    expect(JSON.stringify(readPath)).toBe(before);
    expect(validatePolicyIntentAuthorityContract(contract).valid).toBe(true);
  });

  test('keeps only declared rule subsets when stored native purpose is mixed', () => {
    const readPath = nativeReadPath();
    const declaredRule = readPath.policy_intent_contract.purpose[0];
    const helpfulRule = readPath.policy_intent_contract.helpful_hints[0];
    readPath.policy_intent_contract.purpose.push({
      ...declaredRule,
      values: { require_any: ['Observed only'] },
      source: 'media_server_library_profile',
    }, {
      ...declaredRule,
      values: { require_any: ['Migrated only'] },
      source: 'base',
    });
    readPath.policy_intent_contract.helpful_hints.push({
      ...helpfulRule,
      values: { prefer: ['Observed hint only'] },
      source: 'media_server_library_profile',
    });

    const contract = buildPolicyIntentAuthorityContract({ runtimeReadPath: readPath });

    expect(contract.purpose_provenance).toEqual({
      id: 'mixed', declarationRequired: true, rawRuleProvenanceExposed: false,
    });
    expect(contract.declared_intent).toEqual({
      status_id: 'not_declared',
      purpose: [expect.objectContaining({ values: { require_any: ['Animation'] } })],
      helpful_matches: [expect.objectContaining({ values: { prefer: ['anime'] } })],
    });
    expect(JSON.stringify(contract.declared_intent)).not.toContain('Observed');
    expect(JSON.stringify(contract.declared_intent)).not.toContain('Migrated');
    expect(JSON.stringify(contract.declared_intent)).not.toContain('source');
    expect(validatePolicyIntentAuthorityContract(contract).valid).toBe(true);
  });

  test.each([
    ['empty', []],
    ['null rule', [null]],
    ['malformed source', [{ source: 17 }]],
  ])('does not declare %s native purpose', (_name, purpose) => {
    const readPath = nativeReadPath();
    readPath.policy_intent_contract.purpose = purpose;

    const contract = buildPolicyIntentAuthorityContract({ runtimeReadPath: readPath });

    expect(contract.authority.authoritative).toBe(true);
    expect(contract.purpose_provenance.id).toBe('unverified');
    expect(contract.declared_intent.status_id).toBe('not_declared');
    expect(contract.declared_intent.purpose).toEqual([]);
    expect(validatePolicyIntentAuthorityContract(contract).valid).toBe(true);
  });

  test('rejects malformed aggregate provenance and contradictory declaration claims', () => {
    const readPath = nativeReadPath();
    readPath.policy_intent_contract.purpose[0].source = 'base';
    const undeclaredContract = buildPolicyIntentAuthorityContract({ runtimeReadPath: readPath });
    undeclaredContract.declared_intent.status_id = 'declared';
    expect(validatePolicyIntentAuthorityContract(undeclaredContract).errors).toContainEqual({
      code: 'declared_purpose_provenance_mismatch', path: 'declared_intent',
    });

    const declaredContract = buildPolicyIntentAuthorityContract({ runtimeReadPath: nativeReadPath() });
    declaredContract.purpose_provenance = {
      ...declaredContract.purpose_provenance,
      source: 'private rule provenance',
    };
    expect(validatePolicyIntentAuthorityContract(declaredContract).errors).toContainEqual({
      code: 'invalid_purpose_provenance', path: 'purpose_provenance',
    });
    declaredContract.purpose_provenance = {
      id: 'declared_native', declarationRequired: true, rawRuleProvenanceExposed: false,
    };
    expect(validatePolicyIntentAuthorityContract(declaredContract).errors).toContainEqual({
      code: 'invalid_purpose_provenance', path: 'purpose_provenance',
    });
  });

  test('rejects a declared section with no purpose rules or an unknown declaration status', () => {
    const contract = buildPolicyIntentAuthorityContract({ runtimeReadPath: nativeReadPath() });
    contract.declared_intent.purpose = [];
    expect(validatePolicyIntentAuthorityContract(contract).errors).toContainEqual({
      code: 'declared_purpose_provenance_mismatch', path: 'declared_intent',
    });
    contract.declared_intent.status_id = 'profile_derived';
    contract.declared_intent.helpful_matches = null;
    expect(validatePolicyIntentAuthorityContract(contract).errors).toEqual(expect.arrayContaining([
      { code: 'unknown_declaration_status', path: 'declared_intent.status_id' },
      { code: 'invalid_declared_rules', path: 'declared_intent' },
    ]));
  });

  test('rejects raw purpose or helpful-rule provenance in the public declared section', () => {
    const contract = buildPolicyIntentAuthorityContract({ runtimeReadPath: nativeReadPath() });
    contract.declared_intent.purpose[0].source = 'native_intent';
    contract.declared_intent.helpful_matches[0].inference_state = 'inferred';

    expect(validatePolicyIntentAuthorityContract(contract).errors).toContainEqual({
      code: 'raw_declared_rule_provenance_exposed', path: 'declared_intent',
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
