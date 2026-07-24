import {
  LEGACY_COMPATIBILITY_ACTION_IDS,
  LEGACY_COMPATIBILITY_ARTIFACT_IDS,
  LEGACY_COMPATIBILITY_RISK_IDS,
  POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS,
  POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS,
  POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS,
  POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS,
  POLICY_AUTHORING_LEGACY_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS,
  buildPolicyAuthoringLegacyBridgeBoundaryAudit,
  canPolicyAuthoringLegacyBridgeSerializeKey,
  canPolicyAuthoringPathMutateLegacyPayload,
  getPolicyAuthoringLegacyBridgeResponsibility,
  listPolicyAuthoringLegacyBridgeDeletionRequirements,
  listPolicyAuthoringLegacyBridgeResponsibilities,
  listPolicyAuthoringLegacyBridgeResponsibilitiesByStage,
  shouldPolicyAuthoringLegacyBridgePreserveUnsupportedKey,
  summarizePolicyAuthoringLegacyBridgeBoundary,
  validatePolicyAuthoringLegacyBridgeDeletionReadiness,
  validatePolicyAuthoringLegacyBridgeResponsibility,
  validatePolicyAuthoringLegacyBridgeSerializedKeySets,
  validatePolicyAuthoringLegacyBridgeTouchpoint,
} from '../../services/policyAuthoringLegacyBridgeBoundary.mjs';
import {
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS,
} from '../../services/policyBuilderLegacyCompatibilityBoundary.mjs';

