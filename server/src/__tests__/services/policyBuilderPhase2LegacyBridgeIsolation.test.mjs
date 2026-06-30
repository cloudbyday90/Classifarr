import {
  LEGACY_COMPATIBILITY_ACTION_IDS,
  LEGACY_COMPATIBILITY_ARTIFACT_IDS,
  LEGACY_COMPATIBILITY_RISK_IDS,
  PHASE_2R_BRIDGE_AUDIT_RISK_IDS,
  PHASE_2R_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  PHASE_2R_BRIDGE_OWNER_IDS,
  PHASE_2R_BRIDGE_RESPONSIBILITY_IDS,
  PHASE_2R_BRIDGE_STAGE_IDS,
  PHASE_2R_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS,
  buildPhase2RBridgeIsolationAudit,
  canPhase2RBridgeSerializeKey,
  canPhase2RPathMutateLegacyPayload,
  getPhase2RBridgeResponsibility,
  listPhase2RBridgeDeletionRequirements,
  listPhase2RBridgeResponsibilities,
  listPhase2RBridgeResponsibilitiesByStage,
  shouldPhase2RBridgePreserveUnsupportedKey,
  summarizePhase2RBridgeIsolation,
  validatePhase2RBridgeDeletionReadiness,
  validatePhase2RBridgeResponsibility,
  validatePhase2RBridgeSerializedKeySets,
  validatePhase2RBridgeTouchpoint,
} from '../../services/policyBuilderPhase2LegacyBridgeIsolation.mjs';
import {
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS,
} from '../../services/policyBuilderLegacyCompatibilityBoundary.mjs';

