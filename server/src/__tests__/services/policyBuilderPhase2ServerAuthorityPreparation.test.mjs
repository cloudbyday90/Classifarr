import {
  POLICY_INTENT_DRAFT_BUCKETS,
  POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
} from '../../services/policyIntentRequestValidator.mjs';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
} from '../../services/policyIntentSchema.mjs';
import {
  PHASE_2R_AUTHORITY_AUDIT_RISK_IDS,
  PHASE_2R_AUTHORITY_INSERTION_POINT_IDS,
  PHASE_2R_AUTHORITY_OWNER_IDS,
  PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS,
  PHASE_2R_AUTHORITY_RISK_IDS,
  PHASE_2R_AUTHORITY_WARNING_REASON_IDS,
  PHASE_2R_NATIVE_STORAGE_MODE_IDS,
  buildPhase2RServerAuthorityAudit,
  buildPhase2RServerAuthorityPreflight,
  getPhase2RAuthorityInsertionPoint,
  getPhase2RAuthorityResponsibility,
  listPhase2RAuthorityInsertionPoints,
  listPhase2RAuthorityResponsibilities,
  listPhase2RAuthorityResponsibilitiesByOwner,
  listPhase2RNativeStorageReplacementSteps,
  listPhase2RServerWarningReasonIds,
  summarizePhase2RServerAuthorityPreparation,
  validatePhase2RAuthorityAssignment,
  validatePhase2RAuthorityResponsibilityRecord,
  validatePhase2RInsertionPointRecord,
  validatePhase2RServerInsertionPoint,
} from '../../services/policyBuilderPhase2ServerAuthorityPreparation.mjs';
import {
  POLICY_AUTHORING_DRAFT_COMMAND_IDS as PHASE_2R_DRAFT_COMMAND_IDS,
} from '../../services/policyAuthoringDraftCommandBoundary.mjs';
import {
  PHASE_2R_DRAFT_FIELD_IDS,
} from '../../services/policyBuilderPhase2DraftContract.mjs';

