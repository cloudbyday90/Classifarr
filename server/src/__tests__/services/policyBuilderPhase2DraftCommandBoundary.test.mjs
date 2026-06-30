import {
  PHASE_2R_DRAFT_COMMAND_AUDIT_RISK_IDS,
  PHASE_2R_DRAFT_COMMAND_CATEGORY_IDS,
  PHASE_2R_DRAFT_COMMAND_IDS,
  PHASE_2R_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS,
  PHASE_2R_DRAFT_COMMAND_RENAME_TARGET_IDS,
  PHASE_2R_DRAFT_COMMAND_RISK_IDS,
  buildPhase2RDraftCommandBoundaryAudit,
  canPhase2RDraftCommandMutateReadOnlyProjection,
  canPhase2RDraftCommandWriteCompatibilityField,
  getPhase2RDraftCommandRecord,
  isPhase2RDraftCommandAllowed,
  isPhase2RDraftCommandImplemented,
  listPhase2RCommandsNeedingRenameOrSplit,
  listPhase2RDraftCommandRecords,
  listPhase2RDraftCommandsByCategory,
  summarizePhase2RDraftCommandBoundary,
  validatePhase2RDraftCommand,
  validatePhase2RDraftCommandRecord,
} from '../../services/policyBuilderPhase2DraftCommandBoundary.mjs';
import {
  PHASE_2R_BRIDGE_ALLOWED_SERIALIZED_KEYS,
} from '../../services/policyBuilderPhase2LegacyBridgeIsolation.mjs';
import {
  PHASE_2R_DRAFT_FIELD_IDS,
} from '../../services/policyBuilderPhase2DraftContract.mjs';

