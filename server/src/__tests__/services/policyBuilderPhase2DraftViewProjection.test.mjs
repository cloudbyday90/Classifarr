import {
  PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS,
  PHASE_2R_DRAFT_VIEW_CATEGORY_IDS,
  PHASE_2R_DRAFT_VIEW_FIELD_IDS,
  PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS,
  PHASE_2R_DRAFT_VIEW_RISK_IDS,
  buildPhase2RDraftViewProjectionAudit,
  getPhase2RDraftViewFieldRecord,
  getPhase2RDraftViewProvenanceRecord,
  listPhase2RDraftViewFieldRecords,
  listPhase2RDraftViewFieldsByCategory,
  listPhase2RDraftViewProvenanceRecords,
  resolvePhase2RDraftViewProvenance,
  summarizePhase2RDraftViewProjection,
  validatePhase2RDraftViewField,
  validatePhase2RDraftViewFieldRecord,
  validatePhase2RDraftViewPayload,
  validatePhase2RDraftViewProvenanceRecord,
} from '../../services/policyBuilderPhase2DraftViewProjection.mjs';
import {
  PHASE_2R_DRAFT_COMMAND_IDS,
} from '../../services/policyBuilderPhase2DraftCommandBoundary.mjs';
import {
  PHASE_2R_DRAFT_AUTHORITY_IDS,
  PHASE_2R_DRAFT_FIELD_IDS,
} from '../../services/policyBuilderPhase2DraftContract.mjs';

