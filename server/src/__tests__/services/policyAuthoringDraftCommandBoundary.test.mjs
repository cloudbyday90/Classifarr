import {
  POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS,
  POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS,
  POLICY_AUTHORING_DRAFT_COMMAND_IDS,
  POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS,
  POLICY_AUTHORING_DRAFT_COMMAND_PRODUCT_TARGET_IDS,
  POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS,
  buildPolicyAuthoringDraftCommandBoundaryAudit,
  canPolicyAuthoringDraftCommandMutateReadOnlyProjection,
  canPolicyAuthoringDraftCommandWriteCompatibilityField,
  getPolicyAuthoringDraftCommandRecord,
  isPolicyAuthoringDraftCommandAllowed,
  isPolicyAuthoringDraftCommandImplemented,
  listPolicyAuthoringDraftCommandsNeedingProductTarget,
  listPolicyAuthoringDraftCommandRecords,
  listPolicyAuthoringDraftCommandsByCategory,
  summarizePolicyAuthoringDraftCommandBoundary,
  validatePolicyAuthoringDraftCommand,
  validatePolicyAuthoringDraftCommandRecord,
} from '../../services/policyAuthoringDraftCommandBoundary.mjs';
import {
  POLICY_AUTHORING_BRIDGE_ALLOWED_SERIALIZED_KEYS,
} from '../../services/policyAuthoringBridgeSerializer.mjs';
import {
  POLICY_AUTHORING_DRAFT_FIELD_IDS,
} from '../../services/policyAuthoringDraftFieldContract.mjs';