describe('policyAuthoringLegacyBridgeBoundary', () => {
  test('identifies the policy authoring legacy bridge responsibility inventory', () => {
    expect(listPolicyAuthoringLegacyBridgeResponsibilities().map(record => record.id)).toEqual([
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.DESERIALIZE_SELECTED_PRESETS,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PROJECT_CUSTOM_SIGNALS_TO_DRAFT,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_UNSUPPORTED_LEGACY_BLOCKS,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_PRESET_WEIGHTS,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_STRICT_ADVISORY_METADATA,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_COMPATIBILITY_FALLBACK,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.MIGRATION_ONLY_METADATA,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.DELETE_AFTER_NATIVE_STORAGE,
    ]);
  });

  test('summarizes bridge isolation around the draft bridge module', () => {
    expect(summarizePolicyAuthoringLegacyBridgeBoundary()).toEqual({
      bridgeModulePath: 'client/src/utils/policyIntentDraftBridge.js',
      productComponentsMayReadRawCustomSignals: false,
      productComponentsMayWriteRawCustomSignals: false,
      bridgeCanMutateRawLegacyPayload: true,
      responsibilityCount: 10,
      countsByStage: {
        [POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.DESERIALIZER]: 2,
        [POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.SERIALIZER]: 1,
        [POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.NO_OP_PRESERVATION]: 5,
        [POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.MIGRATION_METADATA]: 1,
        [POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.DELETION_GATE]: 1,
      },
      allowedSerializedKeys: POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS,
      unsupportedPreservationKeys: POLICY_AUTHORING_LEGACY_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS,
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
        POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.DESERIALIZE_SELECTED_PRESETS,
        POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PROJECT_CUSTOM_SIGNALS_TO_DRAFT,
        POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
        POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_UNSUPPORTED_LEGACY_BLOCKS,
        POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS,
        POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_STRICT_ADVISORY_METADATA,
        POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_COMPATIBILITY_FALLBACK,
        POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.MIGRATION_ONLY_METADATA,
        POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.DELETE_AFTER_NATIVE_STORAGE,
      ],
    });
  });

  test('audits the default bridge isolation contract as clean', () => {
    expect(buildPolicyAuthoringLegacyBridgeBoundaryAudit()).toEqual({
      ok: true,
      checkedResponsibilityCount: 10,
      requiredResponsibilityCount: 10,
      responsibilityResults: listPolicyAuthoringLegacyBridgeResponsibilities().map(record => ({
        valid: true,
        responsibilityId: record.id,
        issues: [],
      })),
      missingResponsibilityIds: [],
      duplicateResponsibilityIds: [],
      missingDeletionRequirementIds: [],
      keySetResult: {
        valid: true,
        allowedSerializedKeys: POLICY_AUTHORING_LEGACY_BRIDGE_ALLOWED_SERIALIZED_KEYS,
        unsupportedPreservationKeys: POLICY_AUTHORING_LEGACY_BRIDGE_UNSUPPORTED_PRESERVATION_KEYS,
        issues: [],
      },
      issues: [],
    });
  });

  test('fails unsafe bridge responsibility records with explicit audit risks', () => {
    const unsafeRecord = {
      id: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
      stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.SERIALIZER,
      ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.POLICY_BUILDER_STATE_CALLER,
      modulePath: '',
      entryPoint: '',
      artifactIds: ['unknown_artifact'],
      allowListed: false,
      preservesUnknownPayload: false,
      productFacing: true,
      deleteAfterNativeStorage: true,
      replacementTarget: '',
    };

    expect(validatePolicyAuthoringLegacyBridgeResponsibility(unsafeRecord)).toEqual({
      valid: false,
      responsibilityId: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
      issues: [
        {
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_ARTIFACT,
          reason: 'Bridge responsibility references an unknown legacy compatibility artifact.',
        },
        {
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.MISSING_MODULE_BOUNDARY,
          reason: 'Bridge responsibility must declare a module path and entry point.',
        },
        {
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.SERIALIZER_NOT_ALLOW_LISTED,
          reason: 'Bridge serializer responsibilities must be allow-listed.',
        },
        {
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.PRODUCT_FACING_BRIDGE_RECORD,
          reason: 'Bridge responsibilities must not be product-facing UI records.',
        },
        {
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.RAW_MUTATION_OUTSIDE_BRIDGE,
          reason: 'Raw legacy serialization must stay inside the draft bridge.',
        },
        {
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.DELETION_GATE_WITHOUT_NATIVE_REPLACEMENT,
          reason: 'Bridge deletion candidates must declare a native-storage replacement target.',
        },
      ],
    });
  });

  test('rejects unsafe serialized key sets and preservation overlap', () => {
    expect(validatePolicyAuthoringLegacyBridgeSerializedKeySets({
      allowedSerializedKeys: ['require_any', '__proto__', 'source_note'],
      unsupportedPreservationKeys: ['source_note', 'constructor'],
    })).toEqual({
      valid: false,
      allowedSerializedKeys: ['require_any', '__proto__', 'source_note'],
      unsupportedPreservationKeys: ['source_note', 'constructor'],
      issues: [
        {
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNSAFE_SERIALIZED_KEY,
          reason: 'Bridge payload key sets cannot contain prototype-pollution keys or non-string keys.',
          keys: ['__proto__', 'constructor'],
        },
        {
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNSUPPORTED_KEY_OVERLAPS_SERIALIZED_KEY,
          reason: 'Unsupported preservation keys must not overlap with the serializer allow-list.',
          keys: ['source_note'],
        },
      ],
    });
  });

  test('audits missing responsibilities and deletion requirements', () => {
    const responsibilities = [
      ...listPolicyAuthoringLegacyBridgeResponsibilities().filter(record => (
        record.id !== POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS
      )),
      getPolicyAuthoringLegacyBridgeResponsibility(POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS),
    ];
    const deletionRequirements = listPolicyAuthoringLegacyBridgeDeletionRequirements()
      .filter(gateId => gateId !== LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE);

    expect(buildPolicyAuthoringLegacyBridgeBoundaryAudit({
      responsibilities,
      deletionRequirements,
    })).toEqual(expect.objectContaining({
      ok: false,
      checkedResponsibilityCount: 10,
      requiredResponsibilityCount: 10,
      missingResponsibilityIds: [POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS],
      duplicateResponsibilityIds: [POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS],
      missingDeletionRequirementIds: [LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE],
      issues: expect.arrayContaining([
        expect.objectContaining({
          responsibilityId: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS,
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
        }),
        expect.objectContaining({
          responsibilityId: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS,
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
        }),
        expect.objectContaining({
          responsibilityId: POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.DELETE_AFTER_NATIVE_STORAGE,
          riskId: POLICY_AUTHORING_LEGACY_BRIDGE_AUDIT_RISK_IDS.MISSING_DELETION_REQUIREMENT,
        }),
      ]),
    }));
  });

  test('separates deserializer, serializer, preservation, migration, and deletion stages', () => {
    expect(listPolicyAuthoringLegacyBridgeResponsibilitiesByStage(POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.DESERIALIZER)
      .map(record => record.id)).toEqual([
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.DESERIALIZE_SELECTED_PRESETS,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PROJECT_CUSTOM_SIGNALS_TO_DRAFT,
    ]);

    expect(listPolicyAuthoringLegacyBridgeResponsibilitiesByStage(POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.NO_OP_PRESERVATION)
      .map(record => record.id)).toEqual([
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_UNSUPPORTED_LEGACY_BLOCKS,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_PRESET_WEIGHTS,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_REMOVED_MARKERS,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_STRICT_ADVISORY_METADATA,
      POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.PRESERVE_COMPATIBILITY_FALLBACK,
    ]);
  });

  test('keeps serializer responsibility allow-listed and bridge-owned', () => {
    expect(getPolicyAuthoringLegacyBridgeResponsibility(POLICY_AUTHORING_LEGACY_BRIDGE_RESPONSIBILITY_IDS.SERIALIZE_DRAFT_TO_CUSTOM_SIGNALS))
      .toEqual(expect.objectContaining({
        stageId: POLICY_AUTHORING_LEGACY_BRIDGE_STAGE_IDS.SERIALIZER,
        ownerId: POLICY_AUTHORING_LEGACY_BRIDGE_OWNER_IDS.DRAFT_BRIDGE,
        modulePath: 'client/src/utils/policyIntentDraftBridge.js',
        entryPoint: 'applyPolicyIntentDraftToSelectedPresets',
        allowListed: true,
        preservesUnknownPayload: true,
        productFacing: false,
      }));
  });

  test('exposes the serialized key allow-list and unsupported preservation keys', () => {
    expect(canPolicyAuthoringLegacyBridgeSerializeKey('require_any')).toBe(true);
    expect(canPolicyAuthoringLegacyBridgeSerializeKey('strict')).toBe(true);
    expect(canPolicyAuthoringLegacyBridgeSerializeKey('provider_hint')).toBe(false);
    expect(canPolicyAuthoringLegacyBridgeSerializeKey('__proto__')).toBe(false);

    expect(shouldPolicyAuthoringLegacyBridgePreserveUnsupportedKey('source_note')).toBe(true);
    expect(shouldPolicyAuthoringLegacyBridgePreserveUnsupportedKey('custom_score')).toBe(true);
    expect(shouldPolicyAuthoringLegacyBridgePreserveUnsupportedKey('require_any')).toBe(false);
  });

  test('allows raw legacy payload mutation only in the bridge module', () => {
    expect(canPolicyAuthoringPathMutateLegacyPayload('client/src/utils/policyIntentDraftBridge.js')).toBe(true);
    expect(canPolicyAuthoringPathMutateLegacyPayload('client/src/composables/usePolicyIntentDraft.js')).toBe(false);
    expect(canPolicyAuthoringPathMutateLegacyPayload('client/src/composables/usePolicyBuilderState.js')).toBe(false);
  });

  test('rejects policy builder state raw legacy writes through inherited compatibility boundary', () => {
    expect(validatePolicyAuthoringLegacyBridgeTouchpoint({
      path: 'client/src/composables/usePolicyBuilderState.js',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.WRITE_RAW_PAYLOAD,
    })).toEqual({
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.RAW_PAYLOAD_MUTATION,
      reason: 'Raw legacy payload writes must stay inside the draft bridge serializer.',
    });
  });

  test('accepts bridge raw writes for custom signal serialization', () => {
    expect(validatePolicyAuthoringLegacyBridgeTouchpoint({
      path: 'client/src/utils/policyIntentDraftBridge.js',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.WRITE_RAW_PAYLOAD,
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Legacy compatibility touchpoint stays within the declared boundary.',
    });
  });

  test('requires native-storage removal gates before bridge removal', () => {
    expect(listPolicyAuthoringLegacyBridgeDeletionRequirements()).toEqual([
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LOSSLESS_CONVERSION,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.ROLLBACK_SNAPSHOT,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_READ_WRITE_PARITY,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LEGACY_WRITE_SHUTDOWN,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.BACKUP_RESTORE_VERIFICATION,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE,
    ]);

    expect(validatePolicyAuthoringLegacyBridgeDeletionReadiness([
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
    ])).toEqual({
      ready: false,
      requiredGateIds: listPolicyAuthoringLegacyBridgeDeletionRequirements(),
      missingGateIds: [
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LOSSLESS_CONVERSION,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.ROLLBACK_SNAPSHOT,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_READ_WRITE_PARITY,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LEGACY_WRITE_SHUTDOWN,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.BACKUP_RESTORE_VERIFICATION,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE,
      ],
    });

    expect(validatePolicyAuthoringLegacyBridgeDeletionReadiness(listPolicyAuthoringLegacyBridgeDeletionRequirements()))
      .toEqual({
        ready: true,
        requiredGateIds: listPolicyAuthoringLegacyBridgeDeletionRequirements(),
        missingGateIds: [],
      });
  });

  test('exposes immutable bridge isolation records', () => {
    const responsibilities = listPolicyAuthoringLegacyBridgeResponsibilities();
    const deletionRequirements = listPolicyAuthoringLegacyBridgeDeletionRequirements();

    expect(Object.isFrozen(responsibilities)).toBe(true);
    expect(Object.isFrozen(responsibilities[0])).toBe(true);
    expect(Object.isFrozen(responsibilities[0].artifactIds)).toBe(true);
    expect(Object.isFrozen(deletionRequirements)).toBe(true);
  });

  test('returns null or false for unknown records', () => {
    expect(getPolicyAuthoringLegacyBridgeResponsibility('unknown')).toBeNull();
    expect(listPolicyAuthoringLegacyBridgeResponsibilitiesByStage('unknown')).toEqual([]);
    expect(canPolicyAuthoringLegacyBridgeSerializeKey('unknown')).toBe(false);
    expect(shouldPolicyAuthoringLegacyBridgePreserveUnsupportedKey('unknown')).toBe(false);
    expect(canPolicyAuthoringPathMutateLegacyPayload('unknown')).toBe(false);
  });
});
