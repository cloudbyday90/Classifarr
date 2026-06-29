import {
  DRAFT_COMMAND_IDS,
  DRAFT_SAVE_ALLOWLIST_FIELDS,
  DRAFT_SAVE_PROHIBITED_FIELDS,
  DRAFT_STATE_FIELD_CATEGORIES,
  buildDraftBoundarySummary,
  classifyDraftStateField,
  getDraftCommandRecord,
  getDraftStateFieldRecord,
  isDraftCommandAllowed,
  listDraftCommandRecords,
  listDraftSaveAllowlistFields,
  listDraftSaveProhibitedFields,
  listDraftStateFieldRecords,
  validatePolicyBuilderSavePayloadBoundary,
} from '../../services/policyBuilderDraftStateBoundary.mjs';

describe('policyBuilderDraftStateBoundary', () => {
  test('defines current allow-listed draft commands', () => {
    expect(listDraftCommandRecords().map(record => record.id)).toEqual([
      DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
      DRAFT_COMMAND_IDS.BUILD_SELECTED_PRESETS_FROM_DRAFT,
      DRAFT_COMMAND_IDS.APPLY_DRAFT_TO_SELECTED_PRESETS,
      DRAFT_COMMAND_IDS.ADD_SIGNAL,
      DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
      DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
      DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
      DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
    ]);

    listDraftCommandRecords().forEach(record => {
      expect(record.allowed).toBe(true);
      expect(record.owner).toBe('usePolicyIntentDraft');
      expect(record.notes).toEqual(expect.any(String));
    });
  });

  test('identifies legacy-touching commands for bridge containment', () => {
    expect(getDraftCommandRecord(DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS))
      .toEqual(expect.objectContaining({
        touchesLegacyPayload: false,
        mutatesSelectedPresets: false,
      }));

    [
      DRAFT_COMMAND_IDS.ADD_SIGNAL,
      DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
      DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
      DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
      DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
    ].forEach(commandId => {
      expect(getDraftCommandRecord(commandId)).toEqual(expect.objectContaining({
        touchesLegacyPayload: true,
        mutatesSelectedPresets: true,
      }));
    });
  });

  test('classifies declared intent edit fields separately from compatibility metadata', () => {
    expect(classifyDraftStateField('policyIntentDraft.presets[].buckets.identity_signals'))
      .toBe(DRAFT_STATE_FIELD_CATEGORIES.DECLARED_INTENT_EDIT);
    expect(classifyDraftStateField('policyIntentDraft.presets[].buckets.strict_constraints'))
      .toBe(DRAFT_STATE_FIELD_CATEGORIES.DECLARED_INTENT_EDIT);
    expect(classifyDraftStateField('policyIntentDraft.presets[].legacyCustomSignals'))
      .toBe(DRAFT_STATE_FIELD_CATEGORIES.COMPATIBILITY_PAYLOAD_METADATA);
    expect(classifyDraftStateField('policyIntentDraft.presets[].signalRemovalOverrides'))
      .toBe(DRAFT_STATE_FIELD_CATEGORIES.COMPATIBILITY_PAYLOAD_METADATA);
  });

  test('classifies UI-only and server projection fields as never serialized', () => {
    expect(getDraftStateFieldRecord('expandedPresetIds')).toEqual(expect.objectContaining({
      category: DRAFT_STATE_FIELD_CATEGORIES.UI_ONLY_TRANSIENT_STATE,
      saveBehavior: 'never serialized',
    }));
    expect(getDraftStateFieldRecord('libraryProfile')).toEqual(expect.objectContaining({
      category: DRAFT_STATE_FIELD_CATEGORIES.SERVER_PROJECTION_DISPLAY,
      saveBehavior: 'never serialized as policy intent',
    }));
    expect(getDraftStateFieldRecord('impactPreview')).toEqual(expect.objectContaining({
      category: DRAFT_STATE_FIELD_CATEGORIES.SERVER_PROJECTION_DISPLAY,
      saveBehavior: 'never serialized as policy intent',
    }));
  });

  test('keeps policy save fields explicitly allow-listed', () => {
    expect(listDraftSaveAllowlistFields()).toEqual(DRAFT_SAVE_ALLOWLIST_FIELDS);
    expect(listDraftSaveAllowlistFields()).toEqual(expect.arrayContaining([
      'library_id',
      'name',
      'presets',
      'policyIntentDraft',
    ]));
    expect(listDraftSaveProhibitedFields()).toEqual(DRAFT_SAVE_PROHIBITED_FIELDS);
    expect(listDraftSaveProhibitedFields()).toEqual(expect.arrayContaining([
      'libraryProfile',
      'combinedSignals',
      'impactPreview',
      'replayPreview',
      'expandedPresetIds',
    ]));
  });

  test('validates save payload boundaries and fails on prohibited fields', () => {
    expect(validatePolicyBuilderSavePayloadBoundary({
      library_id: 1,
      name: 'Animated Movies Policy',
      presets: [],
      policyIntentDraft: { source: 'legacy_policy_builder' },
    })).toEqual({
      valid: true,
      allowedFields: [
        'library_id',
        'name',
        'presets',
        'policyIntentDraft',
      ],
      prohibitedFields: [],
      unknownFields: [],
    });

    expect(validatePolicyBuilderSavePayloadBoundary({
      library_id: 1,
      presets: [],
      libraryProfile: {},
      replayPreview: {},
      accidentalState: true,
    })).toEqual({
      valid: false,
      allowedFields: [
        'library_id',
        'presets',
      ],
      prohibitedFields: [
        'libraryProfile',
        'replayPreview',
      ],
      unknownFields: [
        'accidentalState',
      ],
    });
  });

  test('summarizes draft state as non-authoritative server-validated projection', () => {
    expect(buildDraftBoundarySummary()).toEqual(expect.objectContaining({
      draftIsDurableAuthority: false,
      serverValidationRequired: true,
      nativeIntentPersistenceEnabled: false,
      commandIds: listDraftCommandRecords().map(record => record.id),
      fieldCategories: Object.values(DRAFT_STATE_FIELD_CATEGORIES),
    }));
  });

  test('exposes immutable draft records', () => {
    const fields = listDraftStateFieldRecords();
    const commands = listDraftCommandRecords();
    const allowlist = listDraftSaveAllowlistFields();
    const prohibited = listDraftSaveProhibitedFields();

    expect(Object.isFrozen(fields)).toBe(true);
    expect(Object.isFrozen(fields[0])).toBe(true);
    expect(Object.isFrozen(commands)).toBe(true);
    expect(Object.isFrozen(commands[0])).toBe(true);
    expect(Object.isFrozen(allowlist)).toBe(true);
    expect(Object.isFrozen(prohibited)).toBe(true);
  });

  test('returns false or null for unknown draft inputs', () => {
    expect(getDraftCommandRecord('unknown')).toBeNull();
    expect(getDraftStateFieldRecord('unknown')).toBeNull();
    expect(classifyDraftStateField('unknown')).toBeNull();
    expect(isDraftCommandAllowed('unknown')).toBe(false);
  });
});