describe('policyBuilderPhase2LegacyBridgeIsolation', () => {
  test('identifies the Phase 2R.2 bridge responsibility inventory', () => {
    expect(listPhase2RBridgeResponsibilities().map(record => record.id)).toEqual([
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.DESERIALIZE_SELECTED_PRESETS,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PROJECT_CUSTOM_SIGNALS_TO_DRAFT,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_UNSUPPORTED_LEGACY_BLOCKS,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_PRESET_WEIGHTS,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_STRICT_ADVISORY_METADATA,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_COMPATIBILITY_FALLBACK,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.MIGRATION_ONLY_METADATA,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.DELETE_AFTER_NATIVE_STORAGE,
    ]);
  });

  test('summarizes bridge isolation around the draft bridge module', () => {
    expect(summarizePhase2RBridgeIsolation()).toEqual({
      bridgeModulePath: 'client/src/utils/policyIntentDraftBridge.js',
      productComponentsMayReadRawCustomSignals: false,
      productComponentsMayWriteRawCustomSignals: false,
      bridgeCanMutateRawLegacyPayload: true,
      responsibilityCount: 10,
      countsByStage: {
        [PHASE_2R_BRIDGE_STAGE_IDS.DESERIALIZER]: 2,
        [PHASE_2R_BRIDGE_STAGE_IDS.SERIALIZER]: 1,
        [PHASE_2R_BRIDGE_STAGE_IDS.NO_OP_PRESERVATION]: 5,
        [PHASE_2R_BRIDGE_STAGE_IDS.MIGRATION_METADATA]: 1,
        [PHASE_2R_BRIDGE_STAGE_IDS.DELETION_GATE]: 1,
      },
      allowedSerializedKeys: PHASE_2R_BRIDGE_ALLOWED_SERIALIZED_KEYS,
      unsupportedPreservationKeys: PHASE_2R_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS,
      deletionRequirementIds: [
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LOSSLESS_CONVERSION,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.ROLLBACK_SNAPSHOT,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_READ_WRITE_PARITY,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LEGACY_WRITE_SHUTDOWN,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.BACKUP_RESTORE_VERIFICATION,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE,
      ],
      deleteAfterNativeStorageResponsibilityIds: [
        PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.DESERIALIZE_SELECTED_PRESETS,
        PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PROJECT_CUSTOM_SIGNALS_TO_DRAFT,
        PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
        PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_UNSUPPORTED_LEGACY_BLOCKS,
        PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS,
        PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_STRICT_ADVISORY_METADATA,
        PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_COMPATIBILITY_FALLBACK,
        PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.MIGRATION_ONLY_METADATA,
        PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.DELETE_AFTER_NATIVE_STORAGE,
      ],
    });
  });

  test('audits the default bridge isolation contract as clean', () => {
    expect(buildPhase2RBridgeIsolationAudit()).toEqual({
      ok: true,
      checkedResponsibilityCount: 10,
      requiredResponsibilityCount: 10,
      responsibilityResults: listPhase2RBridgeResponsibilities().map(record => ({
        valid: true,
        responsibilityId: record.id,
        issues: [],
      })),
      missingResponsibilityIds: [],
      duplicateResponsibilityIds: [],
      missingDeletionRequirementIds: [],
      keySetResult: {
        valid: true,
        allowedSerializedKeys: PHASE_2R_BRIDGE_ALLOWED_SERIALIZED_KEYS,
        unsupportedPreservationKeys: PHASE_2R_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS,
        issues: [],
      },
      issues: [],
    });
  });

  test('fails unsafe bridge responsibility records with explicit audit risks', () => {
    const unsafeRecord = {
      id: PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
      stageId: PHASE_2R_BRIDGE_STAGE_IDS.SERIALIZER,
      ownerId: PHASE_2R_BRIDGE_OWNER_IDS.POLICY_BUILDER_STATE_CALLER,
      modulePath: '',
      entryPoint: '',
      artifactIds: ['unknown_artifact'],
      allowListed: false,
      preservesUnknownPayload: false,
      productFacing: true,
      deleteAfterNativeStorage: true,
      replacementTarget: '',
    };

    expect(validatePhase2RBridgeResponsibility(unsafeRecord)).toEqual({
      valid: false,
      responsibilityId: PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
      issues: [
        {
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_ARTIFACT,
          reason: 'Bridge responsibility references an unknown legacy compatibility artifact.',
        },
        {
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.MISSING_MODULE_BOUNDARY,
          reason: 'Bridge responsibility must declare a module path and entry point.',
        },
        {
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.SERIALIZER_NOT_ALLOW_LISTED,
          reason: 'Bridge serializer responsibilities must be allow-listed.',
        },
        {
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.PRODUCT_FACING_BRIDGE_RECORD,
          reason: 'Bridge responsibilities must not be product-facing UI records.',
        },
        {
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.RAW_MUTATION_OUTSIDE_BRIDGE,
          reason: 'Raw legacy serialization must stay inside the draft bridge.',
        },
        {
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.DELETION_GATE_WITHOUT_NATIVE_REPLACEMENT,
          reason: 'Bridge deletion candidates must declare a native-storage replacement target.',
        },
      ],
    });
  });

  test('rejects unsafe serialized key sets and preservation overlap', () => {
    expect(validatePhase2RBridgeSerializedKeySets({
      allowedSerializedKeys: ['require_any', '__proto__', 'source_note'],
      unsupportedPreservationKeys: ['source_note', 'constructor'],
    })).toEqual({
      valid: false,
      allowedSerializedKeys: ['require_any', '__proto__', 'source_note'],
      unsupportedPreservationKeys: ['source_note', 'constructor'],
      issues: [
        {
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.UNSAFE_SERIALIZED_KEY,
          reason: 'Bridge payload key sets cannot contain prototype-pollution keys or non-string keys.',
          keys: ['__proto__', 'constructor'],
        },
        {
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.UNSUPPORTED_KEY_OVERLAPS_SERIALIZED_KEY,
          reason: 'Unsupported preservation keys must not overlap with the serializer allow-list.',
          keys: ['source_note'],
        },
      ],
    });
  });

  test('audits missing responsibilities and deletion requirements', () => {
    const responsibilities = [
      ...listPhase2RBridgeResponsibilities().filter(record => (
        record.id !== PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS
      )),
      getPhase2RBridgeResponsibility(PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS),
    ];
    const deletionRequirements = listPhase2RBridgeDeletionRequirements()
      .filter(gateId => gateId !== LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE);

    expect(buildPhase2RBridgeIsolationAudit({
      responsibilities,
      deletionRequirements,
    })).toEqual(expect.objectContaining({
      ok: false,
      checkedResponsibilityCount: 10,
      requiredResponsibilityCount: 10,
      missingResponsibilityIds: [PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS],
      duplicateResponsibilityIds: [PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS],
      missingDeletionRequirementIds: [LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE],
      issues: expect.arrayContaining([
        expect.objectContaining({
          responsibilityId: PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS,
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
        }),
        expect.objectContaining({
          responsibilityId: PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
        }),
        expect.objectContaining({
          responsibilityId: PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.DELETE_AFTER_NATIVE_STORAGE,
          riskId: PHASE_2R_BRIDGE_AUDIT_RISK_IDS.MISSING_DELETION_REQUIREMENT,
        }),
      ]),
    }));
  });

  test('separates deserializer, serializer, preservation, migration, and deletion stages', () => {
    expect(listPhase2RBridgeResponsibilitiesByStage(PHASE_2R_BRIDGE_STAGE_IDS.DESERIALIZER)
      .map(record => record.id)).toEqual([
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.DESERIALIZE_SELECTED_PRESETS,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PROJECT_CUSTOM_SIGNALS_TO_DRAFT,
    ]);

    expect(listPhase2RBridgeResponsibilitiesByStage(PHASE_2R_BRIDGE_STAGE_IDS.NO_OP_PRESERVATION)
      .map(record => record.id)).toEqual([
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_UNSUPPORTED_LEGACY_BLOCKS,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_PRESET_WEIGHTS,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_STRICT_ADVISORY_METADATA,
      PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_COMPATIBILITY_FALLBACK,
    ]);
  });

  test('keeps serializer responsibility allow-listed and bridge-owned', () => {
    expect(getPhase2RBridgeResponsibility(PHASE_2R_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS))
      .toEqual(expect.objectContaining({
        stageId: PHASE_2R_BRIDGE_STAGE_IDS.SERIALIZER,
        ownerId: PHASE_2R_BRIDGE_OWNER_IDS.DRAFT_BRIDGE,
        modulePath: 'client/src/utils/policyIntentDraftBridge.js',
        entryPoint: 'applyPolicyIntentDraftToSelectedPresets',
        allowListed: true,
        preservesUnknownPayload: true,
        productFacing: false,
      }));
  });

  test('exposes the serialized key allow-list and unsupported preservation keys', () => {
    expect(canPhase2RBridgeSerializeKey('require_any')).toBe(true);
    expect(canPhase2RBridgeSerializeKey('strict')).toBe(true);
    expect(canPhase2RBridgeSerializeKey('provider_hint')).toBe(false);
    expect(canPhase2RBridgeSerializeKey('__proto__')).toBe(false);

    expect(shouldPhase2RBridgePreserveUnsupportedKey('source_note')).toBe(true);
    expect(shouldPhase2RBridgePreserveUnsupportedKey('custom_score')).toBe(true);
    expect(shouldPhase2RBridgePreserveUnsupportedKey('require_any')).toBe(false);
  });

  test('allows raw legacy payload mutation only in the bridge module', () => {
    expect(canPhase2RPathMutateLegacyPayload('client/src/utils/policyIntentDraftBridge.js')).toBe(true);
    expect(canPhase2RPathMutateLegacyPayload('client/src/composables/usePolicyIntentDraft.js')).toBe(false);
    expect(canPhase2RPathMutateLegacyPayload('client/src/components/policies/PolicyStarterTemplateDetails.vue')).toBe(false);
  });

  test('rejects product component raw legacy writes through inherited compatibility boundary', () => {
    expect(validatePhase2RBridgeTouchpoint({
      path: 'client/src/components/policies/PolicyStarterTemplateDetails.vue',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.WRITE_RAW_PAYLOAD,
    })).toEqual({
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.RAW_PAYLOAD_MUTATION,
      reason: 'Raw legacy payload writes must stay inside the draft bridge serializer.',
    });
  });

  test('accepts bridge raw writes for custom signal serialization', () => {
    expect(validatePhase2RBridgeTouchpoint({
      path: 'client/src/utils/policyIntentDraftBridge.js',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.WRITE_RAW_PAYLOAD,
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Legacy compatibility touchpoint stays within the declared boundary.',
    });
  });

  test('requires Phase 8R deletion gates before bridge removal', () => {
    expect(listPhase2RBridgeDeletionRequirements()).toEqual([
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LOSSLESS_CONVERSION,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.ROLLBACK_SNAPSHOT,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_READ_WRITE_PARITY,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LEGACY_WRITE_SHUTDOWN,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.BACKUP_RESTORE_VERIFICATION,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE,
    ]);

    expect(validatePhase2RBridgeDeletionReadiness([
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
    ])).toEqual({
      ready: false,
      requiredGateIds: listPhase2RBridgeDeletionRequirements(),
      missingGateIds: [
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LOSSLESS_CONVERSION,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.ROLLBACK_SNAPSHOT,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_READ_WRITE_PARITY,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LEGACY_WRITE_SHUTDOWN,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.BACKUP_RESTORE_VERIFICATION,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE,
      ],
    });

    expect(validatePhase2RBridgeDeletionReadiness(listPhase2RBridgeDeletionRequirements()))
      .toEqual({
        ready: true,
        requiredGateIds: listPhase2RBridgeDeletionRequirements(),
        missingGateIds: [],
      });
  });

  test('exposes immutable bridge isolation records', () => {
    const responsibilities = listPhase2RBridgeResponsibilities();
    const deletionRequirements = listPhase2RBridgeDeletionRequirements();

    expect(Object.isFrozen(responsibilities)).toBe(true);
    expect(Object.isFrozen(responsibilities[0])).toBe(true);
    expect(Object.isFrozen(responsibilities[0].artifactIds)).toBe(true);
    expect(Object.isFrozen(deletionRequirements)).toBe(true);
  });

  test('returns null or false for unknown records', () => {
    expect(getPhase2RBridgeResponsibility('unknown')).toBeNull();
    expect(listPhase2RBridgeResponsibilitiesByStage('unknown')).toEqual([]);
    expect(canPhase2RBridgeSerializeKey('unknown')).toBe(false);
    expect(shouldPhase2RBridgePreserveUnsupportedKey('unknown')).toBe(false);
    expect(canPhase2RPathMutateLegacyPayload('unknown')).toBe(false);
  });
});
