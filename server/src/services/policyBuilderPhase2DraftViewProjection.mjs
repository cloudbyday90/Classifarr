import {
  POLICY_AUTHORING_DRAFT_COMMAND_IDS,
  isPolicyAuthoringDraftCommandAllowed,
} from './policyAuthoringDraftCommandBoundary.mjs';
import {
  PHASE_2R_DRAFT_AUTHORITY_IDS,
  PHASE_2R_DRAFT_FIELD_IDS,
} from './policyBuilderPhase2DraftContract.mjs';

const PHASE_2R_DRAFT_VIEW_FIELD_IDS = Object.freeze({
  CONFIGURED_INTENT_CHIPS: 'configured_intent_chips',
  CANDIDATE_OPTIONS: 'candidate_options',
  PROVENANCE_LABELS: 'provenance_labels',
  SECTION_SUMMARIES: 'section_summaries',
  WARNINGS: 'warnings',
  READINESS_PLACEHOLDER: 'readiness_placeholder',
  OBSERVED_EVIDENCE_PLACEHOLDER: 'observed_evidence_placeholder',
  COMPATIBILITY_VALUES: 'compatibility_values',
});

const PHASE_2R_DRAFT_VIEW_CATEGORY_IDS = Object.freeze({
  PRODUCT_VIEW_MODEL: 'product_view_model',
  PRODUCT_COMMAND_HINT: 'product_command_hint',
  READ_ONLY_SERVER_PLACEHOLDER: 'read_only_server_placeholder',
  COMPATIBILITY_ADAPTER_VIEW: 'compatibility_adapter_view',
});

const PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS = Object.freeze({
  OPERATOR_EDIT: 'operator_edit',
  STARTER_TEMPLATE: 'starter_template',
  COMPATIBILITY_FALLBACK: 'compatibility_fallback',
  OBSERVED_EVIDENCE_SUGGESTION: 'observed_evidence_suggestion',
  SERVER_PROJECTION: 'server_projection',
});

const PHASE_2R_DRAFT_VIEW_RISK_IDS = Object.freeze({
  RAW_LEGACY_STORAGE_EXPOSURE: 'raw_legacy_storage_exposure',
  READ_ONLY_PROJECTION_MUTATION: 'read_only_projection_mutation',
  PRESENTATION_POLICY_COUPLING: 'presentation_policy_coupling',
  SAVE_SEMANTICS_LEAK: 'save_semantics_leak',
});

const PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_FIELD: 'unknown_field',
  UNKNOWN_CATEGORY: 'unknown_category',
  UNKNOWN_AUTHORITY: 'unknown_authority',
  UNKNOWN_SOURCE_DRAFT_FIELD: 'unknown_source_draft_field',
  UNKNOWN_COMMAND_HINT: 'unknown_command_hint',
  RAW_LEGACY_STORAGE_EXPOSURE: 'raw_legacy_storage_exposure',
  VIEW_FIELD_MUTATES_DRAFT: 'view_field_mutates_draft',
  VIEW_FIELD_SERIALIZES_SAVE_PAYLOAD: 'view_field_serializes_save_payload',
  READ_ONLY_PLACEHOLDER_NOT_SERVER_PROJECTION: 'read_only_placeholder_not_server_projection',
  COMPATIBILITY_ADAPTER_WITH_COMMAND_HINTS: 'compatibility_adapter_with_command_hints',
  UNKNOWN_PROVENANCE: 'unknown_provenance',
  NON_PRODUCT_FACING_PROVENANCE: 'non_product_facing_provenance',
  PROVENANCE_ALIAS_COLLISION: 'provenance_alias_collision',
  RAW_LEGACY_TERM_IN_VIEW_LABEL: 'raw_legacy_term_in_view_label',
});

const RAW_LEGACY_VIEW_KEYS = Object.freeze([
  'customSignals',
  'custom_signals',
  'legacyCustomSignals',
  'legacy_custom_signals',
  'rawCustomSignals',
  'raw_custom_signals',
]);

