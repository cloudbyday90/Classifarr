import {
  POLICY_INTENT_DRAFT_BUCKETS,
  POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
} from '../../services/policyIntentRequestValidator.mjs';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
} from '../../services/policyIntentSchema.mjs';
import {
  POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS,
  POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS,
  POLICY_AUTHORING_AUTHORITY_OWNER_IDS,
  POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS,
  POLICY_AUTHORING_AUTHORITY_RISK_IDS,
  POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS,
  POLICY_AUTHORING_NATIVE_STORAGE_MODE_IDS,
  buildPolicyAuthoringServerAuthorityAudit,
  buildPolicyAuthoringServerAuthorityPreflight,
  getPolicyAuthoringAuthorityInsertionPoint,
  getPolicyAuthoringAuthorityResponsibility,
  listPolicyAuthoringAuthorityInsertionPoints,
  listPolicyAuthoringAuthorityResponsibilities,
  listPolicyAuthoringAuthorityResponsibilitiesByOwner,
  listPolicyAuthoringNativeStorageReplacementSteps,
  listPolicyAuthoringServerWarningReasonIds,
  summarizePolicyAuthoringServerAuthorityPreparation,
  validatePolicyAuthoringAuthorityAssignment,
  validatePolicyAuthoringAuthorityResponsibilityRecord,
  validatePolicyAuthoringInsertionPointRecord,
  validatePolicyAuthoringServerInsertionPoint,
} from '../../services/policyAuthoringServerAuthorityPreparation.mjs';
import {
  POLICY_AUTHORING_DRAFT_COMMAND_IDS,
} from '../../services/policyAuthoringDraftCommandBoundary.mjs';
import {
  POLICY_AUTHORING_DRAFT_FIELD_IDS,
} from '../../services/policyAuthoringDraftFieldContract.mjs';

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

