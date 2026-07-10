import {
  LEGACY_COMPATIBILITY_ACTION_IDS,
  LEGACY_COMPATIBILITY_AUDIT_RISK_IDS,
  LEGACY_COMPATIBILITY_ARTIFACT_IDS,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS,
  LEGACY_COMPATIBILITY_OWNER_IDS,
  LEGACY_COMPATIBILITY_RISK_IDS,
  buildLegacyCompatibilityBoundaryAudit,
  canMutateLegacyPayload,
  evaluateLegacyCompatibilityDeletionReadiness,
  getLegacyCompatibilityArtifact,
  getLegacyCompatibilityModuleRecord,
  isLegacyCompatibilityBridgeOwner,
  listLegacyCompatibilityArtifacts,
  listLegacyCompatibilityDeletionGates,
  listLegacyCompatibilityModuleRecords,
  summarizeLegacyCompatibilityBoundary,
  validateLegacyCompatibilityModuleRecord,
  validateLegacyCompatibilityTouchpoint,
} from '../../services/policyBuilderLegacyCompatibilityBoundary.mjs';

describe('policyBuilderLegacyCompatibilityBoundary', () => {
  test('defines the legacy compatibility artifacts', () => {
    expect(listLegacyCompatibilityArtifacts().map(artifact => artifact.id)).toEqual([
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STARTER_TEMPLATE_WEIGHTS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
      LEGACY_COMPATIBILITY_ARTIFACT_IDS.COMPATIBILITY_FALLBACK_PROJECTION,
    ]);

    expect(getLegacyCompatibilityArtifact(LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS))
      .toEqual(expect.objectContaining({
        label: 'Custom signals',
        productLanguage: 'declared intent signals',
        nativeStorageDisposition: 'delete after native intent storage is read/write authoritative',
      }));
  });

  test('classifies current legacy compatibility modules', () => {
    const summary = summarizeLegacyCompatibilityBoundary();

    expect(summary).toEqual({
      artifactCount: 6,
      moduleRecordCount: 8,
      deletionGateCount: 7,
      rawMutationOwnerIds: ['policy_intent_draft_bridge'],
      productFacingRecordIds: [
        'starter_template_mechanics',
        'starter_template_details',
      ],
      deleteAfterNativeStorageRecordIds: ['policy_intent_draft_bridge'],
    });
  });

  test('allows raw legacy payload mutation only in the draft bridge serializer', () => {
    expect(isLegacyCompatibilityBridgeOwner('client/src/utils/policyIntentDraftBridge.js')).toBe(true);
    expect(canMutateLegacyPayload('client/src/utils/policyIntentDraftBridge.js')).toBe(true);

    expect(isLegacyCompatibilityBridgeOwner('client/src/composables/usePolicyIntentDraft.js')).toBe(false);
    expect(canMutateLegacyPayload('client/src/composables/usePolicyIntentDraft.js')).toBe(false);
    expect(canMutateLegacyPayload('client/src/components/policies/PolicyStarterTemplateDetails.vue')).toBe(false);
  });

  test('audits current compatibility modules and deletion gates as contained', () => {
    expect(buildLegacyCompatibilityBoundaryAudit()).toEqual({
      ok: true,
      checkedModuleCount: listLegacyCompatibilityModuleRecords().length,
      checkedDeletionGateCount: listLegacyCompatibilityDeletionGates().length,
      moduleResults: listLegacyCompatibilityModuleRecords().map(record => ({
        ok: true,
        moduleId: record.id,
        issues: [],
      })),
      issues: [],
    });
  });

  test('fails module audit when raw mutation or product raw access leaks', () => {
    const result = validateLegacyCompatibilityModuleRecord({
      id: 'unsafe_product_component',
      path: 'client/src/components/policies/UnsafeProductComponent.vue',
      ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.PRODUCT_COMPONENT_CONSUMER,
      artifactIds: [
        LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
        'unknown_artifact',
      ],
      allowedActions: [
        LEGACY_COMPATIBILITY_ACTION_IDS.READ_COMPATIBILITY_PAYLOAD,
      ],
      productFacing: true,
      canMutateRawLegacyPayload: true,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.UNKNOWN_MODULE,
      }),
      expect.objectContaining({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.DISALLOWED_ARTIFACT_OWNER,
        artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      }),
      expect.objectContaining({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.UNKNOWN_ARTIFACT,
        artifactId: 'unknown_artifact',
      }),
      expect.objectContaining({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.RAW_MUTATION_OUTSIDE_BRIDGE,
      }),
      expect.objectContaining({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.PRODUCT_FACING_RAW_ACCESS,
      }),
    ]));
  });

  test('audits deletion gates for required compatibility-removal coverage', () => {
    const audit = buildLegacyCompatibilityBoundaryAudit({
      deletionGates: [
        {
          id: LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
          required: false,
        },
      ],
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.DELETION_GATE_NOT_REQUIRED,
        gateId: LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
      }),
      expect.objectContaining({
        riskId: LEGACY_COMPATIBILITY_AUDIT_RISK_IDS.MISSING_DELETION_GATE,
        gateId: LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LOSSLESS_CONVERSION,
      }),
    ]));
  });

  test('normalizes paths when resolving module records', () => {
    expect(getLegacyCompatibilityModuleRecord('client\\src\\utils\\policyIntentDraftBridge.js'))
      .toEqual(expect.objectContaining({
        id: 'policy_intent_draft_bridge',
        ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.DRAFT_BRIDGE,
      }));

    expect(getLegacyCompatibilityModuleRecord('policy_builder_state'))
      .toEqual(expect.objectContaining({
        path: 'client/src/composables/usePolicyBuilderState.js',
        ownerId: LEGACY_COMPATIBILITY_OWNER_IDS.POLICY_BUILDER_STATE,
      }));
  });

  test('accepts bridge serialization for custom signals', () => {
    expect(validateLegacyCompatibilityTouchpoint({
      path: 'client/src/utils/policyIntentDraftBridge.js',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.WRITE_RAW_PAYLOAD,
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Legacy compatibility touchpoint stays within the declared boundary.',
    });
  });

  test('rejects product component raw legacy payload reads and writes', () => {
    expect(validateLegacyCompatibilityTouchpoint({
      path: 'client/src/components/policies/PolicyStarterTemplateDetails.vue',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.READ_COMPATIBILITY_PAYLOAD,
    })).toEqual({
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.PRODUCT_LANGUAGE_LEAK,
      reason: 'Product components should consume product-language projections or route commands, not raw legacy payloads.',
    });

    expect(validateLegacyCompatibilityTouchpoint({
      path: 'client/src/components/policies/PolicyStarterTemplateDetails.vue',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.REMOVED_MARKERS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.WRITE_RAW_PAYLOAD,
    })).toEqual({
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.RAW_PAYLOAD_MUTATION,
      reason: 'Raw legacy payload writes must stay inside the draft bridge serializer.',
    });
  });

  test('allows product components to route draft commands instead of mutating payloads', () => {
    expect(validateLegacyCompatibilityTouchpoint({
      path: 'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.STRICT_ADVISORY_METADATA,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.ROUTE_THROUGH_DRAFT_COMMAND,
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Legacy compatibility touchpoint stays within the declared boundary.',
    });
  });

  test('keeps policy builder state as a bridge caller, not a raw mutation owner', () => {
    expect(validateLegacyCompatibilityTouchpoint({
      path: 'client/src/composables/usePolicyBuilderState.js',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.SERIALIZE_THROUGH_BRIDGE,
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Legacy compatibility touchpoint stays within the declared boundary.',
    });

    expect(validateLegacyCompatibilityTouchpoint({
      path: 'client/src/composables/usePolicyBuilderState.js',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.WRITE_RAW_PAYLOAD,
    })).toEqual({
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.RAW_PAYLOAD_MUTATION,
      reason: 'Raw legacy payload writes must stay inside the draft bridge serializer.',
    });
  });

  test('rejects unknown modules, unknown artifacts, and unowned artifacts', () => {
    expect(validateLegacyCompatibilityTouchpoint({
      path: 'client/src/components/policies/Unknown.vue',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.CUSTOM_SIGNALS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.PRESENT_ONLY,
    })).toEqual({
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.ENGINE_AUTHORITY_CONFUSION,
      reason: 'Unknown module has no declared legacy compatibility ownership.',
    });

    expect(validateLegacyCompatibilityTouchpoint({
      path: 'client/src/utils/policyIntentDraftBridge.js',
      artifactId: 'unknown',
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.PRESENT_ONLY,
    })).toEqual({
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.ENGINE_AUTHORITY_CONFUSION,
      reason: 'Unknown legacy compatibility artifact.',
    });

    expect(validateLegacyCompatibilityTouchpoint({
      path: 'client/src/composables/usePolicyBuilderCombinedSignals.js',
      artifactId: LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS,
      operation: LEGACY_COMPATIBILITY_ACTION_IDS.PRESENT_ONLY,
    })).toEqual({
      valid: false,
      riskId: LEGACY_COMPATIBILITY_RISK_IDS.ENGINE_AUTHORITY_CONFUSION,
      reason: 'Module does not own or consume this legacy compatibility artifact.',
    });
  });

  test('requires compatibility-removal deletion gates before bridge removal', () => {
    expect(listLegacyCompatibilityDeletionGates().map(gate => gate.id)).toEqual([
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LOSSLESS_CONVERSION,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.ROLLBACK_SNAPSHOT,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_READ_WRITE_PARITY,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LEGACY_WRITE_SHUTDOWN,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.BACKUP_RESTORE_VERIFICATION,
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE,
    ]);

    listLegacyCompatibilityDeletionGates().forEach(gate => {
      expect(gate.required).toBe(true);
    });
  });

  test('evaluates compatibility-removal readiness from completed gates', () => {
    const allGateIds = listLegacyCompatibilityDeletionGates().map(gate => gate.id);

    expect(evaluateLegacyCompatibilityDeletionReadiness([
      LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
    ])).toEqual({
      ready: false,
      requiredGateIds: allGateIds,
      completedGateIds: [
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
      ],
      missingGateIds: allGateIds.filter(gateId => gateId !== LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA),
    });

    expect(evaluateLegacyCompatibilityDeletionReadiness(allGateIds)).toEqual({
      ready: true,
      requiredGateIds: allGateIds,
      completedGateIds: allGateIds,
      missingGateIds: [],
    });
  });

  test('exposes immutable compatibility records', () => {
    const artifacts = listLegacyCompatibilityArtifacts();
    const modules = listLegacyCompatibilityModuleRecords();
    const gates = listLegacyCompatibilityDeletionGates();

    expect(Object.isFrozen(artifacts)).toBe(true);
    expect(Object.isFrozen(artifacts[0])).toBe(true);
    expect(Object.isFrozen(modules)).toBe(true);
    expect(Object.isFrozen(modules[0])).toBe(true);
    expect(Object.isFrozen(gates)).toBe(true);
    expect(Object.isFrozen(gates[0])).toBe(true);
  });

  test('returns null or false for unknown lookups', () => {
    expect(getLegacyCompatibilityArtifact('unknown')).toBeNull();
    expect(getLegacyCompatibilityModuleRecord('unknown')).toBeNull();
    expect(isLegacyCompatibilityBridgeOwner('unknown')).toBe(false);
    expect(canMutateLegacyPayload('unknown')).toBe(false);
  });
});