describe('policyBuilderPhase2DraftCommandBoundary', () => {
  test('defines the Phase 2R.3 command inventory in product-facing categories', () => {
    expect(listPhase2RDraftCommandRecords().map(record => record.id)).toEqual([
      PHASE_2R_DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
      PHASE_2R_DRAFT_COMMAND_IDS.BUILD_SELECTED_PRESETS_FROM_DRAFT,
      PHASE_2R_DRAFT_COMMAND_IDS.APPLY_DRAFT_TO_SELECTED_PRESETS,
      PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      PHASE_2R_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
      PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      PHASE_2R_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
      PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
      PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
      PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      PHASE_2R_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
    ]);

    expect(getPhase2RDraftCommandRecord(PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL))
      .toEqual(expect.objectContaining({
        productLabel: 'Add Intent Signal',
        categoryId: PHASE_2R_DRAFT_COMMAND_CATEGORY_IDS.OPERATOR_EDIT,
        payloadAuthorityId: PHASE_2R_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT,
        currentImplementation: 'addSignal',
        operatorFacing: true,
        allowBatchValues: true,
      }));
  });

  test('summarizes implemented, future, operator, and rename/split commands', () => {
    expect(summarizePhase2RDraftCommandBoundary()).toEqual({
      commandCount: 11,
      countsByCategory: {
        [PHASE_2R_DRAFT_COMMAND_CATEGORY_IDS.BRIDGE_SYSTEM]: 3,
        [PHASE_2R_DRAFT_COMMAND_CATEGORY_IDS.OPERATOR_EDIT]: 4,
        [PHASE_2R_DRAFT_COMMAND_CATEGORY_IDS.LEGACY_COMPATIBILITY_ADAPTER]: 2,
        [PHASE_2R_DRAFT_COMMAND_CATEGORY_IDS.FUTURE_OPERATOR_EDIT]: 2,
      },
      implementedCommandIds: [
        PHASE_2R_DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
        PHASE_2R_DRAFT_COMMAND_IDS.BUILD_SELECTED_PRESETS_FROM_DRAFT,
        PHASE_2R_DRAFT_COMMAND_IDS.APPLY_DRAFT_TO_SELECTED_PRESETS,
        PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
        PHASE_2R_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
        PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
        PHASE_2R_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
        PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
        PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
      ],
      futureCommandIds: [
        PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
        PHASE_2R_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
      ],
      operatorEditCommandIds: [
        PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
        PHASE_2R_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
        PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
        PHASE_2R_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
      ],
      phase6RenameOrSplitCommandIds: [
        PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
        PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
        PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
      ],
      readOnlyProjectionMutationAllowed: false,
      allowedCompatibilityConfigKeys: PHASE_2R_BRIDGE_ALLOWED_SERIALIZED_KEYS,
    });
  });

  test('audits the default command boundary as clean', () => {
    expect(buildPhase2RDraftCommandBoundaryAudit()).toEqual({
      ok: true,
      checkedCommandCount: 11,
      requiredCommandCount: 11,
      commandResults: listPhase2RDraftCommandRecords().map(record => ({
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
      id: PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
      productLabel: 'customSignals preset_id adapter',
      categoryId: PHASE_2R_DRAFT_COMMAND_CATEGORY_IDS.LEGACY_COMPATIBILITY_ADAPTER,
      payloadAuthorityId: PHASE_2R_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT,
      currentImplementation: 'setSignalMetadata',
      implemented: true,
      operatorFacing: true,
      allowBatchValues: true,
      allowCompatibilitySerialization: true,
      mayMutateReadOnlyProjection: true,
      phase6RenameOrSplitTargetId: null,
    };

    expect(validatePhase2RDraftCommandRecord(unsafeRecord)).toEqual({
      valid: false,
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
      issues: [
        {
          riskId: PHASE_2R_DRAFT_COMMAND_AUDIT_RISK_IDS.COMPATIBILITY_ADAPTER_OPERATOR_FACING,
          reason: 'Legacy compatibility adapter commands must stay behind product-facing command wrappers.',
        },
        {
          riskId: PHASE_2R_DRAFT_COMMAND_AUDIT_RISK_IDS.READ_ONLY_PROJECTION_MUTATION_ALLOWED,
          reason: 'Draft commands cannot mutate server read-only evidence or readiness projections.',
        },
        {
          riskId: PHASE_2R_DRAFT_COMMAND_AUDIT_RISK_IDS.RAW_LEGACY_TERM_IN_OPERATOR_COMMAND,
          reason: 'Operator-facing command labels and identifiers must not expose raw legacy storage terminology.',
        },
        {
          riskId: PHASE_2R_DRAFT_COMMAND_AUDIT_RISK_IDS.MISSING_PHASE_6_RENAME_TARGET,
          reason: 'Legacy compatibility adapter commands need a Phase 6R rename or split target.',
        },
      ],
    });
  });

  test('fails future commands that accidentally become implemented', () => {
    expect(validatePhase2RDraftCommandRecord({
      ...getPhase2RDraftCommandRecord(PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET),
      implemented: true,
      currentImplementation: 'setRoutingTarget',
    })).toEqual({
      valid: false,
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      issues: [
        {
          riskId: PHASE_2R_DRAFT_COMMAND_AUDIT_RISK_IDS.IMPLEMENTED_COMMAND_NOT_ALLOWLISTED,
          reason: 'Implemented draft commands must be allow-listed by the draft state boundary.',
        },
        {
          riskId: PHASE_2R_DRAFT_COMMAND_AUDIT_RISK_IDS.FUTURE_COMMAND_HAS_IMPLEMENTATION,
          reason: 'Future operator commands must remain reserved until a later phase implements authority and persistence.',
        },
      ],
    });
  });

  test('audits missing and duplicate command records', () => {
    const commandRecords = [
      ...listPhase2RDraftCommandRecords().filter(record => (
        record.id !== PHASE_2R_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG
      )),
      getPhase2RDraftCommandRecord(PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL),
    ];

    expect(buildPhase2RDraftCommandBoundaryAudit({ commandRecords })).toEqual(expect.objectContaining({
      ok: false,
      checkedCommandCount: 11,
      requiredCommandCount: 11,
      missingCommandIds: [PHASE_2R_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG],
      duplicateCommandIds: [PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL],
      issues: expect.arrayContaining([
        expect.objectContaining({
          commandId: PHASE_2R_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
          riskId: PHASE_2R_DRAFT_COMMAND_AUDIT_RISK_IDS.UNKNOWN_COMMAND,
        }),
        expect.objectContaining({
          commandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
          riskId: PHASE_2R_DRAFT_COMMAND_AUDIT_RISK_IDS.UNKNOWN_COMMAND,
        }),
      ]),
    }));
  });

  test('keeps implemented commands allow-listed and future commands reserved', () => {
    expect(isPhase2RDraftCommandAllowed(PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL)).toBe(true);
    expect(isPhase2RDraftCommandImplemented(PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL)).toBe(true);

    expect(isPhase2RDraftCommandAllowed(PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET)).toBe(true);
    expect(isPhase2RDraftCommandImplemented(PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET)).toBe(false);

    expect(isPhase2RDraftCommandAllowed('unknown')).toBe(false);
    expect(isPhase2RDraftCommandImplemented('unknown')).toBe(false);
  });

  test('fails unknown commands before serialization', () => {
    expect(validatePhase2RDraftCommand({
      commandId: 'unknown',
      payload: { presetId: 'preset-1' },
    })).toEqual({
      valid: false,
      riskId: PHASE_2R_DRAFT_COMMAND_RISK_IDS.UNKNOWN_COMMAND,
      reason: 'Unknown draft command.',
      invalidKeys: [],
      missingFields: [],
    });
  });

  test('accepts typed add commands and batched multi-select values', () => {
    expect(validatePhase2RDraftCommand({
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      payload: {
        presetId: 'preset-1',
        signalType: 'genres',
        key: 'include',
        value: ['Animation', 'Family'],
      },
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Draft command is allow-listed and payload passed Phase 2R command boundary checks.',
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      invalidKeys: [],
      missingFields: [],
    });
  });

  test('rejects incomplete operator command payloads', () => {
    expect(validatePhase2RDraftCommand({
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
      payload: {
        presetId: 'preset-1',
        signalType: 'genres',
        key: 'include',
      },
    })).toEqual({
      valid: false,
      riskId: PHASE_2R_DRAFT_COMMAND_RISK_IDS.INVALID_PAYLOAD,
      reason: 'Draft signal value command payload is incomplete.',
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
      invalidKeys: [],
      missingFields: ['value'],
    });
  });

  test('rejects raw legacy compatibility payload fields from commands', () => {
    expect(validatePhase2RDraftCommand({
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      payload: {
        presetId: 'preset-1',
        signalType: 'genres',
        key: 'include',
        value: 'Animation',
        customSignals: [{ signal_type: 'genres' }],
      },
    })).toEqual({
      valid: false,
      riskId: PHASE_2R_DRAFT_COMMAND_RISK_IDS.LEGACY_STORAGE_TERM_LEAK,
      reason: 'Draft commands must not expose raw legacy compatibility payload fields.',
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      invalidKeys: ['customSignals'],
      missingFields: [],
    });
  });

  test('rejects arbitrary compatibility config fields', () => {
    expect(validatePhase2RDraftCommand({
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
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
      riskId: PHASE_2R_DRAFT_COMMAND_RISK_IDS.ARBITRARY_COMPATIBILITY_FIELD,
      reason: 'Draft signal configuration contains fields outside the bridge serializer allow-list.',
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      invalidKeys: ['provider_hint'],
      missingFields: [],
    });
  });

  test('keeps read-only evidence and readiness projections immutable from commands', () => {
    expect(canPhase2RDraftCommandMutateReadOnlyProjection(PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL)).toBe(false);

    expect(validatePhase2RDraftCommand({
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      payload: {
        presetId: 'preset-1',
        signalType: 'genres',
        key: 'include',
        value: 'Animation',
        fieldId: PHASE_2R_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
      },
    })).toEqual({
      valid: false,
      riskId: PHASE_2R_DRAFT_COMMAND_RISK_IDS.READ_ONLY_PROJECTION_MUTATION,
      reason: 'Draft commands cannot mutate read-only evidence or readiness projections.',
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      invalidKeys: ['fieldId'],
      missingFields: [],
    });
  });

  test('keeps future routing commands declarative and blocked until implemented', () => {
    expect(validatePhase2RDraftCommand({
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      payload: {
        presetId: 'preset-1',
        routingTargetId: 'radarr-1',
      },
    })).toEqual({
      valid: false,
      riskId: PHASE_2R_DRAFT_COMMAND_RISK_IDS.NOT_IMPLEMENTED,
      reason: 'Draft command is reserved for a future Phase 2R or Phase 6R implementation.',
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      invalidKeys: [],
      missingFields: [],
    });

    expect(validatePhase2RDraftCommand({
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      payload: {
        presetId: 'preset-1',
        routingTargetId: 'radarr-1',
        routeNow: true,
      },
    })).toEqual({
      valid: false,
      riskId: PHASE_2R_DRAFT_COMMAND_RISK_IDS.ROUTING_SIDE_EFFECT,
      reason: 'Draft commands may declare routing intent but cannot execute routing side effects.',
      commandId: PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      invalidKeys: ['routeNow'],
      missingFields: [],
    });
  });

  test('allow-lists compatibility fields only through declared serializer keys', () => {
    expect(canPhase2RDraftCommandWriteCompatibilityField(
      PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      'include',
    )).toBe(true);
    expect(canPhase2RDraftCommandWriteCompatibilityField(
      PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      'provider_hint',
    )).toBe(false);
    expect(canPhase2RDraftCommandWriteCompatibilityField(
      PHASE_2R_DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
      'include',
    )).toBe(false);
  });

  test('identifies commands that should be renamed or split during Phase 6R', () => {
    expect(listPhase2RCommandsNeedingRenameOrSplit().map(record => ({
      id: record.id,
      target: record.phase6RenameOrSplitTargetId,
    }))).toEqual([
      {
        id: PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
        target: PHASE_2R_DRAFT_COMMAND_RENAME_TARGET_IDS.CONFIGURE_SIGNAL,
      },
      {
        id: PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
        target: PHASE_2R_DRAFT_COMMAND_RENAME_TARGET_IDS.CONFIGURE_CONSTRAINT_BEHAVIOR,
      },
      {
        id: PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
        target: PHASE_2R_DRAFT_COMMAND_RENAME_TARGET_IDS.IGNORE_TEMPLATE_SIGNAL,
      },
    ]);
  });

  test('filters command records by category and exposes immutable records', () => {
    expect(listPhase2RDraftCommandsByCategory(PHASE_2R_DRAFT_COMMAND_CATEGORY_IDS.FUTURE_OPERATOR_EDIT)
      .map(record => record.id)).toEqual([
      PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      PHASE_2R_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
    ]);
    expect(listPhase2RDraftCommandsByCategory('unknown')).toEqual([]);
    expect(getPhase2RDraftCommandRecord('unknown')).toBeNull();

    const records = listPhase2RDraftCommandRecords();
    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
  });
});