describe('policyAuthoringDraftCommandBoundary', () => {
  test('defines the policy authoring command inventory in product-facing categories', () => {
    expect(listPolicyAuthoringDraftCommandRecords().map(record => record.id)).toEqual([
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.BUILD_SELECTED_PRESETS_FROM_DRAFT,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.APPLY_DRAFT_TO_SELECTED_PRESETS,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
    ]);

    expect(getPolicyAuthoringDraftCommandRecord(POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL))
      .toEqual(expect.objectContaining({
        productLabel: 'Add Intent Signal',
        categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.OPERATOR_EDIT,
        payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT,
        currentImplementation: 'addSignal',
        operatorFacing: true,
        allowBatchValues: true,
      }));
  });

  test('summarizes implemented, reserved, operator, and product-target commands', () => {
    expect(summarizePolicyAuthoringDraftCommandBoundary()).toEqual({
      commandCount: 11,
      countsByCategory: {
        [POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.BRIDGE_SYSTEM]: 3,
        [POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.OPERATOR_EDIT]: 4,
        [POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.LEGACY_COMPATIBILITY_ADAPTER]: 2,
        [POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.FUTURE_OPERATOR_EDIT]: 2,
      },
      implementedCommandIds: [
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.BUILD_SELECTED_PRESETS_FROM_DRAFT,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.APPLY_DRAFT_TO_SELECTED_PRESETS,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
      ],
      futureCommandIds: [
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
      ],
      operatorEditCommandIds: [
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
      ],
      productCommandTargetCommandIds: [
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
        POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
      ],
      readOnlyProjectionMutationAllowed: false,
      allowedCompatibilityConfigKeys: POLICY_AUTHORING_BRIDGE_ALLOWED_SERIALIZED_KEYS,
    });
  });

  test('audits the default command boundary as clean', () => {
    expect(buildPolicyAuthoringDraftCommandBoundaryAudit()).toEqual({
      ok: true,
      checkedCommandCount: 11,
      requiredCommandCount: 11,
      commandResults: listPolicyAuthoringDraftCommandRecords().map(record => ({
        valid: true,
        commandId: record.id,
        issues: [],
      })),
      missingCommandIds: [],
      duplicateCommandIds: [],
      issues: [],
    });
  });

  test('fails unsafe command records with explicit audit risks', () => {
    const unsafeRecord = {
      id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
      productLabel: 'customSignals preset_id adapter',
      categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.LEGACY_COMPATIBILITY_ADAPTER,
      payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT,
      currentImplementation: 'setSignalMetadata',
      implemented: true,
      operatorFacing: true,
      allowBatchValues: true,
      allowCompatibilitySerialization: true,
      mayMutateReadOnlyProjection: true,
      productCommandTargetId: null,
    };

    expect(validatePolicyAuthoringDraftCommandRecord(unsafeRecord)).toEqual({
      valid: false,
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
      issues: [
        {
          riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.COMPATIBILITY_ADAPTER_OPERATOR_FACING,
          reason: 'Legacy compatibility adapter commands must stay behind product-facing command wrappers.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.READ_ONLY_PROJECTION_MUTATION_ALLOWED,
          reason: 'Draft commands cannot mutate server read-only evidence or readiness projections.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.RAW_LEGACY_TERM_IN_OPERATOR_COMMAND,
          reason: 'Operator-facing command labels and identifiers must not expose raw legacy storage terminology.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.MISSING_PRODUCT_COMMAND_TARGET,
          reason: 'Legacy compatibility adapter commands need a product command target.',
        },
      ],
    });
  });

  test('fails future commands that accidentally become implemented', () => {
    expect(validatePolicyAuthoringDraftCommandRecord({
      ...getPolicyAuthoringDraftCommandRecord(POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET),
      implemented: true,
      currentImplementation: 'setRoutingTarget',
    })).toEqual({
      valid: false,
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      issues: [
        {
          riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.IMPLEMENTED_COMMAND_NOT_ALLOWLISTED,
          reason: 'Implemented draft commands must be allow-listed by the draft state boundary.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.FUTURE_COMMAND_HAS_IMPLEMENTATION,
          reason: 'Reserved operator commands must remain unimplemented until server authority and persistence are defined.',
        },
      ],
    });
  });

  test('audits missing and duplicate command records', () => {
    const commandRecords = [
      ...listPolicyAuthoringDraftCommandRecords().filter(record => (
        record.id !== POLICY_AUTHORING_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG
      )),
      getPolicyAuthoringDraftCommandRecord(POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL),
    ];

    expect(buildPolicyAuthoringDraftCommandBoundaryAudit({ commandRecords })).toEqual(expect.objectContaining({
      ok: false,
      checkedCommandCount: 11,
      requiredCommandCount: 11,
      missingCommandIds: [POLICY_AUTHORING_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG],
      duplicateCommandIds: [POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL],
      issues: expect.arrayContaining([
        expect.objectContaining({
          commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
          riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.UNKNOWN_COMMAND,
        }),
        expect.objectContaining({
          commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
          riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.UNKNOWN_COMMAND,
        }),
      ]),
    }));
  });

  test('keeps implemented commands allow-listed and future commands reserved', () => {
    expect(isPolicyAuthoringDraftCommandAllowed(POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL)).toBe(true);
    expect(isPolicyAuthoringDraftCommandImplemented(POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL)).toBe(true);

    expect(isPolicyAuthoringDraftCommandAllowed(POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET)).toBe(true);
    expect(isPolicyAuthoringDraftCommandImplemented(POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET)).toBe(false);

    expect(isPolicyAuthoringDraftCommandAllowed('unknown')).toBe(false);
    expect(isPolicyAuthoringDraftCommandImplemented('unknown')).toBe(false);
  });

  test('fails unknown commands before serialization', () => {
    expect(validatePolicyAuthoringDraftCommand({
      commandId: 'unknown',
      payload: { presetId: 'preset-1' },
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.UNKNOWN_COMMAND,
      reason: 'Unknown draft command.',
      invalidKeys: [],
      missingFields: [],
    });
  });

  test('accepts typed add commands and batched multi-select values', () => {
    expect(validatePolicyAuthoringDraftCommand({
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      payload: {
        presetId: 'preset-1',
        signalType: 'genres',
        key: 'include',
        value: ['Animation', 'Family'],
      },
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Draft command is allow-listed and payload passed policy authoring command boundary checks.',
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      invalidKeys: [],
      missingFields: [],
    });
  });

  test('rejects incomplete operator command payloads', () => {
    expect(validatePolicyAuthoringDraftCommand({
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
      payload: {
        presetId: 'preset-1',
        signalType: 'genres',
        key: 'include',
      },
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.INVALID_PAYLOAD,
      reason: 'Draft signal value command payload is incomplete.',
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
      invalidKeys: [],
      missingFields: ['value'],
    });
  });

  test('rejects raw legacy compatibility payload fields from commands', () => {
    expect(validatePolicyAuthoringDraftCommand({
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      payload: {
        presetId: 'preset-1',
        signalType: 'genres',
        key: 'include',
        value: 'Animation',
        customSignals: [{ signal_type: 'genres' }],
      },
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.LEGACY_STORAGE_TERM_LEAK,
      reason: 'Draft commands must not expose raw legacy compatibility payload fields.',
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      invalidKeys: ['customSignals'],
      missingFields: [],
    });
  });

  test('rejects arbitrary compatibility config fields', () => {
    expect(validatePolicyAuthoringDraftCommand({
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      payload: {
        presetId: 'preset-1',
        signalType: 'genres',
        config: {
          include: ['Animation'],
          provider_hint: 'external',
        },
      },
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.ARBITRARY_COMPATIBILITY_FIELD,
      reason: 'Draft signal configuration contains fields outside the bridge serializer allow-list.',
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      invalidKeys: ['provider_hint'],
      missingFields: [],
    });
  });

  test('keeps read-only evidence and readiness projections immutable from commands', () => {
    expect(canPolicyAuthoringDraftCommandMutateReadOnlyProjection(POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL)).toBe(false);

    expect(validatePolicyAuthoringDraftCommand({
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      payload: {
        presetId: 'preset-1',
        signalType: 'genres',
        key: 'include',
        value: 'Animation',
        fieldId: POLICY_AUTHORING_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
      },
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.READ_ONLY_PROJECTION_MUTATION,
      reason: 'Draft commands cannot mutate read-only evidence or readiness projections.',
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      invalidKeys: ['fieldId'],
      missingFields: [],
    });
  });

  test('keeps future routing commands declarative and blocked until implemented', () => {
    expect(validatePolicyAuthoringDraftCommand({
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      payload: {
        presetId: 'preset-1',
        routingTargetId: 'radarr-1',
      },
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.NOT_IMPLEMENTED,
      reason: 'Draft command is reserved until server authority and persistence are defined.',
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      invalidKeys: [],
      missingFields: [],
    });

    expect(validatePolicyAuthoringDraftCommand({
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      payload: {
        presetId: 'preset-1',
        routingTargetId: 'radarr-1',
        routeNow: true,
      },
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.ROUTING_SIDE_EFFECT,
      reason: 'Draft commands may declare routing intent but cannot execute routing side effects.',
      commandId: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      invalidKeys: ['routeNow'],
      missingFields: [],
    });
  });

  test('allow-lists compatibility fields only through declared serializer keys', () => {
    expect(canPolicyAuthoringDraftCommandWriteCompatibilityField(
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      'include',
    )).toBe(true);
    expect(canPolicyAuthoringDraftCommandWriteCompatibilityField(
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      'provider_hint',
    )).toBe(false);
    expect(canPolicyAuthoringDraftCommandWriteCompatibilityField(
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
      'include',
    )).toBe(false);
  });

  test('identifies compatibility adapter commands with product command targets', () => {
    expect(listPolicyAuthoringDraftCommandsNeedingProductTarget().map(record => ({
      id: record.id,
      target: record.productCommandTargetId,
    }))).toEqual([
      {
        id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
        target: POLICY_AUTHORING_DRAFT_COMMAND_PRODUCT_TARGET_IDS.CONFIGURE_SIGNAL,
      },
      {
        id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
        target: POLICY_AUTHORING_DRAFT_COMMAND_PRODUCT_TARGET_IDS.CONFIGURE_CONSTRAINT_BEHAVIOR,
      },
      {
        id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
        target: POLICY_AUTHORING_DRAFT_COMMAND_PRODUCT_TARGET_IDS.IGNORE_TEMPLATE_SIGNAL,
      },
    ]);
  });

  test('filters command records by category and exposes immutable records', () => {
    expect(listPolicyAuthoringDraftCommandsByCategory(POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.FUTURE_OPERATOR_EDIT)
      .map(record => record.id)).toEqual([
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
    ]);
    expect(listPolicyAuthoringDraftCommandsByCategory('unknown')).toEqual([]);
    expect(getPolicyAuthoringDraftCommandRecord('unknown')).toBeNull();

    const records = listPolicyAuthoringDraftCommandRecords();
    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
  });
});
