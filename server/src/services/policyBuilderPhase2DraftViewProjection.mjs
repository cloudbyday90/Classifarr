import {
  PHASE_2R_DRAFT_COMMAND_IDS,
} from './policyBuilderPhase2DraftCommandBoundary.mjs';
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

const RAW_LEGACY_VIEW_KEYS = Object.freeze([
  'customSignals',
  'custom_signals',
  'legacyCustomSignals',
  'legacy_custom_signals',
  'rawCustomSignals',
  'raw_custom_signals',
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
      PHASE_2R_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
      PHASE_2R_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
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
      PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
      PHASE_2R_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
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
      PHASE_2R_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
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

export {
  PHASE_2R_DRAFT_VIEW_CATEGORY_IDS,
  PHASE_2R_DRAFT_VIEW_FIELD_IDS,
  PHASE_2R_DRAFT_VIEW_PROVENANCE_IDS,
  PHASE_2R_DRAFT_VIEW_RISK_IDS,
  getPhase2RDraftViewFieldRecord,
  getPhase2RDraftViewProvenanceRecord,
  listPhase2RDraftViewFieldRecords,
  listPhase2RDraftViewFieldsByCategory,
  listPhase2RDraftViewProvenanceRecords,
  resolvePhase2RDraftViewProvenance,
  summarizePhase2RDraftViewProjection,
  validatePhase2RDraftViewField,
  validatePhase2RDraftViewPayload,
};