const RAW_LEGACY_VIEW_TERM_PATTERNS = Object.freeze([
  /customSignals/i,
  /custom_signals/i,
  /legacy payload/i,
  /raw legacy/i,
  /preset_id/i,
  /presetId/i,
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach(item => {
    deepFreeze(item);
  });

  return value;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(asObject(value), key);
}

const PHASE_2R_DRAFT_VIEW_FIELD_RECORDS = deepFreeze([
  {
    id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.CONFIGURED_INTENT_CHIPS,
    label: 'Configured Intent Chips',
    categoryId: PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_VIEW_MODEL,
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    sourceDraftFieldIds: [
      PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE,
      PHASE_2R_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
      PHASE_2R_DRAFT_FIELD_IDS.HARD_LIMITS,
      PHASE_2R_DRAFT_FIELD_IDS.AVOID,
    ],
    mayExposeRawLegacyStorage: false,
    mayMutateDraft: false,
    maySerializeSavePayload: false,
    allowedCommandIds: [
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
    ],
  },
  {
    id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.CANDIDATE_OPTIONS,
    label: 'Candidate Options',
    categoryId: PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_COMMAND_HINT,
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.UI_ONLY_TRANSIENT_STATE,
    sourceDraftFieldIds: [],
    mayExposeRawLegacyStorage: false,
    mayMutateDraft: false,
    maySerializeSavePayload: false,
    allowedCommandIds: [
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
    ],
  },
  {
    id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.PROVENANCE_LABELS,
    label: 'Provenance Labels',
    categoryId: PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_VIEW_MODEL,
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.INFERRED_COMPATIBILITY_PROJECTION,
    sourceDraftFieldIds: [
      PHASE_2R_DRAFT_FIELD_IDS.SOURCE_METADATA,
      PHASE_2R_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA,
    ],
    mayExposeRawLegacyStorage: false,
    mayMutateDraft: false,
    maySerializeSavePayload: false,
    allowedCommandIds: [],
  },
  {
    id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.SECTION_SUMMARIES,
    label: 'Section Summaries',
    categoryId: PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_VIEW_MODEL,
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.UI_ONLY_TRANSIENT_STATE,
    sourceDraftFieldIds: [],
    mayExposeRawLegacyStorage: false,
    mayMutateDraft: false,
    maySerializeSavePayload: false,
    allowedCommandIds: [],
  },
  {
    id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.WARNINGS,
    label: 'Warnings',
    categoryId: PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.PRODUCT_VIEW_MODEL,
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.INFERRED_COMPATIBILITY_PROJECTION,
    sourceDraftFieldIds: [
      PHASE_2R_DRAFT_FIELD_IDS.WARNINGS,
    ],
    mayExposeRawLegacyStorage: false,
    mayMutateDraft: false,
    maySerializeSavePayload: false,
    allowedCommandIds: [
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
    ],
  },
  {
    id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.READINESS_PLACEHOLDER,
    label: 'Readiness Placeholder',
    categoryId: PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.READ_ONLY_SERVER_PLACEHOLDER,
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
    sourceDraftFieldIds: [
      PHASE_2R_DRAFT_FIELD_IDS.READINESS_PROJECTION,
    ],
    mayExposeRawLegacyStorage: false,
    mayMutateDraft: false,
    maySerializeSavePayload: false,
    allowedCommandIds: [],
  },
  {
    id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.OBSERVED_EVIDENCE_PLACEHOLDER,
    label: 'Observed Evidence Placeholder',
    categoryId: PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.READ_ONLY_SERVER_PLACEHOLDER,
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
    sourceDraftFieldIds: [
      PHASE_2R_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
    ],
    mayExposeRawLegacyStorage: false,
    mayMutateDraft: false,
    maySerializeSavePayload: false,
    allowedCommandIds: [],
  },
  {
    id: PHASE_2R_DRAFT_VIEW_FIELD_IDS.COMPATIBILITY_VALUES,
    label: 'Compatibility Values',
    categoryId: PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.COMPATIBILITY_ADAPTER_VIEW,
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.LEGACY_BRIDGE_METADATA,
    sourceDraftFieldIds: [
      PHASE_2R_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA,
    ],
    mayExposeRawLegacyStorage: false,
    mayMutateDraft: false,
    maySerializeSavePayload: false,
    allowedCommandIds: [],
  },
]);

const PHASE_2R_DRAFT_VIEW_PROVENANCE_RECORDS = deepFreeze([
  {
    id: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.OPERATOR_EDIT,
    label: 'Intent edit',
    help: 'Added or changed in the intent-first policy builder.',
    rawSourceAliases: ['intent_draft'],
    productFacing: true,
  },
  {
    id: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.STARTER_TEMPLATE,
    label: 'Starter template',
    help: 'Inherited from the selected starter template.',
    rawSourceAliases: ['legacy_preset'],
    productFacing: true,
  },
  {
    id: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.COMPATIBILITY_FALLBACK,
    label: 'Policy override',
    help: 'Imported from existing policy-specific compatibility data.',
    rawSourceAliases: ['legacy_custom_signals', 'compatibility_fallback'],
    productFacing: true,
  },
  {
    id: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.OBSERVED_EVIDENCE_SUGGESTION,
    label: 'Observed suggestion',
    help: 'Suggested from media-server evidence and not saved until an operator applies it.',
    rawSourceAliases: ['observed_evidence_suggestion'],
    productFacing: true,
  },
  {
    id: PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.SERVER_PROJECTION,
    label: 'Server projection',
    help: 'Read-only server projection; it is not draft intent by itself.',
    rawSourceAliases: ['server_projection'],
    productFacing: true,
  },
]);

function listPhase2RDraftViewFieldRecords() {
  return PHASE_2R_DRAFT_VIEW_FIELD_RECORDS;
}

function getPhase2RDraftViewFieldRecord(fieldId) {
  return PHASE_2R_DRAFT_VIEW_FIELD_RECORDS.find(record => record.id === fieldId) || null;
}

function listPhase2RDraftViewFieldsByCategory(categoryId) {
  return PHASE_2R_DRAFT_VIEW_FIELD_RECORDS.filter(record => record.categoryId === categoryId);
}

function listPhase2RDraftViewProvenanceRecords() {
  return PHASE_2R_DRAFT_VIEW_PROVENANCE_RECORDS;
}

function getPhase2RDraftViewProvenanceRecord(provenanceId) {
  return PHASE_2R_DRAFT_VIEW_PROVENANCE_RECORDS.find(record => record.id === provenanceId) || null;
}

function resolvePhase2RDraftViewProvenance(rawSource) {
  const normalizedSource = typeof rawSource === 'string' ? rawSource.trim() : '';
  return PHASE_2R_DRAFT_VIEW_PROVENANCE_RECORDS.find(record => (
    record.rawSourceAliases.includes(normalizedSource)
  )) || getPhase2RDraftViewProvenanceRecord(PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS.STARTER_TEMPLATE);
}

function validatePhase2RDraftViewField(fieldId) {
  const record = getPhase2RDraftViewFieldRecord(fieldId);
  if (!record) {
    return {
      valid: false,
      riskId: PHASE_2R_DRAFT_VIEW_RISK_IDS.PRESENTATION_POLICY_COUPLING,
      reason: 'Unknown draft view field.',
    };
  }

  if (record.mayExposeRawLegacyStorage) {
    return {
      valid: false,
      riskId: PHASE_2R_DRAFT_VIEW_RISK_IDS.RAW_LEGACY_STORAGE_EXPOSURE,
      reason: 'Draft view fields cannot expose raw legacy storage.',
    };
  }

  if (record.mayMutateDraft) {
    return {
      valid: false,
      riskId: PHASE_2R_DRAFT_VIEW_RISK_IDS.READ_ONLY_PROJECTION_MUTATION,
      reason: 'Draft view fields are read models and cannot mutate draft state.',
    };
  }

  if (record.maySerializeSavePayload) {
    return {
      valid: false,
      riskId: PHASE_2R_DRAFT_VIEW_RISK_IDS.SAVE_SEMANTICS_LEAK,
      reason: 'Draft view fields cannot own save serialization.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Draft view field stays within the Phase 2R projection boundary.',
  };
}

function hasRawLegacyViewTerm(record) {
  const text = [
    record?.id,
    record?.label,
  ].filter(Boolean).join(' ');

  return RAW_LEGACY_VIEW_TERM_PATTERNS.some(pattern => pattern.test(text));
}

function validatePhase2RDraftViewFieldRecord(record) {
  if (!record || typeof record !== 'object') {
    return {
      valid: false,
      fieldId: null,
      issues: [
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_FIELD,
          reason: 'Draft view field record is missing or invalid.',
        },
      ],
    };
  }

  const issues = [];

  if (!Object.values(PHASE_2R_DRAFT_VIEW_FIELD_IDS).includes(record.id)) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_FIELD,
      reason: 'Draft view field is not in the Phase 2R view vocabulary.',
    });
  }

  if (!Object.values(PHASE_2R_DRAFT_VIEW_CATEGORY_IDS).includes(record.categoryId)) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_CATEGORY,
      reason: 'Draft view field has no recognized category.',
    });
  }

  if (!Object.values(PHASE_2R_DRAFT_AUTHORITY_IDS).includes(record.authorityId)) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_AUTHORITY,
      reason: 'Draft view field has no recognized authority.',
    });
  }

  const unknownSourceFieldIds = (Array.isArray(record.sourceDraftFieldIds) ? record.sourceDraftFieldIds : [])
    .filter(fieldId => !Object.values(PHASE_2R_DRAFT_FIELD_IDS).includes(fieldId));

  if (unknownSourceFieldIds.length > 0) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_SOURCE_DRAFT_FIELD,
      reason: 'Draft view field references an unknown source draft field.',
    });
  }

  const unknownCommandIds = (Array.isArray(record.allowedCommandIds) ? record.allowedCommandIds : [])
    .filter(commandId => !isPolicyAuthoringDraftCommandAllowed(commandId));

  if (unknownCommandIds.length > 0) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_COMMAND_HINT,
      reason: 'Draft view field exposes a command hint that is not allowed by the command boundary.',
    });
  }

  if (record.mayExposeRawLegacyStorage) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.RAW_LEGACY_STORAGE_EXPOSURE,
      reason: 'Draft view fields cannot expose raw legacy storage.',
    });
  }

  if (record.mayMutateDraft) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.VIEW_FIELD_MUTATES_DRAFT,
      reason: 'Draft view fields are read models and cannot mutate draft state.',
    });
  }

  if (record.maySerializeSavePayload) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.VIEW_FIELD_SERIALIZES_SAVE_PAYLOAD,
      reason: 'Draft view fields cannot own save serialization.',
    });
  }

  if (
    record.categoryId === PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.READ_ONLY_SERVER_PLACEHOLDER
    && record.authorityId !== PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION
  ) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.READ_ONLY_PLACEHOLDER_NOT_SERVER_PROJECTION,
      reason: 'Read-only server placeholders must use server read-only projection authority.',
    });
  }

  if (
    record.categoryId === PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.COMPATIBILITY_ADAPTER_VIEW
    && Array.isArray(record.allowedCommandIds)
    && record.allowedCommandIds.length > 0
  ) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.COMPATIBILITY_ADAPTER_WITH_COMMAND_HINTS,
      reason: 'Compatibility adapter view fields cannot expose command hints to product components.',
    });
  }

  if (hasRawLegacyViewTerm(record)) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.RAW_LEGACY_TERM_IN_VIEW_LABEL,
      reason: 'Draft view field labels must not expose raw legacy storage terminology.',
    });
  }

  return {
    valid: issues.length === 0,
    fieldId: record.id || null,
    issues,
  };
}