describe('policyAuthoringServerAuthorityPreparation', () => {
  test('defines the policy authoring authority responsibility inventory', () => {
    expect(listPolicyAuthoringAuthorityResponsibilities().map(record => record.id)).toEqual([
      POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_COMMAND_GUARDRAILS,
      POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_VIEW_GUARDRAILS,
      POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.ROUTE_PAYLOAD_PREFLIGHT,
      POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
      POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_CONTRACT_VALIDATION,
      POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT,
      POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.LEGACY_BRIDGE_SERIALIZATION,
      POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.PROFILE_TO_INTENT_SUGGESTIONS,
      POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.NATIVE_INTENT_STORAGE_REPLACEMENT,
    ]);

    expect(getPolicyAuthoringAuthorityResponsibility(POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA))
      .toEqual(expect.objectContaining({
        ownerId: POLICY_AUTHORING_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR,
        authoritative: true,
        currentModulePath: 'server/src/services/policyIntentRequestValidator.mjs',
        insertionPointId: POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
      }));
  });

  test('summarizes server authority with client draft subordinate to server validation', () => {
    expect(summarizePolicyAuthoringServerAuthorityPreparation()).toEqual({
      responsibilityCount: 9,
      insertionPointCount: 5,
      nativeStorageReplacementStepCount: 4,
      countsByOwner: {
        [POLICY_AUTHORING_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL]: 2,
        [POLICY_AUTHORING_AUTHORITY_OWNER_IDS.SERVER_ROUTE_PREFLIGHT]: 1,
        [POLICY_AUTHORING_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR]: 1,
        [POLICY_AUTHORING_AUTHORITY_OWNER_IDS.SERVER_INTENT_CONTRACT]: 2,
        [POLICY_AUTHORING_AUTHORITY_OWNER_IDS.LEGACY_BRIDGE_COMPATIBILITY]: 1,
        [POLICY_AUTHORING_AUTHORITY_OWNER_IDS.POLICY_ENGINE_PROJECTION]: 1,
        [POLICY_AUTHORING_AUTHORITY_OWNER_IDS.NATIVE_INTENT_STORAGE]: 1,
      },
      clientDraftAuthoritative: false,
      serverValidationAuthoritative: true,
      nativeIntentPersistenceEnabled: false,
      nativeIntentStorageMode: POLICY_AUTHORING_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
      intentContractInsertionPointIds: [
        POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_CONTRACT_VALIDATOR,
      ],
      profileSuggestionInsertionPointIds: [
        POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER,
      ],
      nativeStorageInsertionPointIds: [
        POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.NATIVE_INTENT_STORAGE_MAPPER,
      ],
    });
  });

  test('audits the default server authority contract as clean', () => {
    expect(buildPolicyAuthoringServerAuthorityAudit()).toEqual({
      ok: true,
      checkedResponsibilityCount: 9,
      requiredResponsibilityCount: 9,
      checkedInsertionPointCount: 5,
      requiredInsertionPointCount: 5,
      responsibilityResults: listPolicyAuthoringAuthorityResponsibilities().map(record => ({
        valid: true,
        responsibilityId: record.id,
        issues: [],
      })),
      insertionPointResults: listPolicyAuthoringAuthorityInsertionPoints().map(record => ({
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
      nativeStorageMode: POLICY_AUTHORING_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
      issues: [],
    });
  });

  test('fails unsafe responsibility records with explicit authority audit risks', () => {
    expect(validatePolicyAuthoringAuthorityResponsibilityRecord({
      id: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_COMMAND_GUARDRAILS,
      ownerId: POLICY_AUTHORING_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL,
      authoritative: true,
      currentModulePath: '',
      insertionPointId: POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.POLICY_WRITE_ROUTE_PREFLIGHT,
      notes: '',
    })).toEqual({
      valid: false,
      responsibilityId: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_COMMAND_GUARDRAILS,
      issues: [
        {
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.MISSING_MODULE_BOUNDARY,
          reason: 'Authority responsibility must declare a module path and boundary note.',
        },
        {
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.CLIENT_MARKED_AUTHORITATIVE,
          reason: 'Client UX guardrails cannot be authoritative for durable policy validity.',
        },
      ],
    });

    expect(validatePolicyAuthoringAuthorityResponsibilityRecord({
      id: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
      ownerId: POLICY_AUTHORING_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR,
      authoritative: false,
      currentModulePath: 'server/src/services/policyIntentRequestValidator.mjs',
      insertionPointId: 'unknown_insertion_point',
      notes: 'Invalid insertion point.',
    })).toEqual({
      valid: false,
      responsibilityId: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
      issues: [
        {
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.SERVER_MARKED_NON_AUTHORITATIVE,
          reason: 'Server authority and native storage responsibilities must be authoritative when active.',
        },
        {
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_INSERTION_POINT,
          reason: 'Authority responsibility references an unknown insertion point.',
        },
      ],
    });
  });

  test('fails insertion points that echo raw drafts or lack module boundaries', () => {
    expect(validatePolicyAuthoringInsertionPointRecord({
      id: POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
      modulePath: '',
      currentEntryPoint: 'validatePolicyIntentWritePayload',
      targetBoundaryId: 'policy_intent_request_validation',
      blocksRawDraftEcho: false,
    })).toEqual({
      valid: false,
      insertionPointId: POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
      issues: [
        {
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.MISSING_MODULE_BOUNDARY,
          reason: 'Insertion point must declare a module path.',
        },
        {
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.INSERTION_POINT_ECHOES_RAW_DRAFT,
          reason: 'Insertion points must block raw draft echo.',
        },
      ],
    });
  });

  test('audits missing records and premature native storage activation', () => {
    const responsibilities = [
      ...listPolicyAuthoringAuthorityResponsibilities().filter(record => (
        record.id !== POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT
      )),
      getPolicyAuthoringAuthorityResponsibility(POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA),
    ];
    const insertionPoints = listPolicyAuthoringAuthorityInsertionPoints().filter(record => (
      record.id !== POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER
    ));
    const warningReasonIds = listPolicyAuthoringServerWarningReasonIds().filter(reasonId => (
      reasonId !== POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS.LEGACY_PRESET_PARTIAL_INFERENCE
    ));
    const nativeStorageSteps = listPolicyAuthoringNativeStorageReplacementSteps().filter(step => (
      step.id !== 'serialize_to_native_intent'
    ));

    expect(buildPolicyAuthoringServerAuthorityAudit({
      responsibilities,
      insertionPoints,
      warningReasonIds,
      nativeStorageSteps,
      nativeStorageMode: POLICY_AUTHORING_NATIVE_STORAGE_MODE_IDS.NATIVE_STORAGE_READY,
    })).toEqual(expect.objectContaining({
      ok: false,
      checkedResponsibilityCount: 9,
      checkedInsertionPointCount: 4,
      missingResponsibilityIds: [POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT],
      duplicateResponsibilityIds: [POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA],
      missingInsertionPointIds: [POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER],
      duplicateInsertionPointIds: [],
      missingWarningReasonIds: [POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS.LEGACY_PRESET_PARTIAL_INFERENCE],
      missingNativeStorageStepIds: ['serialize_to_native_intent'],
      nativeStorageMode: POLICY_AUTHORING_NATIVE_STORAGE_MODE_IDS.NATIVE_STORAGE_READY,
      issues: expect.arrayContaining([
        expect.objectContaining({
          responsibilityId: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT,
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
        }),
        expect.objectContaining({
          responsibilityId: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
        }),
        expect.objectContaining({
          insertionPointId: POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER,
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_INSERTION_POINT,
        }),
        expect.objectContaining({
          warningReasonId: POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS.LEGACY_PRESET_PARTIAL_INFERENCE,
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.MISSING_WARNING_REASON_CODE,
        }),
        expect.objectContaining({
          nativeStorageStepId: 'serialize_to_native_intent',
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.MISSING_NATIVE_STORAGE_STEP,
        }),
        expect.objectContaining({
          riskId: POLICY_AUTHORING_AUTHORITY_AUDIT_RISK_IDS.NATIVE_STORAGE_ENABLED_BEFORE_READY,
        }),
      ]),
    }));
  });

  test('separates client UX guardrails from authoritative server responsibilities', () => {
    expect(listPolicyAuthoringAuthorityResponsibilitiesByOwner(POLICY_AUTHORING_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL))
      .toEqual([
        expect.objectContaining({
          id: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_COMMAND_GUARDRAILS,
          authoritative: false,
        }),
        expect.objectContaining({
          id: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_VIEW_GUARDRAILS,
          authoritative: false,
        }),
      ]);

    expect(listPolicyAuthoringAuthorityResponsibilitiesByOwner(POLICY_AUTHORING_AUTHORITY_OWNER_IDS.SERVER_INTENT_CONTRACT))
      .toEqual([
        expect.objectContaining({
          id: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_CONTRACT_VALIDATION,
          authoritative: true,
        }),
        expect.objectContaining({
          id: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT,
          authoritative: true,
        }),
      ]);
  });

  test('validates authority owner assignments fail-closed', () => {
    expect(validatePolicyAuthoringAuthorityAssignment({
      responsibilityId: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
      ownerId: POLICY_AUTHORING_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR,
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Authority owner matches the policy authoring server authority contract.',
    });

    expect(validatePolicyAuthoringAuthorityAssignment({
      responsibilityId: POLICY_AUTHORING_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
      ownerId: POLICY_AUTHORING_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL,
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_AUTHORITY_RISK_IDS.CLIENT_AUTHORITY_CONFUSION,
      reason: 'Authority owner does not match the policy authoring server authority contract.',
    });

    expect(validatePolicyAuthoringAuthorityAssignment({
      responsibilityId: 'unknown',
      ownerId: POLICY_AUTHORING_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR,
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_AUTHORITY_RISK_IDS.MISSING_SERVER_INSERTION_POINT,
      reason: 'Unknown policy authoring authority responsibility.',
    });
  });

  test('declares server insertion points that block raw draft echo', () => {
    expect(listPolicyAuthoringAuthorityInsertionPoints().map(record => record.id)).toEqual([
      POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.POLICY_WRITE_ROUTE_PREFLIGHT,
      POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
      POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_CONTRACT_VALIDATOR,
      POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER,
      POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.NATIVE_INTENT_STORAGE_MAPPER,
    ]);

    expect(validatePolicyAuthoringServerInsertionPoint(POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR))
      .toEqual({
        valid: true,
        riskId: null,
        reason: 'Server insertion point is declared and blocks raw draft echo.',
      });
    expect(validatePolicyAuthoringServerInsertionPoint('unknown')).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_AUTHORITY_RISK_IDS.MISSING_SERVER_INSERTION_POINT,
      reason: 'Unknown policy authoring server insertion point.',
    });
  });

  test('builds sanitized preflight around explicit draft intent without trusting client inference', () => {
    const preflight = buildPolicyAuthoringServerAuthorityPreflight({
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
      native_intent_storage_mode: POLICY_AUTHORING_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
      server_insertion_point_id: POLICY_AUTHORING_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
      intent_contract_schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
      profile_suggestion_field_ids: [
        POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.HARD_LIMITS,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.AVOID,
      ],
      future_command_ids: [
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
      ],
    });
    expect(preflight).not.toHaveProperty('draft');
    expect(preflight).not.toHaveProperty('presets');
  });

  test('treats absent draft input as no authority preflight work', () => {
    expect(buildPolicyAuthoringServerAuthorityPreflight({ name: 'Family Policy' })).toBeNull();
  });

  test('aligns draft warning reason codes with server-side intent contracts', () => {
    expect(listPolicyAuthoringServerWarningReasonIds()).toEqual([
      POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS.SERVER_VALIDATION_REQUIRED,
      POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS.NATIVE_INTENT_STORAGE_NOT_ENABLED,
      POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS.MISSING_PURPOSE,
      POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS.HARD_LIMIT_REQUIRES_STRICT_CONSTRAINT,
      POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS.HELPFUL_HINT_CANNOT_BE_STRICT,
      POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS.AVOID_SHOULD_BE_EXCLUSION,
      POLICY_AUTHORING_AUTHORITY_WARNING_REASON_IDS.LEGACY_PRESET_PARTIAL_INFERENCE,
    ]);
  });

  test('documents native storage replacement without rewriting product components', () => {
    expect(listPolicyAuthoringNativeStorageReplacementSteps()).toEqual([
      expect.objectContaining({
        id: 'create_from_native_intent',
        modeId: POLICY_AUTHORING_NATIVE_STORAGE_MODE_IDS.DUAL_READ_WRITE_PLANNED,
      }),
      expect.objectContaining({
        id: 'edit_native_intent_projection',
        requirement: expect.stringContaining('same draft/view/command contracts'),
      }),
      expect.objectContaining({
        id: 'serialize_to_native_intent',
        modeId: POLICY_AUTHORING_NATIVE_STORAGE_MODE_IDS.NATIVE_STORAGE_READY,
      }),
      expect.objectContaining({
        id: 'retain_legacy_bridge_for_unconverted_policies',
        modeId: POLICY_AUTHORING_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
      }),
    ]);
  });

  test('exposes immutable authority preparation records and null unknown lookups', () => {
    const responsibilities = listPolicyAuthoringAuthorityResponsibilities();
    const insertionPoints = listPolicyAuthoringAuthorityInsertionPoints();
    const nativeSteps = listPolicyAuthoringNativeStorageReplacementSteps();

    expect(Object.isFrozen(responsibilities)).toBe(true);
    expect(Object.isFrozen(responsibilities[0])).toBe(true);
    expect(Object.isFrozen(insertionPoints)).toBe(true);
    expect(Object.isFrozen(nativeSteps)).toBe(true);
    expect(getPolicyAuthoringAuthorityResponsibility('unknown')).toBeNull();
    expect(getPolicyAuthoringAuthorityInsertionPoint('unknown')).toBeNull();
  });
});
