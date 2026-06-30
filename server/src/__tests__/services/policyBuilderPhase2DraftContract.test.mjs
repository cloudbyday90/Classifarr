import {
  AUTHORITY_LEVELS,
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  POLICY_UX_TERM_IDS,
} from '../../services/policyUserMentalModel.mjs';
import {
  PHASE_2R_DRAFT_AUTHORITY_IDS,
  PHASE_2R_DRAFT_FIELD_IDS,
  PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS,
  PHASE_2R_DRAFT_RISK_IDS,
  PHASE_2R_NATIVE_MAPPING_IDS,
  canPhase2RDraftFieldPersistNativeIntent,
  canPhase2RDraftFieldSerializeLegacyBridge,
  evaluatePhase2RDraftResponsibilitySet,
  getPhase2RDraftFieldRecord,
  getPhase2RProhibitedDraftResponsibility,
  isPhase2RDraftFieldCompatibilityOnly,
  listPhase2RDraftFieldRecords,
  listPhase2RDraftFieldsByAuthority,
  listPhase2RProhibitedDraftResponsibilities,
  summarizePhase2RDraftContract,
  validatePhase2RDraftFieldOwnership,
} from '../../services/policyBuilderPhase2DraftContract.mjs';

describe('policyBuilderPhase2DraftContract', () => {
  test('defines the Phase 2R.1 draft fields in product language', () => {
    expect(listPhase2RDraftFieldRecords().map(record => record.id)).toEqual([
      PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE,
      PHASE_2R_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
      PHASE_2R_DRAFT_FIELD_IDS.HARD_LIMITS,
      PHASE_2R_DRAFT_FIELD_IDS.AVOID,
      PHASE_2R_DRAFT_FIELD_IDS.ASK_WHEN,
      PHASE_2R_DRAFT_FIELD_IDS.ROUTING_TARGET,
      PHASE_2R_DRAFT_FIELD_IDS.ASSUMPTIONS,
      PHASE_2R_DRAFT_FIELD_IDS.WARNINGS,
      PHASE_2R_DRAFT_FIELD_IDS.SOURCE_METADATA,
      PHASE_2R_DRAFT_FIELD_IDS.UI_STATE,
      PHASE_2R_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
      PHASE_2R_DRAFT_FIELD_IDS.READINESS_PROJECTION,
      PHASE_2R_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA,
    ]);

    expect(getPhase2RDraftFieldRecord(PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE))
      .toEqual(expect.objectContaining({
        label: 'Belongs Here',
        uxTermId: POLICY_UX_TERM_IDS.BELONGS_HERE,
        productMeaning: 'Signals the operator accepts as destination identity.',
      }));
  });

  test('separates draft fields by authority classification', () => {
    expect(summarizePhase2RDraftContract()).toEqual({
      draftIsDurableAuthority: false,
      serverValidationRequired: true,
      rawLegacyStorageTermsRequired: false,
      fieldCount: 13,
      countsByAuthority: {
        [PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT]: 6,
        [PHASE_2R_DRAFT_AUTHORITY_IDS.INFERRED_COMPATIBILITY_PROJECTION]: 2,
        [PHASE_2R_DRAFT_AUTHORITY_IDS.LEGACY_BRIDGE_METADATA]: 2,
        [PHASE_2R_DRAFT_AUTHORITY_IDS.UI_ONLY_TRANSIENT_STATE]: 1,
        [PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION]: 2,
      },
      nativeIntentCandidateFieldIds: [
        PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE,
        PHASE_2R_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
        PHASE_2R_DRAFT_FIELD_IDS.HARD_LIMITS,
        PHASE_2R_DRAFT_FIELD_IDS.AVOID,
        PHASE_2R_DRAFT_FIELD_IDS.ASK_WHEN,
        PHASE_2R_DRAFT_FIELD_IDS.ROUTING_TARGET,
      ],
      compatibilityOnlyFieldIds: [
        PHASE_2R_DRAFT_FIELD_IDS.ASSUMPTIONS,
        PHASE_2R_DRAFT_FIELD_IDS.WARNINGS,
        PHASE_2R_DRAFT_FIELD_IDS.SOURCE_METADATA,
        PHASE_2R_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA,
      ],
      readOnlyProjectionFieldIds: [
        PHASE_2R_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
        PHASE_2R_DRAFT_FIELD_IDS.READINESS_PROJECTION,
      ],
      prohibitedResponsibilityIds: [
        PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.OBSERVED_EVIDENCE_GENERATION,
        PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.LEARNING_DECISIONS,
        PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.PROVIDER_READINESS_DECISIONS,
        PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.ROUTING_SIDE_EFFECTS,
        PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.MIGRATION_ACCEPTANCE,
      ],
    });
  });

  test('marks declared intent fields as future native intent candidates', () => {
    [
      PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE,
      PHASE_2R_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
      PHASE_2R_DRAFT_FIELD_IDS.HARD_LIMITS,
      PHASE_2R_DRAFT_FIELD_IDS.AVOID,
    ].forEach(fieldId => {
      expect(getPhase2RDraftFieldRecord(fieldId)).toEqual(expect.objectContaining({
        authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
        authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
        authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
        nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
        mayPersistNativeIntent: true,
        compatibilityOnly: false,
      }));
    });
  });

  test('keeps review and routing intent separate from side effects', () => {
    expect(getPhase2RDraftFieldRecord(PHASE_2R_DRAFT_FIELD_IDS.ASK_WHEN))
      .toEqual(expect.objectContaining({
        uxTermId: POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
        nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.NATIVE_REVIEW_CANDIDATE,
        mayPersistNativeIntent: true,
        maySerializeLegacyBridge: false,
      }));

    expect(getPhase2RDraftFieldRecord(PHASE_2R_DRAFT_FIELD_IDS.ROUTING_TARGET))
      .toEqual(expect.objectContaining({
        uxTermId: POLICY_UX_TERM_IDS.ROUTING_TARGET,
        nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.NATIVE_ROUTING_CANDIDATE,
        mayPersistNativeIntent: true,
        maySerializeLegacyBridge: false,
        productMeaning: expect.stringContaining('without performing Arr writes'),
      }));
  });

  test('marks compatibility-only fields so they cannot become native intent accidentally', () => {
    [
      PHASE_2R_DRAFT_FIELD_IDS.ASSUMPTIONS,
      PHASE_2R_DRAFT_FIELD_IDS.WARNINGS,
      PHASE_2R_DRAFT_FIELD_IDS.SOURCE_METADATA,
      PHASE_2R_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA,
    ].forEach(fieldId => {
      expect(isPhase2RDraftFieldCompatibilityOnly(fieldId)).toBe(true);
      expect(canPhase2RDraftFieldPersistNativeIntent(fieldId)).toBe(false);
    });

    expect(canPhase2RDraftFieldSerializeLegacyBridge(PHASE_2R_DRAFT_FIELD_IDS.SOURCE_METADATA)).toBe(true);
    expect(canPhase2RDraftFieldSerializeLegacyBridge(PHASE_2R_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA)).toBe(true);
  });

  test('keeps UI-only and server read-only projections out of persistence', () => {
    [
      PHASE_2R_DRAFT_FIELD_IDS.UI_STATE,
      PHASE_2R_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
      PHASE_2R_DRAFT_FIELD_IDS.READINESS_PROJECTION,
    ].forEach(fieldId => {
      expect(canPhase2RDraftFieldPersistNativeIntent(fieldId)).toBe(false);
      expect(canPhase2RDraftFieldSerializeLegacyBridge(fieldId)).toBe(false);
    });

    expect(getPhase2RDraftFieldRecord(PHASE_2R_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION))
      .toEqual(expect.objectContaining({
        authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
        authorityLevel: AUTHORITY_LEVELS.OBSERVED_EVIDENCE,
        mayContainObservedEvidence: true,
      }));
  });

  test('filters fields by authority', () => {
    expect(listPhase2RDraftFieldsByAuthority(PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT)
      .map(record => record.id)).toEqual([
      PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE,
      PHASE_2R_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
      PHASE_2R_DRAFT_FIELD_IDS.HARD_LIMITS,
      PHASE_2R_DRAFT_FIELD_IDS.AVOID,
      PHASE_2R_DRAFT_FIELD_IDS.ASK_WHEN,
      PHASE_2R_DRAFT_FIELD_IDS.ROUTING_TARGET,
    ]);

    expect(listPhase2RDraftFieldsByAuthority('unknown')).toEqual([]);
  });

  test('validates proposed draft field ownership fail-closed', () => {
    expect(validatePhase2RDraftFieldOwnership(
      PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE,
      PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT
    )).toEqual({
      valid: true,
      riskId: null,
      reason: 'Draft field authority matches the Phase 2R contract.',
    });

    expect(validatePhase2RDraftFieldOwnership(
      PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE,
      PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION
    )).toEqual({
      valid: false,
      riskId: PHASE_2R_DRAFT_RISK_IDS.DURABLE_AUTHORITY_CONFUSION,
      reason: 'Draft field authority does not match the Phase 2R contract.',
    });

    expect(validatePhase2RDraftFieldOwnership('unknown', PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT))
      .toEqual({
        valid: false,
        riskId: PHASE_2R_DRAFT_RISK_IDS.DURABLE_AUTHORITY_CONFUSION,
        reason: 'Unknown draft field.',
      });
  });

  test('explicitly forbids draft ownership of engine and migration authority', () => {
    expect(listPhase2RProhibitedDraftResponsibilities().map(record => record.id)).toEqual([
      PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.OBSERVED_EVIDENCE_GENERATION,
      PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.LEARNING_DECISIONS,
      PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.PROVIDER_READINESS_DECISIONS,
      PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.ROUTING_SIDE_EFFECTS,
      PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.MIGRATION_ACCEPTANCE,
    ]);

    expect(getPhase2RProhibitedDraftResponsibility(PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.ROUTING_SIDE_EFFECTS))
      .toEqual(expect.objectContaining({
        riskId: PHASE_2R_DRAFT_RISK_IDS.ROUTING_SIDE_EFFECT,
        reason: expect.stringContaining('Arr writes'),
      }));

    expect(evaluatePhase2RDraftResponsibilitySet([
      PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.LEARNING_DECISIONS,
      'unknown_authority',
    ])).toEqual({
      valid: false,
      prohibitedIds: [
        PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.LEARNING_DECISIONS,
      ],
      unknownIds: [
        'unknown_authority',
      ],
    });
  });

  test('exposes immutable draft contract records', () => {
    const records = listPhase2RDraftFieldRecords();
    const prohibited = listPhase2RProhibitedDraftResponsibilities();

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(prohibited)).toBe(true);
    expect(Object.isFrozen(prohibited[0])).toBe(true);
  });

  test('returns null or false for unknown field lookups', () => {
    expect(getPhase2RDraftFieldRecord('unknown')).toBeNull();
    expect(getPhase2RProhibitedDraftResponsibility('unknown')).toBeNull();
    expect(canPhase2RDraftFieldPersistNativeIntent('unknown')).toBe(false);
    expect(canPhase2RDraftFieldSerializeLegacyBridge('unknown')).toBe(false);
    expect(isPhase2RDraftFieldCompatibilityOnly('unknown')).toBe(false);
  });
});