describe('policyBuilderPhase2DraftViewProjection', () => {
  test('defines the Phase 2R.4 draft view field inventory', () => {
    expect(listPhase2RDraftViewFieldRecords().map(record => record.id)).toEqual([
      PHASE_2R_DRAFT_VIEW_FIELD_IDS.CONFIGURED_INTENT_CHIPS,
      PHASE_2R_DRAFT_VIEW_FIELD_IDS.CANDIDATE_OPTIONS,
      PHASE_2R_DRAFT_VIEW_FIELD_IDS.PROVENANCE_LABELS,
      PHASE_2R_DRAFT_VIEW_FIELD_IDS.SECTION_SUMMARIES,
      PHASE_2R_DRAFT_VIEW_FIELD_IDS.WARNINGS,
      PHASE_2R_DRAFT_VIEW_FIELD_IDS.READINESS_PLACEHOLDER,
      PHASE_2R_DRAFT_VIEW_FIELD_IDS.OBSERVED_EVIDENCE_PLACEHOLDER,
      PHASE_2R_DRAFT_VIEW_FIELD_IDS.COMPATIBILITY_VALUES,
    ]);

    expect(getPhase2RDraftViewFieldRecord(PHASE_2R_DRAFT_VIEW_FIELD_IDS.CONFIGURED_INTENT_CHIPS))
      .toEqual(expect.objectContaining({
        label: 'Configured Intent Chips',
        categoryId: PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_VIEW_MODEL,
        authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
        mayExposeRawLegacyStorage: false,
        mayMutateDraft: false,
        maySerializeSavePayload: false,
        allowedCommandIds: [
          PHASE_2R_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
          PHASE_2R_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
        ],
      }));
  });

  test('summarizes read-only placeholders and view-only protections', () => {
    expect(summarizePhase2RDraftViewProjection()).toEqual({
      fieldCount: 8,
      provenanceCount: 5,
      countsByCategory: {
        [PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_VIEW_MODEL]: 4,
        [PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_COMMAND_HINT]: 1,
        [PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.READ_ONLY_SERVER_PLACEHOLDER]: 2,
        [PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.COMPATIBILITY_ADAPTER_VIEW]: 1,
      },
      readOnlyPlaceholderFieldIds: [
        PHASE_2R_DRAFT_VIEW_FIELD_IDS.READINESS_PLACEHOLDER,
        PHASE_2R_DRAFT_VIEW_FIELD_IDS.OBSERVED_EVIDENCE_PLACEHOLDER,
      ],
      rawLegacyStorageExposureAllowed: false,
      draftMutationAllowed: false,
      saveSerializationAllowed: false,
    });
  });

  test('audits the default draft view projection contract as clean', () => {
    expect(buildPhase2RDraftViewProjectionAudit()).toEqual({
      ok: true,
      checkedFieldCount: 8,
      requiredFieldCount: 8,
      checkedProvenanceCount: 5,
      requiredProvenanceCount: 5,
      fieldResults: listPhase2RDraftViewFieldRecords().map(record => ({
        valid: true,
        fieldId: record.id,
        issues: [],
      })),
      provenanceResults: listPhase2RDraftViewProvenanceRecords().map(record => ({
        valid: true,
        provenanceId: record.id,
        issues: [],
      })),
      missingFieldIds: [],
      duplicateFieldIds: [],
      missingProvenanceIds: [],
      duplicateProvenanceIds: [],
      aliasCollisions: [],
      issues: [],
    });
  });

  test('fails unsafe draft view field records with explicit audit risks', () => {
    const unsafeRecord = {
      id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.COMPATIBILITY_VALUES,
      label: 'customSignals preset_id view',
      categoryId: PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.READ_ONLY_SERVER_PLACEHOLDER,
      authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
      sourceDraftFieldIds: ['unknown_field'],
      mayExposeRawLegacyStorage: true,
      mayMutateDraft: true,
      maySerializeSavePayload: true,
      allowedCommandIds: ['unknown_command'],
    };

    expect(validatePhase2RDraftViewFieldRecord(unsafeRecord)).toEqual({
      valid: false,
      fieldId: PHASE_2R_DRAFT_VIEW_FIELD_IDS.COMPATIBILITY_VALUES,
      issues: [
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_SOURCE_DRAFT_FIELD,
          reason: 'Draft view field references an unknown source draft field.',
        },
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_COMMAND_HINT,
          reason: 'Draft view field exposes a command hint that is not allowed by the command boundary.',
        },
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.RAW_LEGACY_STORAGE_EXPOSURE,
          reason: 'Draft view fields cannot expose raw legacy storage.',
        },
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.VIEW_FIELD_MUTATES_DRAFT,
          reason: 'Draft view fields are read models and cannot mutate draft state.',
        },
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.VIEW_FIELD_SERIALIZES_SAVE_PAYLOAD,
          reason: 'Draft view fields cannot own save serialization.',
        },
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.READ_ONLY_PLACEHOLDER_NOT_SERVER_PROJECTION,
          reason: 'Read-only server placeholders must use server read-only projection authority.',
        },
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.RAW_LEGACY_TERM_IN_VIEW_LABEL,
          reason: 'Draft view field labels must not expose raw legacy storage terminology.',
        },
      ],
    });
  });

  test('fails invalid provenance records and alias collisions', () => {
    expect(validatePhase2RDraftViewProvenanceRecord({
      id: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.SERVER_PROJECTION,
      label: 'Server projection',
      help: 'Internal only.',
      rawSourceAliases: [],
      productFacing: false,
    })).toEqual({
      valid: false,
      provenanceId: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.SERVER_PROJECTION,
      issues: [
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.NON_PRODUCT_FACING_PROVENANCE,
          reason: 'Draft view provenance labels must be product-facing.',
        },
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_PROVENANCE,
          reason: 'Draft view provenance records must declare at least one source alias.',
        },
      ],
    });

    expect(buildPhase2RDraftViewProjectionAudit({
      provenanceRecords: [
        ...listPhase2RDraftViewProvenanceRecords(),
        {
          ...getPhase2RDraftViewProvenanceRecord(PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.SERVER_PROJECTION),
          id: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
          rawSourceAliases: ['intent_draft'],
        },
      ],
    })).toEqual(expect.objectContaining({
      ok: false,
      duplicateProvenanceIds: [PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT],
      aliasCollisions: [
        {
          alias: 'intent_draft',
          firstProvenanceId: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
          secondProvenanceId: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
        },
      ],
      issues: expect.arrayContaining([
        expect.objectContaining({
          provenanceId: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_PROVENANCE,
        }),
        expect.objectContaining({
          provenanceId: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.PROVENANCE_ALIAS_COLLISION,
        }),
      ]),
    }));
  });

  test('keeps readiness and observed evidence as server read-only placeholders', () => {
    expect(listPhase2RDraftViewFieldsByCategory(PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.READ_ONLY_SERVER_PLACEHOLDER))
      .toEqual([
        expect.objectContaining({
          id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.READINESS_PLACEHOLDER,
          sourceDraftFieldIds: [PHASE_2R_DRAFT_FIELD_IDS.READINESS_PROJECTION],
          authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
        }),
        expect.objectContaining({
          id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.OBSERVED_EVIDENCE_PLACEHOLDER,
          sourceDraftFieldIds: [PHASE_2R_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION],
          authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
        }),
      ]);
  });

  test('defines product-facing provenance labels without raw source exposure', () => {
    expect(listPhase2RDraftViewProvenanceRecords().map(record => record.id)).toEqual([
      PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
      PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.STARTER_TEMPLATE,
      PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.COMPATIBILITY_FALLBACK,
      PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.OBSERVED_EVIDENCE_SUGGESTION,
      PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.SERVER_PROJECTION,
    ]);

    expect(resolvePhase2RDraftViewProvenance('legacy_custom_signals'))
      .toEqual(expect.objectContaining({
        id: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.COMPATIBILITY_FALLBACK,
        label: 'Policy override',
      }));
    expect(resolvePhase2RDraftViewProvenance('unexpected'))
      .toEqual(getPhase2RDraftViewProvenanceRecord(PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.STARTER_TEMPLATE));
  });

  test('validates each declared view field as read-only and non-serializing', () => {
    for (const record of listPhase2RDraftViewFieldRecords()) {
      expect(validatePhase2RDraftViewField(record.id)).toEqual({
        valid: true,
        riskId: null,
        reason: 'Draft view field stays within the Phase 2R projection boundary.',
      });
    }
  });

  test('fails unknown view fields and raw legacy payload exposure', () => {
    expect(validatePhase2RDraftViewField('unknown')).toEqual({
      valid: false,
      riskId: PHASE_2R_DRAFT_VIEW_RISK_IDS.PRESENTATION_POLICY_COUPLING,
      reason: 'Unknown draft view field.',
    });

    expect(validatePhase2RDraftViewPayload({
      customSignals: { genres: { require_any: ['Family'] } },
      configuredIntentChips: [],
    })).toEqual({
      valid: false,
      riskId: PHASE_2R_DRAFT_VIEW_RISK_IDS.RAW_LEGACY_STORAGE_EXPOSURE,
      reason: 'Draft view payloads cannot expose raw legacy storage keys.',
      invalidKeys: ['customSignals'],
    });
  });

  test('accepts product view payloads with placeholders and provenance labels', () => {
    expect(validatePhase2RDraftViewPayload({
      configuredIntentChips: [],
      candidateOptions: [],
      provenanceLabels: [],
      readiness: { status: 'not_loaded' },
      observedEvidence: { status: 'not_loaded' },
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Draft view payload contains no raw legacy storage keys.',
      invalidKeys: [],
    });
  });

  test('exposes immutable projection records', () => {
    const fields = listPhase2RDraftViewFieldRecords();
    const provenances = listPhase2RDraftViewProvenanceRecords();

    expect(Object.isFrozen(fields)).toBe(true);
    expect(Object.isFrozen(fields[0])).toBe(true);
    expect(Object.isFrozen(fields[0].allowedCommandIds)).toBe(true);
    expect(Object.isFrozen(provenances)).toBe(true);
    expect(Object.isFrozen(provenances[0])).toBe(true);
  });

  test('returns null and empty lists for unknown lookup values', () => {
    expect(getPhase2RDraftViewFieldRecord('unknown')).toBeNull();
    expect(getPhase2RDraftViewProvenanceRecord('unknown')).toBeNull();
    expect(listPhase2RDraftViewFieldsByCategory('unknown')).toEqual([]);
  });
});
