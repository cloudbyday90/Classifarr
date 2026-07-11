import {
  AUTHORITY_LEVELS,
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  POLICY_UX_TERM_IDS,
} from '../../services/policyUserMentalModel.mjs';
import {
  POLICY_AUTHORING_DRAFT_AUTHORITY_IDS,
  POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS,
  POLICY_AUTHORING_DRAFT_FIELD_IDS,
  POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS,
  POLICY_AUTHORING_DRAFT_RISK_IDS,
  POLICY_AUTHORING_NATIVE_MAPPING_IDS,
  buildPolicyAuthoringDraftContractAudit,
  canPolicyAuthoringDraftFieldPersistNativeIntent,
  canPolicyAuthoringDraftFieldSerializeLegacyBridge,
  evaluatePolicyAuthoringDraftResponsibilitySet,
  getPolicyAuthoringDraftFieldRecord,
  getPolicyAuthoringProhibitedDraftResponsibility,
  isPolicyAuthoringDraftFieldCompatibilityOnly,
  listPolicyAuthoringDraftFieldRecords,
  listPolicyAuthoringDraftFieldsByAuthority,
  listPolicyAuthoringProhibitedDraftResponsibilities,
  summarizePolicyAuthoringDraftContract,
  validatePolicyAuthoringDraftFieldContract,
  validatePolicyAuthoringDraftFieldOwnership,
} from '../../services/policyAuthoringDraftContract.mjs';

