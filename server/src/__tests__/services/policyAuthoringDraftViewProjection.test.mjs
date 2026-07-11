import {
  POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS,
  POLICY_AUTHORING_DRAFT_VIEW_CATEGORY_IDS,
  POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS,
  POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS,
  POLICY_AUTHORING_DRAFT_VIEW_RISK_IDS,
  buildPolicyAuthoringDraftViewProjectionAudit,
  getPolicyAuthoringDraftViewFieldRecord,
  getPolicyAuthoringDraftViewProvenanceRecord,
  listPolicyAuthoringDraftViewFieldRecords,
  listPolicyAuthoringDraftViewFieldsByCategory,
  listPolicyAuthoringDraftViewProvenanceRecords,
  resolvePolicyAuthoringDraftViewProvenance,
  summarizePolicyAuthoringDraftViewProjection,
  validatePolicyAuthoringDraftViewField,
  validatePolicyAuthoringDraftViewFieldRecord,
  validatePolicyAuthoringDraftViewPayload,
  validatePolicyAuthoringDraftViewProvenanceRecord,
} from '../../services/policyAuthoringDraftViewProjection.mjs';
import {
  POLICY_AUTHORING_DRAFT_COMMAND_IDS,
} from '../../services/policyAuthoringDraftCommandBoundary.mjs';
import {
  POLICY_AUTHORING_DRAFT_AUTHORITY_IDS,
  POLICY_AUTHORING_DRAFT_FIELD_IDS,
} from '../../services/policyAuthoringDraftFieldContract.mjs';