function validatePhase2RDraftViewProvenanceRecord(record) {
  if (!record || typeof record !== 'object') {
    return {
      valid: false,
      provenanceId: null,
      issues: [
        {
          riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_PROVENANCE,
          reason: 'Draft view provenance record is missing or invalid.',
        },
      ],
    };
  }

  const issues = [];

  if (!Object.values(PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS).includes(record.id)) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_PROVENANCE,
      reason: 'Draft view provenance is not in the Phase 2R provenance vocabulary.',
    });
  }

  if (record.productFacing !== true) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.NON_PRODUCT_FACING_PROVENANCE,
      reason: 'Draft view provenance labels must be product-facing.',
    });
  }

  if (!Array.isArray(record.rawSourceAliases) || record.rawSourceAliases.length === 0) {
    issues.push({
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_PROVENANCE,
      reason: 'Draft view provenance records must declare at least one source alias.',
    });
  }

  return {
    valid: issues.length === 0,
    provenanceId: record.id || null,
    issues,
  };
}

function validatePhase2RDraftViewPayload(payload = {}) {
  const value = asObject(payload);
  const rawLegacyKeys = RAW_LEGACY_VIEW_KEYS.filter(key => hasOwn(value, key));

  if (rawLegacyKeys.length > 0) {
    return {
      valid: false,
      riskId: PHASE_2R_DRAFT_VIEW_RISK_IDS.RAW_LEGACY_STORAGE_EXPOSURE,
      reason: 'Draft view payloads cannot expose raw legacy storage keys.',
      invalidKeys: rawLegacyKeys,
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Draft view payload contains no raw legacy storage keys.',
    invalidKeys: [],
  };
}

function summarizePhase2RDraftViewProjection() {
  const countsByCategory = PHASE_2R_DRAFT_VIEW_FIELD_RECORDS.reduce((counts, record) => {
    counts[record.categoryId] = (counts[record.categoryId] || 0) + 1;
    return counts;
  }, {});

  return {
    fieldCount: PHASE_2R_DRAFT_VIEW_FIELD_RECORDS.length,
    provenanceCount: PHASE_2R_DRAFT_VIEW_PROVENANCE_RECORDS.length,
    countsByCategory,
    readOnlyPlaceholderFieldIds: PHASE_2R_DRAFT_VIEW_FIELD_RECORDS
      .filter(record => record.categoryId === PHASE_2R_DRAFT_VIEW_CATEGORY_IDS.READ_ONLY_SERVER_PLACEHOLDER)
      .map(record => record.id),
    rawLegacyStorageExposureAllowed: false,
    draftMutationAllowed: false,
    saveSerializationAllowed: false,
  };
}

function buildPhase2RDraftViewProjectionAudit({
  fieldRecords = PHASE_2R_DRAFT_VIEW_FIELD_RECORDS,
  provenanceRecords = PHASE_2R_DRAFT_VIEW_PROVENANCE_RECORDS,
} = {}) {
  const fieldResults = fieldRecords.map(validatePhase2RDraftViewFieldRecord);
  const provenanceResults = provenanceRecords.map(validatePhase2RDraftViewProvenanceRecord);
  const fieldIds = fieldRecords.map(record => record?.id).filter(Boolean);
  const provenanceIds = provenanceRecords.map(record => record?.id).filter(Boolean);
  const missingFieldIds = Object.values(PHASE_2R_DRAFT_VIEW_FIELD_IDS)
    .filter(fieldId => !fieldIds.includes(fieldId));
  const duplicateFieldIds = fieldIds
    .filter((fieldId, index) => fieldIds.indexOf(fieldId) !== index)
    .filter((fieldId, index, allIds) => allIds.indexOf(fieldId) === index);
  const missingProvenanceIds = Object.values(PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS)
    .filter(provenanceId => !provenanceIds.includes(provenanceId));
  const duplicateProvenanceIds = provenanceIds
    .filter((provenanceId, index) => provenanceIds.indexOf(provenanceId) !== index)
    .filter((provenanceId, index, allIds) => allIds.indexOf(provenanceId) === index);
  const aliasOwners = new Map();
  const aliasCollisions = [];

  provenanceRecords.forEach(record => {
    (Array.isArray(record?.rawSourceAliases) ? record.rawSourceAliases : []).forEach(alias => {
      if (aliasOwners.has(alias)) {
        aliasCollisions.push({
          alias,
          firstProvenanceId: aliasOwners.get(alias),
          secondProvenanceId: record.id,
        });
      } else {
        aliasOwners.set(alias, record.id);
      }
    });
  });

  const issues = [
    ...fieldResults.flatMap(result => result.issues.map(issue => ({
      fieldId: result.fieldId,
      ...issue,
    }))),
    ...provenanceResults.flatMap(result => result.issues.map(issue => ({
      provenanceId: result.provenanceId,
      ...issue,
    }))),
    ...missingFieldIds.map(fieldId => ({
      fieldId,
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_FIELD,
      reason: 'Required Phase 2R draft view field is missing.',
    })),
    ...duplicateFieldIds.map(fieldId => ({
      fieldId,
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_FIELD,
      reason: 'Draft view field appears more than once.',
    })),
    ...missingProvenanceIds.map(provenanceId => ({
      provenanceId,
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_PROVENANCE,
      reason: 'Required Phase 2R draft view provenance is missing.',
    })),
    ...duplicateProvenanceIds.map(provenanceId => ({
      provenanceId,
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.UNKNOWN_PROVENANCE,
      reason: 'Draft view provenance appears more than once.',
    })),
    ...aliasCollisions.map(collision => ({
      provenanceId: collision.secondProvenanceId,
      riskId: PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS.PROVENANCE_ALIAS_COLLISION,
      reason: `Draft view provenance alias is claimed by multiple records: ${collision.alias}.`,
    })),
  ];

  return {
    ok: issues.length === 0,
    checkedFieldCount: fieldRecords.length,
    requiredFieldCount: Object.values(PHASE_2R_DRAFT_VIEW_FIELD_IDS).length,
    checkedProvenanceCount: provenanceRecords.length,
    requiredProvenanceCount: Object.values(PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS).length,
    fieldResults,
    provenanceResults,
    missingFieldIds,
    duplicateFieldIds,
    missingProvenanceIds,
    duplicateProvenanceIds,
    aliasCollisions,
    issues,
  };
}

export {
  PHASE_2R_DRAFT_VIEW_AUDIT_RISK_IDS,
  PHASE_2R_DRAFT_VIEW_CATEGORY_IDS,
  PHASE_2R_DRAFT_VIEW_FIELD_IDS,
  PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS,
  PHASE_2R_DRAFT_VIEW_RISK_IDS,
  getPhase2RDraftViewFieldRecord,
  getPhase2RDraftViewProvenanceRecord,
  buildPhase2RDraftViewProjectionAudit,
  listPhase2RDraftViewFieldRecords,
  listPhase2RDraftViewFieldsByCategory,
  listPhase2RDraftViewProvenanceRecords,
  resolvePhase2RDraftViewProvenance,
  summarizePhase2RDraftViewProjection,
  validatePhase2RDraftViewField,
  validatePhase2RDraftViewFieldRecord,
  validatePhase2RDraftViewPayload,
  validatePhase2RDraftViewProvenanceRecord,
};