describe('policyAuthoringDraftContract', () => {
  test('defines policy authoring draft fields in product language', () => {
    expect(listPolicyAuthoringDraftFieldRecords().map(record => record.id)).toEqual([
      POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.HARD_LIMITS,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.AVOID,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.ASK_WHEN,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.ROUTING_TARGET,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.ASSUMPTIONS,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.WARNINGS,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.SOURCE_METADATA,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.UI_STATE,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.READINESS_PROJECTION,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA,
    ]);

    expect(getPolicyAuthoringDraftFieldRecord(POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE))
      .toEqual(expect.objectContaining({
        label: 'Belongs Here',
        uxTermId: POLICY_UX_TERM_IDS.BELONGS_HERE,
        productMeaning: 'Signals the operator accepts as destination identity.',
      }));
  });

  test('separates draft fields by authority classification', () => {
    expect(summarizePolicyAuthoringDraftContract()).toEqual({
      draftIsDurableAuthority: false,
      serverValidationRequired: true,
      rawLegacyStorageTermsRequired: false,
      fieldCount: 13,
      countsByAuthority: {
        [POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT]: 6,
        [POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.INFERRED_COMPATIBILITY_PROJECTION]: 2,
        [POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.LEGACY_BRIDGE_METADATA]: 2,
        [POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.UI_ONLY_TRANSIENT_STATE]: 1,
        [POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION]: 2,
      },
      nativeIntentCandidateFieldIds: [
        POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.HARD_LIMITS,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.AVOID,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.ASK_WHEN,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.ROUTING_TARGET,
      ],
      compatibilityOnlyFieldIds: [
        POLICY_AUTHORING_DRAFT_FIELD_IDS.ASSUMPTIONS,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.WARNINGS,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.SOURCE_METADATA,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA,
      ],
      readOnlyProjectionFieldIds: [
        POLICY_AUTHORING_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
        POLICY_AUTHORING_DRAFT_FIELD_IDS.READINESS_PROJECTION,
      ],
      prohibitedResponsibilityIds: [
        POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.OBSERVED_EVIDENCE_GENERATION,
        POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.LEARNING_DECISIONS,
        POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.PROVIDER_READINESS_DECISIONS,
        POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.ROUTING_SIDE_EFFECTS,
        POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.MIGRATION_ACCEPTANCE,
      ],
    });
  });

  test('audits the default draft contract as a clean policy-authoring boundary', () => {
    expect(buildPolicyAuthoringDraftContractAudit()).toEqual({
      ok: true,
      checkedFieldCount: 13,
      requiredFieldCount: 13,
      fieldResults: listPolicyAuthoringDraftFieldRecords().map(record => ({
        valid: true,
        fieldId: record.id,
        issues: [],
      })),
      missingFieldIds: [],
      duplicateFieldIds: [],
      issues: [],
    });
  });

  test('fails unsafe draft field records with explicit audit risks', () => {
    const unsafeRecord = {
      id: POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
      label: 'customSignals preset_id bridge',
      authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
      nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
      productMeaning: 'raw legacy customSignals field',
      mayPersistNativeIntent: true,
      maySerializeLegacyBridge: true,
      mayContainObservedEvidence: true,
      compatibilityOnly: true,
    };

    expect(validatePolicyAuthoringDraftFieldContract(unsafeRecord)).toEqual({
      valid: false,
      fieldId: POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
      issues: [
        {
          riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.NATIVE_FIELD_NOT_DECLARED_INTENT,
          reason: 'Only operator-declared intent fields may be native intent candidates.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.COMPATIBILITY_FIELD_PERSISTS_NATIVE,
          reason: 'Compatibility-only draft fields cannot persist as native intent.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.READ_ONLY_PROJECTION_SERIALIZES,
          reason: 'Server read-only projections cannot serialize as draft edits.',
        },
      ],
    });

    expect(validatePolicyAuthoringDraftFieldContract({
      ...unsafeRecord,
      authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    }).issues.map(issue => issue.riskId)).toContain(
      POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.RAW_LEGACY_TERM_IN_PRODUCT_FIELD
    );
  });

  test('audits missing and duplicate draft fields', () => {
    const records = [
      ...listPolicyAuthoringDraftFieldRecords().filter(record => record.id !== POLICY_AUTHORING_DRAFT_FIELD_IDS.AVOID),
      getPolicyAuthoringDraftFieldRecord(POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE),
    ];

    expect(buildPolicyAuthoringDraftContractAudit({ fieldRecords: records })).toEqual(expect.objectContaining({
      ok: false,
      checkedFieldCount: 13,
      requiredFieldCount: 13,
      missingFieldIds: [POLICY_AUTHORING_DRAFT_FIELD_IDS.AVOID],
      duplicateFieldIds: [POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE],
      issues: expect.arrayContaining([
        expect.objectContaining({
          fieldId: POLICY_AUTHORING_DRAFT_FIELD_IDS.AVOID,
          riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.UNKNOWN_FIELD,
        }),
        expect.objectContaining({
          fieldId: POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
          riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.UNKNOWN_FIELD,
        }),
      ]),
    }));
  });

  test('marks declared intent fields as future native intent candidates', () => {
    [
      POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.HARD_LIMITS,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.AVOID,
    ].forEach(fieldId => {
      expect(getPolicyAuthoringDraftFieldRecord(fieldId)).toEqual(expect.objectContaining({
        authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
        authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
        mayPersistNativeIntent: true,
        compatibilityOnly: false,
      }));
    });
  });

  test('keeps review and routing intent separate from side effects', () => {
    expect(getPolicyAuthoringDraftFieldRecord(POLICY_AUTHORING_DRAFT_FIELD_IDS.ASK_WHEN))
      .toEqual(expect.objectContaining({
        uxTermId: POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
        nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.NATIVE_REVIEW_CANDIDATE,
        mayPersistNativeIntent: true,
        maySerializeLegacyBridge: false,
      }));

    expect(getPolicyAuthoringDraftFieldRecord(POLICY_AUTHORING_DRAFT_FIELD_IDS.ROUTING_TARGET))
      .toEqual(expect.objectContaining({
        uxTermId: POLICY_UX_TERM_IDS.ROUTING_TARGET,
        nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.NATIVE_ROUTING_CANDIDATE,
        mayPersistNativeIntent: true,
        maySerializeLegacyBridge: false,
        productMeaning: expect.stringContaining('without performing Arr writes'),
      }));
  });

  test('marks compatibility-only fields so they cannot become native intent accidentally', () => {
    [
      POLICY_AUTHORING_DRAFT_FIELD_IDS.ASSUMPTIONS,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.WARNINGS,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.SOURCE_METADATA,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA,
    ].forEach(fieldId => {
      expect(isPolicyAuthoringDraftFieldCompatibilityOnly(fieldId)).toBe(true);
      expect(canPolicyAuthoringDraftFieldPersistNativeIntent(fieldId)).toBe(false);
    });

    expect(canPolicyAuthoringDraftFieldSerializeLegacyBridge(POLICY_AUTHORING_DRAFT_FIELD_IDS.SOURCE_METADATA)).toBe(true);
    expect(canPolicyAuthoringDraftFieldSerializeLegacyBridge(POLICY_AUTHORING_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA)).toBe(true);
  });

  test('keeps UI-only and server read-only projections out of persistence', () => {
    [
      POLICY_AUTHORING_DRAFT_FIELD_IDS.UI_STATE,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.READINESS_PROJECTION,
    ].forEach(fieldId => {
      expect(canPolicyAuthoringDraftFieldPersistNativeIntent(fieldId)).toBe(false);
      expect(canPolicyAuthoringDraftFieldSerializeLegacyBridge(fieldId)).toBe(false);
    });

    expect(getPolicyAuthoringDraftFieldRecord(POLICY_AUTHORING_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION))
      .toEqual(expect.objectContaining({
        authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
        authorityLevel: AUTHORITY_LEVELS.OBSERVED_EVIDENCE,
        mayContainObservedEvidence: true,
      }));
  });

  test('filters fields by authority', () => {
    expect(listPolicyAuthoringDraftFieldsByAuthority(POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT)
      .map(record => record.id)).toEqual([
      POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.HARD_LIMITS,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.AVOID,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.ASK_WHEN,
      POLICY_AUTHORING_DRAFT_FIELD_IDS.ROUTING_TARGET,
    ]);

    expect(listPolicyAuthoringDraftFieldsByAuthority('unknown')).toEqual([]);
  });

  test('validates proposed draft field ownership fail-closed', () => {
    expect(validatePolicyAuthoringDraftFieldOwnership(
      POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
      POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT
    )).toEqual({
      valid: true,
      riskId: null,
      reason: 'Draft field authority matches the policy authoring contract.',
    });

    expect(validatePolicyAuthoringDraftFieldOwnership(
      POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
      POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION
    )).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_RISK_IDS.DURABLE_AUTHORITY_CONFUSION,
      reason: 'Draft field authority does not match the policy authoring contract.',
    });

    expect(validatePolicyAuthoringDraftFieldOwnership('unknown', POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT))
      .toEqual({
        valid: false,
        riskId: POLICY_AUTHORING_DRAFT_RISK_IDS.DURABLE_AUTHORITY_CONFUSION,
        reason: 'Unknown draft field.',
      });
  });

  test('explicitly forbids draft ownership of engine and migration authority', () => {
    expect(listPolicyAuthoringProhibitedDraftResponsibilities().map(record => record.id)).toEqual([
      POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.OBSERVED_EVIDENCE_GENERATION,
      POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.LEARNING_DECISIONS,
      POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.PROVIDER_READINESS_DECISIONS,
      POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.ROUTING_SIDE_EFFECTS,
      POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.MIGRATION_ACCEPTANCE,
    ]);

    expect(getPolicyAuthoringProhibitedDraftResponsibility(POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.ROUTING_SIDE_EFFECTS))
      .toEqual(expect.objectContaining({
        riskId: POLICY_AUTHORING_DRAFT_RISK_IDS.ROUTING_SIDE_EFFECT,
        reason: expect.stringContaining('Arr writes'),
      }));

    expect(evaluatePolicyAuthoringDraftResponsibilitySet([
      POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.LEARNING_DECISIONS,
      'unknown_authority',
    ])).toEqual({
      valid: false,
      prohibitedIds: [
        POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.LEARNING_DECISIONS,
      ],
      unknownIds: [
        'unknown_authority',
      ],
    });
  });

  test('exposes immutable draft contract records', () => {
    const records = listPolicyAuthoringDraftFieldRecords();
    const prohibited = listPolicyAuthoringProhibitedDraftResponsibilities();

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(prohibited)).toBe(true);
    expect(Object.isFrozen(prohibited[0])).toBe(true);
  });

  test('returns null or false for unknown field lookups', () => {
    expect(getPolicyAuthoringDraftFieldRecord('unknown')).toBeNull();
    expect(getPolicyAuthoringProhibitedDraftResponsibility('unknown')).toBeNull();
    expect(canPolicyAuthoringDraftFieldPersistNativeIntent('unknown')).toBe(false);
    expect(canPolicyAuthoringDraftFieldSerializeLegacyBridge('unknown')).toBe(false);
    expect(isPolicyAuthoringDraftFieldCompatibilityOnly('unknown')).toBe(false);
  });
});