describe('policyAuthoringDraftViewProjection', () => {
  test('defines the policy authoring draft view field inventory', () => {
    expect(listPolicyAuthoringDraftViewFieldRecords().map(record => record.id)).toEqual([
      POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.CONFIGURED_INTENT_CHIPS,
      POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.CANDIDATE_OPTIONS,
      POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.PROVENANCE_LABELS,
      POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.SECTION_SUMMARIES,
      POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.WARNINGS,
      POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.READINESS_PLACEHOLDER,
      POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.OBSERVED_EVIDENCE_PLACEHOLDER,
      POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.COMPATIBILITY_VALUES,
    ]);

    expect(getPolicyAuthoringDraftViewFieldRecord(POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.CONFIGURED_INTENT_CHIPS))
      .toEqual(expect.objectContaining({
        label: 'Configured Intent Chips',
        categoryId: POLICY_AUTHORING_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_VIEW_MODEL,
        authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
        mayExposeRawLegacyStorage: false,
        mayMutateDraft: false,
        maySerializeSavePayload: false,
        allowedCommandIds: [
          POLICY_AUTHORING_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
          POLICY_AUTHORING_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
        ],
      }));
  });

  test('summarizes read-only placeholders and view-only protections', () => {
    expect(summarizePolicyAuthoringDraftViewProjection()).toEqual({
      fieldCount: 8,
      provenanceCount: 5,
      countsByCategory: {
        [POLICY_AUTHORING_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_VIEW_MODEL]: 4,
        [POLICY_AUTHORING_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_COMMAND_HINT]: 1,
        [POLICY_AUTHORING_DRAFT_VIEW_CATEGORY_IDS.READ_ONLY_SERVER_PLACEHOLDER]: 2,
        [POLICY_AUTHORING_DRAFT_VIEW_CATEGORY_IDS.COMPATIBILITY_ADAPTER_VIEW]: 1,
      },
      readOnlyPlaceholderFieldIds: [
        POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.READINESS_PLACEHOLDER,
        POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.OBSERVED_EVIDENCE_PLACEHOLDER,
      ],
      rawLegacyStorageExposureAllowed: false,
      draftMutationAllowed: false,
      saveSerializationAllowed: false,
    });
  });

  test('audits the default draft view projection contract as clean', () => {
    expect(buildPolicyAuthoringDraftViewProjectionAudit()).toEqual({
      ok: true,
      checkedFieldCount: 8,
      requiredFieldCount: 8,
      checkedProvenanceCount: 5,
      requiredProvenanceCount: 5,
      fieldResults: listPolicyAuthoringDraftViewFieldRecords().map(record => ({
        valid: true,
        fieldId: record.id,
        issues: [],
      })),
      provenanceResults: listPolicyAuthoringDraftViewProvenanceRecords().map(record => ({
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
      id: POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.COMPATIBILITY_VALUES,
      label: 'customSignals preset_id view',
      categoryId: POLICY_AUTHORING_DRAFT_VIEW_CATEGORY_IDS.READ_ONLY_SERVER_PLACEHOLDER,
      authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
      sourceDraftFieldIds: ['unknown_field'],
      mayExposeRawLegacyStorage: true,
      mayMutateDraft: true,
      maySerializeSavePayload: true,
      allowedCommandIds: ['unknown_command'],
    };

    expect(validatePolicyAuthoringDraftViewFieldRecord(unsafeRecord)).toEqual({
      valid: false,
      fieldId: POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.COMPATIBILITY_VALUES,
      issues: [
        {
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_SOURCE_DRAFT_FIELD,
          reason: 'Draft view field references an unknown source draft field.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_COMMAND_HINT,
          reason: 'Draft view field exposes a command hint that is not allowed by the command boundary.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.RAW_LEGACY_STORAGE_EXPOSURE,
          reason: 'Draft view fields cannot expose raw legacy storage.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.VIEW_FIELD_MUTATES_DRAFT,
          reason: 'Draft view fields are read models and cannot mutate draft state.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.VIEW_FIELD_SERIALIZES_SAVE_PAYLOAD,
          reason: 'Draft view fields cannot own save serialization.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.READ_ONLY_PLACEHOLDER_NOT_SERVER_PROJECTION,
          reason: 'Read-only server placeholders must use server read-only projection authority.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.RAW_LEGACY_TERM_IN_VIEW_LABEL,
          reason: 'Draft view field labels must not expose raw legacy storage terminology.',
        },
      ],
    });
  });

  test('fails invalid provenance records and alias collisions', () => {
    expect(validatePolicyAuthoringDraftViewProvenanceRecord({
      id: POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.SERVER_PROJECTION,
      label: 'Server projection',
      help: 'Internal only.',
      rawSourceAliases: [],
      productFacing: false,
    })).toEqual({
      valid: false,
      provenanceId: POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.SERVER_PROJECTION,
      issues: [
        {
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.NON_PRODUCT_FACING_PROVENANCE,
          reason: 'Draft view provenance labels must be product-facing.',
        },
        {
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_PROVENANCE,
          reason: 'Draft view provenance records must declare at least one source alias.',
        },
      ],
    });

    expect(buildPolicyAuthoringDraftViewProjectionAudit({
      provenanceRecords: [
        ...listPolicyAuthoringDraftViewProvenanceRecords(),
        {
          ...getPolicyAuthoringDraftViewProvenanceRecord(POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.SERVER_PROJECTION),
          id: POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
          rawSourceAliases: ['intent_draft'],
        },
      ],
    })).toEqual(expect.objectContaining({
      ok: false,
      duplicateProvenanceIds: [POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT],
      aliasCollisions: [
        {
          alias: 'intent_draft',
          firstProvenanceId: POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
          secondProvenanceId: POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
        },
      ],
      issues: expect.arrayContaining([
        expect.objectContaining({
          provenanceId: POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_PROVENANCE,
        }),
        expect.objectContaining({
          provenanceId: POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
          riskId: POLICY_AUTHORING_DRAFT_VIEW_AUDIT_RISK_IDS.PROVENANCE_ALIAS_COLLISION,
        }),
      ]),
    }));
  });

  test('keeps readiness and observed evidence as server read-only placeholders', () => {
    expect(listPolicyAuthoringDraftViewFieldsByCategory(POLICY_AUTHORING_DRAFT_VIEW_CATEGORY_IDS.READ_ONLY_SERVER_PLACEHOLDER))
      .toEqual([
        expect.objectContaining({
          id: POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.READINESS_PLACEHOLDER,
          sourceDraftFieldIds: [POLICY_AUTHORING_DRAFT_FIELD_IDS.READINESS_PROJECTION],
          authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
        }),
        expect.objectContaining({
          id: POLICY_AUTHORING_DRAFT_VIEW_FIELD_IDS.OBSERVED_EVIDENCE_PLACEHOLDER,
          sourceDraftFieldIds: [POLICY_AUTHORING_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION],
          authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
        }),
      ]);
  });

  test('defines product-facing provenance labels without raw source exposure', () => {
    expect(listPolicyAuthoringDraftViewProvenanceRecords().map(record => record.id)).toEqual([
      POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
      POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.STARTER_TEMPLATE,
      POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.COMPATIBILITY_FALLBACK,
      POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.OBSERVED_EVIDENCE_SUGGESTION,
      POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.SERVER_PROJECTION,
    ]);

    expect(resolvePolicyAuthoringDraftViewProvenance('legacy_custom_signals'))
      .toEqual(expect.objectContaining({
        id: POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.COMPATIBILITY_FALLBACK,
        label: 'Policy override',
      }));
    expect(resolvePolicyAuthoringDraftViewProvenance('unexpected'))
      .toEqual(getPolicyAuthoringDraftViewProvenanceRecord(POLICY_AUTHORING_DRAFT_VIEW_PROVENANCE_IDS.STARTER_TEMPLATE));
  });

  test('validates each declared view field as read-only and non-serializing', () => {
    for (const record of listPolicyAuthoringDraftViewFieldRecords()) {
      expect(validatePolicyAuthoringDraftViewField(record.id)).toEqual({
        valid: true,
        riskId: null,
        reason: 'Draft view field stays within the policy authoring view boundary.',
      });
    }
  });

  test('fails unknown view fields and raw legacy payload exposure', () => {
    expect(validatePolicyAuthoringDraftViewField('unknown')).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_VIEW_RISK_IDS.PRESENTATION_POLICY_COUPLING,
      reason: 'Unknown draft view field.',
    });

    expect(validatePolicyAuthoringDraftViewPayload({
      customSignals: { genres: { require_any: ['Family'] } },
      configuredIntentChips: [],
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_VIEW_RISK_IDS.RAW_LEGACY_STORAGE_EXPOSURE,
      reason: 'Draft view payloads cannot expose raw legacy storage keys.',
      invalidKeys: ['customSignals'],
    });
  });

  test('accepts product view payloads with placeholders and provenance labels', () => {
    expect(validatePolicyAuthoringDraftViewPayload({
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
    const fields = listPolicyAuthoringDraftViewFieldRecords();
    const provenances = listPolicyAuthoringDraftViewProvenanceRecords();

    expect(Object.isFrozen(fields)).toBe(true);
    expect(Object.isFrozen(fields[0])).toBe(true);
    expect(Object.isFrozen(fields[0].allowedCommandIds)).toBe(true);
    expect(Object.isFrozen(provenances)).toBe(true);
    expect(Object.isFrozen(provenances[0])).toBe(true);
  });

  test('returns null and empty lists for unknown lookup values', () => {
    expect(getPolicyAuthoringDraftViewFieldRecord('unknown')).toBeNull();
    expect(getPolicyAuthoringDraftViewProvenanceRecord('unknown')).toBeNull();
    expect(listPolicyAuthoringDraftViewFieldsByCategory('unknown')).toEqual([]);
  });
});