function validDraft(overrides = {}) {
  return {
    schema_version: POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
    source: 'legacy_policy_builder',
    migration_state: 'legacy_compatible',
    presets: [{
      preset_id: 14,
      preset_name: 'Family',
      weight: 1,
      source: 'legacy_preset',
      migration_state: 'legacy_compatible',
      buckets: {
        [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
          signal_type: 'genres',
          values: { require_any: ['Family'] },
          metadata: { semantics: 'identity' },
          source: 'intent_draft',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: [],
      },
      warnings: [],
    }],
    summary: {
      preset_count: 1,
      counts: {
        [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: 1,
        [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: 0,
        [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: 0,
        [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: 0,
        [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: 0,
      },
    },
    ...overrides,
  };
}

describe('policyBuilderPhase2ServerAuthorityPreparation', () => {
  test('defines the Phase 2R.5 authority responsibility inventory', () => {
    expect(listPhase2RAuthorityResponsibilities().map(record => record.id)).toEqual([
      PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_COMMAND_GUARDRAILS,
      PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_VIEW_GUARDRAILS,
      PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.ROUTE_PAYLOAD_PREFLIGHT,
      PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
      PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_CONTRACT_VALIDATION,
      PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT,
      PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.LEGACY_BRIDGE_SERIALIZATION,
      PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.PROFILE_TO_INTENT_SUGGESTIONS,
      PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.NATIVE_INTENT_STORAGE_REPLACEMENT,
    ]);

    expect(getPhase2RAuthorityResponsibility(PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA))
      .toEqual(expect.objectContaining({
        ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR,
        authoritative: true,
        currentModulePath: 'server/src/services/policyIntentRequestValidator.mjs',
        insertionPointId: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
      }));
  });

  test('summarizes server authority with client draft subordinate to server validation', () => {
    expect(summarizePhase2RServerAuthorityPreparation()).toEqual({
      responsibilityCount: 9,
      insertionPointCount: 5,
      nativeStorageReplacementStepCount: 4,
      countsByOwner: {
        [PHASE_2R_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL]: 2,
        [PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_ROUTE_PREFLIGHT]: 1,
        [PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR]: 1,
        [PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_INTENT_CONTRACT]: 2,
        [PHASE_2R_AUTHORITY_OWNER_IDS.LEGACY_BRIDGE_COMPATIBILITY]: 1,
        [PHASE_2R_AUTHORITY_OWNER_IDS.PHASE_6R_ENGINE_PROJECTION]: 1,
        [PHASE_2R_AUTHORITY_OWNER_IDS.PHASE_8R_NATIVE_STORAGE]: 1,
      },
      clientDraftAuthoritative: false,
      serverValidationAuthoritative: true,
      nativeIntentPersistenceEnabled: false,
      nativeIntentStorageMode: PHASE_2R_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
      phase5InsertionPointIds: [
        PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_CONTRACT_VALIDATOR,
      ],
      phase6InsertionPointIds: [
        PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER,
      ],
      phase8InsertionPointIds: [
        PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.NATIVE_INTENT_STORAGE_MAPPER,
      ],
    });
  });

  test('audits the default server authority contract as clean', () => {
    expect(buildPhase2RServerAuthorityAudit()).toEqual({
      ok: true,
      checkedResponsibilityCount: 9,
      requiredResponsibilityCount: 9,
      checkedInsertionPointCount: 5,
      requiredInsertionPointCount: 5,
      responsibilityResults: listPhase2RAuthorityResponsibilities().map(record => ({
        valid: true,
        responsibilityId: record.id,
        issues: [],
      })),
      insertionPointResults: listPhase2RAuthorityInsertionPoints().map(record => ({
        valid: true,
        insertionPointId: record.id,
        issues: [],
      })),
      missingResponsibilityIds: [],
      duplicateResponsibilityIds: [],
      missingInsertionPointIds: [],
      duplicateInsertionPointIds: [],
      missingWarningReasonIds: [],
      missingNativeStorageStepIds: [],
      nativeStorageMode: PHASE_2R_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
      issues: [],
    });
  });

  test('fails unsafe responsibility records with explicit authority audit risks', () => {
    expect(validatePhase2RAuthorityResponsibilityRecord({
      id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_COMMAND_GUARDRAILS,
      ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL,
      authoritative: true,
      currentModulePath: '',
      insertionPointId: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_WRITE_ROUTE_PREFLIGHT,
      notes: '',
    })).toEqual({
      valid: false,
      responsibilityId: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_COMMAND_GUARDRAILS,
      issues: [
        {
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.MISSING_MODULE_BOUNDARY,
          reason: 'Authority responsibility must declare a module path and boundary note.',
        },
        {
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.CLIENT_MARKED_AUTHORITATIVE,
          reason: 'Client UX guardrails cannot be authoritative for durable policy validity.',
        },
      ],
    });

    expect(validatePhase2RAuthorityResponsibilityRecord({
      id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
      ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR,
      authoritative: false,
      currentModulePath: 'server/src/services/policyIntentRequestValidator.mjs',
      insertionPointId: 'unknown_insertion_point',
      notes: 'Invalid insertion point.',
    })).toEqual({
      valid: false,
      responsibilityId: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
      issues: [
        {
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.SERVER_MARKED_NON_AUTHORITATIVE,
          reason: 'Server authority and native storage responsibilities must be authoritative when active.',
        },
        {
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_INSERTION_POINT,
          reason: 'Authority responsibility references an unknown insertion point.',
        },
      ],
    });
  });

  test('fails insertion points that echo raw drafts or lack module boundaries', () => {
    expect(validatePhase2RInsertionPointRecord({
      id: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
      modulePath: '',
      currentEntryPoint: 'validatePolicyIntentWritePayload',
      targetPhase: '2R.5',
      blocksRawDraftEcho: false,
    })).toEqual({
      valid: false,
      insertionPointId: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
      issues: [
        {
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.MISSING_MODULE_BOUNDARY,
          reason: 'Insertion point must declare a module path.',
        },
        {
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.INSERTION_POINT_ECHOES_RAW_DRAFT,
          reason: 'Insertion points must block raw draft echo.',
        },
      ],
    });
  });

  test('audits missing records and premature native storage activation', () => {
    const responsibilities = [
      ...listPhase2RAuthorityResponsibilities().filter(record => (
        record.id !== PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT
      )),
      getPhase2RAuthorityResponsibility(PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA),
    ];
    const insertionPoints = listPhase2RAuthorityInsertionPoints().filter(record => (
      record.id !== PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER
    ));
    const warningReasonIds = listPhase2RServerWarningReasonIds().filter(reasonId => (
      reasonId !== PHASE_2R_AUTHORITY_WARNING_REASON_IDS.LEGACY_PRESET_PARTIAL_INFERENCE
    ));
    const nativeStorageSteps = listPhase2RNativeStorageReplacementSteps().filter(step => (
      step.id !== 'serialize_to_native_intent'
    ));

    expect(buildPhase2RServerAuthorityAudit({
      responsibilities,
      insertionPoints,
      warningReasonIds,
      nativeStorageSteps,
      nativeStorageMode: PHASE_2R_NATIVE_STORAGE_MODE_IDS.NATIVE_STORAGE_READY,
    })).toEqual(expect.objectContaining({
      ok: false,
      checkedResponsibilityCount: 9,
      checkedInsertionPointCount: 4,
      missingResponsibilityIds: [PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT],
      duplicateResponsibilityIds: [PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA],
      missingInsertionPointIds: [PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER],
      duplicateInsertionPointIds: [],
      missingWarningReasonIds: [PHASE_2R_AUTHORITY_WARNING_REASON_IDS.LEGACY_PRESET_PARTIAL_INFERENCE],
      missingNativeStorageStepIds: ['serialize_to_native_intent'],
      nativeStorageMode: PHASE_2R_NATIVE_STORAGE_MODE_IDS.NATIVE_STORAGE_READY,
      issues: expect.arrayContaining([
        expect.objectContaining({
          responsibilityId: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT,
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
        }),
        expect.objectContaining({
          responsibilityId: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
        }),
        expect.objectContaining({
          insertionPointId: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER,
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_INSERTION_POINT,
        }),
        expect.objectContaining({
          warningReasonId: PHASE_2R_AUTHORITY_WARNING_REASON_IDS.LEGACY_PRESET_PARTIAL_INFERENCE,
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.MISSING_WARNING_REASON_CODE,
        }),
        expect.objectContaining({
          nativeStorageStepId: 'serialize_to_native_intent',
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.MISSING_NATIVE_STORAGE_STEP,
        }),
        expect.objectContaining({
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.NATIVE_STORAGE_ENABLED_BEFORE_PHASE_8R,
        }),
      ]),
    }));
  });

  test('separates client UX guardrails from authoritative server responsibilities', () => {
    expect(listPhase2RAuthorityResponsibilitiesByOwner(PHASE_2R_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL))
      .toEqual([
        expect.objectContaining({
          id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_COMMAND_GUARDRAILS,
          authoritative: false,
        }),
        expect.objectContaining({
          id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_VIEW_GUARDRAILS,
          authoritative: false,
        }),
      ]);

    expect(listPhase2RAuthorityResponsibilitiesByOwner(PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_INTENT_CONTRACT))
      .toEqual([
        expect.objectContaining({
          id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_CONTRACT_VALIDATION,
          authoritative: true,
        }),
        expect.objectContaining({
          id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT,
          authoritative: true,
        }),
      ]);
  });

  test('validates authority owner assignments fail-closed', () => {
    expect(validatePhase2RAuthorityAssignment({
      responsibilityId: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
      ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR,
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Authority owner matches the Phase 2R preparation contract.',
    });

    expect(validatePhase2RAuthorityAssignment({
      responsibilityId: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
      ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL,
    })).toEqual({
      valid: false,
      riskId: PHASE_2R_AUTHORITY_RISK_IDS.CLIENT_AUTHORITY_CONFUSION,
      reason: 'Authority owner does not match the Phase 2R preparation contract.',
    });

    expect(validatePhase2RAuthorityAssignment({
      responsibilityId: 'unknown',
      ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR,
    })).toEqual({
      valid: false,
      riskId: PHASE_2R_AUTHORITY_RISK_IDS.MISSING_SERVER_INSERTION_POINT,
      reason: 'Unknown Phase 2R authority responsibility.',
    });
  });

  test('declares server insertion points that block raw draft echo', () => {
    expect(listPhase2RAuthorityInsertionPoints().map(record => record.id)).toEqual([
      PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_WRITE_ROUTE_PREFLIGHT,
      PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
      PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_CONTRACT_VALIDATOR,
      PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER,
      PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.NATIVE_INTENT_STORAGE_MAPPER,
    ]);

    expect(validatePhase2RServerInsertionPoint(PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR))
      .toEqual({
        valid: true,
        riskId: null,
        reason: 'Server insertion point is declared and blocks raw draft echo.',
      });
    expect(validatePhase2RServerInsertionPoint('unknown')).toEqual({
      valid: false,
      riskId: PHASE_2R_AUTHORITY_RISK_IDS.MISSING_SERVER_INSERTION_POINT,
      reason: 'Unknown Phase 2R server insertion point.',
    });
  });

  test('builds sanitized preflight around explicit draft intent without trusting client inference', () => {
    const preflight = buildPhase2RServerAuthorityPreflight({
      policyIntentDraft: validDraft(),
    });

    expect(preflight).toEqual({
      present: true,
      validation: {
        valid: true,
        errors: [],
      },
      persistence_enabled: false,
      persistence_reason_code: 'native_intent_storage_not_enabled',
      draft_schema_version: POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
      source: 'legacy_policy_builder',
      migration_state: 'legacy_compatible',
      preset_count: 1,
      client_draft_authoritative: false,
      server_validation_authoritative: true,
      native_intent_storage_mode: PHASE_2R_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
      server_insertion_point_id: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
      phase5_contract_schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
      phase6_profile_suggestion_field_ids: [
        PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE,
        PHASE_2R_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
        PHASE_2R_DRAFT_FIELD_IDS.HARD_LIMITS,
        PHASE_2R_DRAFT_FIELD_IDS.AVOID,
      ],
      future_command_ids: [
        PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
        PHASE_2R_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
      ],
    });
    expect(preflight).not.toHaveProperty('draft');
    expect(preflight).not.toHaveProperty('presets');
  });

  test('treats absent draft input as no authority preflight work', () => {
    expect(buildPhase2RServerAuthorityPreflight({ name: 'Family Policy' })).toBeNull();
  });

  test('aligns draft warning reason codes with server-side intent contracts', () => {
    expect(listPhase2RServerWarningReasonIds()).toEqual([
      PHASE_2R_AUTHORITY_WARNING_REASON_IDS.SERVER_VALIDATION_REQUIRED,
      PHASE_2R_AUTHORITY_WARNING_REASON_IDS.NATIVE_INTENT_STORAGE_NOT_ENABLED,
      PHASE_2R_AUTHORITY_WARNING_REASON_IDS.MISSING_PURPOSE,
      PHASE_2R_AUTHORITY_WARNING_REASON_IDS.HARD_LIMIT_REQUIRES_STRICT_CONSTRAINT,
      PHASE_2R_AUTHORITY_WARNING_REASON_IDS.HELPFUL_HINT_CANNOT_BE_STRICT,
      PHASE_2R_AUTHORITY_WARNING_REASON_IDS.AVOID_SHOULD_BE_EXCLUSION,
      PHASE_2R_AUTHORITY_WARNING_REASON_IDS.LEGACY_PRESET_PARTIAL_INFERENCE,
    ]);
  });

  test('documents native storage replacement without rewriting product components', () => {
    expect(listPhase2RNativeStorageReplacementSteps()).toEqual([
      expect.objectContaining({
        id: 'create_from_native_intent',
        modeId: PHASE_2R_NATIVE_STORAGE_MODE_IDS.DUAL_READ_WRITE_PLANNED,
      }),
      expect.objectContaining({
        id: 'edit_native_intent_projection',
        requirement: expect.stringContaining('same draft/view/command contracts'),
      }),
      expect.objectContaining({
        id: 'serialize_to_native_intent',
        modeId: PHASE_2R_NATIVE_STORAGE_MODE_IDS.NATIVE_STORAGE_READY,
      }),
      expect.objectContaining({
        id: 'retain_legacy_bridge_for_unconverted_policies',
        modeId: PHASE_2R_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
      }),
    ]);
  });

  test('exposes immutable authority preparation records and null unknown lookups', () => {
    const responsibilities = listPhase2RAuthorityResponsibilities();
    const insertionPoints = listPhase2RAuthorityInsertionPoints();
    const nativeSteps = listPhase2RNativeStorageReplacementSteps();

    expect(Object.isFrozen(responsibilities)).toBe(true);
    expect(Object.isFrozen(responsibilities[0])).toBe(true);
    expect(Object.isFrozen(insertionPoints)).toBe(true);
    expect(Object.isFrozen(nativeSteps)).toBe(true);
    expect(getPhase2RAuthorityResponsibility('unknown')).toBeNull();
    expect(getPhase2RAuthorityInsertionPoint('unknown')).toBeNull();
  });
});
