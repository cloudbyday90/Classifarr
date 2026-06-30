import {
  AUTHORITY_LEVELS,
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
import {
  POLICY_UX_TERM_IDS,
} from './policyUserMentalModel.mjs';

const PHASE_2R_DRAFT_FIELD_IDS = Object.freeze({
  BELONGS_HERE: 'belongs_here',
  HELPFUL_MATCHES: 'helpful_matches',
  HARD_LIMITS: 'hard_limits',
  AVOID: 'avoid',
  ASK_WHEN: 'ask_when',
  ROUTING_TARGET: 'routing_target',
  ASSUMPTIONS: 'assumptions',
  WARNINGS: 'warnings',
  SOURCE_METADATA: 'source_metadata',
  UI_STATE: 'ui_state',
  EVIDENCE_PROJECTION: 'evidence_projection',
  READINESS_PROJECTION: 'readiness_projection',
  LEGACY_BRIDGE_METADATA: 'legacy_bridge_metadata',
});

const PHASE_2R_DRAFT_AUTHORITY_IDS = Object.freeze({
  OPERATOR_DECLARED_INTENT: 'operator_declared_intent',
  INFERRED_COMPATIBILITY_PROJECTION: 'inferred_compatibility_projection',
  UI_ONLY_TRANSIENT_STATE: 'ui_only_transient_state',
  SERVER_READ_ONLY_PROJECTION: 'server_read_only_projection',
  LEGACY_BRIDGE_METADATA: 'legacy_bridge_metadata',
});

const PHASE_2R_NATIVE_MAPPING_IDS = Object.freeze({
  NATIVE_INTENT_CANDIDATE: 'native_intent_candidate',
  NATIVE_REVIEW_CANDIDATE: 'native_review_candidate',
  NATIVE_ROUTING_CANDIDATE: 'native_routing_candidate',
  COMPATIBILITY_ONLY: 'compatibility_only',
  READ_ONLY_PROJECTION_ONLY: 'read_only_projection_only',
  UI_ONLY: 'ui_only',
});

const PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS = Object.freeze({
  OBSERVED_EVIDENCE_GENERATION: 'observed_evidence_generation',
  LEARNING_DECISIONS: 'learning_decisions',
  PROVIDER_READINESS_DECISIONS: 'provider_readiness_decisions',
  ROUTING_SIDE_EFFECTS: 'routing_side_effects',
  MIGRATION_ACCEPTANCE: 'migration_acceptance',
});

const PHASE_2R_DRAFT_RISK_IDS = Object.freeze({
  DURABLE_AUTHORITY_CONFUSION: 'durable_authority_confusion',
  EVIDENCE_ENGINE_LEAK: 'evidence_engine_leak',
  LEARNING_SIDE_EFFECT: 'learning_side_effect',
  ROUTING_SIDE_EFFECT: 'routing_side_effect',
  LEGACY_STORAGE_SHAPE_LEAK: 'legacy_storage_shape_leak',
  UI_STATE_SERIALIZATION: 'ui_state_serialization',
});

const PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_FIELD: 'unknown_field',
  MISSING_AUTHORITY: 'missing_authority',
  MISSING_NATIVE_MAPPING: 'missing_native_mapping',
  NATIVE_FIELD_NOT_DECLARED_INTENT: 'native_field_not_declared_intent',
  COMPATIBILITY_FIELD_PERSISTS_NATIVE: 'compatibility_field_persists_native',
  UI_FIELD_SERIALIZES: 'ui_field_serializes',
  READ_ONLY_PROJECTION_SERIALIZES: 'read_only_projection_serializes',
  OBSERVED_EVIDENCE_IN_DECLARED_INTENT: 'observed_evidence_in_declared_intent',
  RAW_LEGACY_TERM_IN_PRODUCT_FIELD: 'raw_legacy_term_in_product_field',
});

const RAW_LEGACY_PRODUCT_TERM_PATTERNS = Object.freeze([
  /customSignals/i,
  /custom_signals/i,
  /preset_id/i,
  /presetId/i,
  /legacy payload/i,
  /raw legacy/i,
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

const PHASE_2R_DRAFT_FIELD_RECORDS = deepFreeze([
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE,
    label: 'Belongs Here',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.BELONGS_HERE,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
    productMeaning: 'Signals the operator accepts as destination identity.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
    label: 'Helpful Matches',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
    productMeaning: 'Soft supporting evidence the operator accepts as helpful but not decisive alone.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.HARD_LIMITS,
    label: 'Hard Limits',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.HARD_LIMITS,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
    productMeaning: 'Explicit operator constraints that can block a destination.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.AVOID,
    label: 'Avoid',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.AVOID,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
    productMeaning: 'Explicit operator warnings that lower confidence without becoming hard limits by default.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.ASK_WHEN,
    label: 'Ask When',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.NATIVE_REVIEW_CANDIDATE,
    productMeaning: 'Operator-declared review triggers for uncertainty, conflict, or missing evidence.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.ROUTING_TARGET,
    label: 'Routing Target',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.ROUTING_TARGET,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.NATIVE_ROUTING_CANDIDATE,
    productMeaning: 'Operator-declared routing target intent without performing Arr writes from draft state.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.ASSUMPTIONS,
    label: 'Assumptions',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.INFERRED_COMPATIBILITY_PROJECTION,
    authorityLevel: AUTHORITY_LEVELS.NON_AUTHORITY,
    authoritySourceId: AUTHORITY_SOURCE_IDS.AI_OUTPUT,
    uxTermId: null,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.COMPATIBILITY_ONLY,
    productMeaning: 'Non-authoritative explanation of inferred or compatibility-projected assumptions.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: true,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.WARNINGS,
    label: 'Warnings',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.INFERRED_COMPATIBILITY_PROJECTION,
    authorityLevel: AUTHORITY_LEVELS.NON_AUTHORITY,
    authoritySourceId: AUTHORITY_SOURCE_IDS.AI_OUTPUT,
    uxTermId: null,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.COMPATIBILITY_ONLY,
    productMeaning: 'Non-authoritative draft warnings that require operator or server validation.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: true,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.SOURCE_METADATA,
    label: 'Source Metadata',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.LEGACY_BRIDGE_METADATA,
    authorityLevel: AUTHORITY_LEVELS.DRAFT_SEED,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    uxTermId: null,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.COMPATIBILITY_ONLY,
    productMeaning: 'Provenance and compatibility metadata for current bridge serialization.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: true,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.UI_STATE,
    label: 'UI State',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.UI_ONLY_TRANSIENT_STATE,
    authorityLevel: AUTHORITY_LEVELS.NON_AUTHORITY,
    authoritySourceId: null,
    uxTermId: null,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.UI_ONLY,
    productMeaning: 'Transient editing state such as expansion, focus, search, and local input buffers.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
    label: 'Evidence Projection',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
    authorityLevel: AUTHORITY_LEVELS.OBSERVED_EVIDENCE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    uxTermId: null,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.READ_ONLY_PROJECTION_ONLY,
    productMeaning: 'Read-only server-provided observed evidence that may suggest edits but is not draft intent.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: true,
    compatibilityOnly: false,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.READINESS_PROJECTION,
    label: 'Readiness Projection',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
    authorityLevel: AUTHORITY_LEVELS.NON_AUTHORITY,
    authoritySourceId: null,
    uxTermId: POLICY_UX_TERM_IDS.READINESS,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.READ_ONLY_PROJECTION_ONLY,
    productMeaning: 'Read-only server readiness state that draft editing can display but not decide.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: PHASE_2R_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA,
    label: 'Legacy Bridge Metadata',
    authorityId: PHASE_2R_DRAFT_AUTHORITY_IDS.LEGACY_BRIDGE_METADATA,
    authorityLevel: AUTHORITY_LEVELS.DRAFT_SEED,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    uxTermId: null,
    nativeMappingId: PHASE_2R_NATIVE_MAPPING_IDS.COMPATIBILITY_ONLY,
    productMeaning: 'Compatibility-only metadata needed to preserve current preset/custom-signal behavior.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: true,
  },
]);

const PHASE_2R_PROHIBITED_RESPONSIBILITIES = deepFreeze([
  {
    id: PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.OBSERVED_EVIDENCE_GENERATION,
    riskId: PHASE_2R_DRAFT_RISK_IDS.EVIDENCE_ENGINE_LEAK,
    reason: 'Observed evidence must come from server-owned evidence/readiness contracts, not draft state.',
  },
  {
    id: PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.LEARNING_DECISIONS,
    riskId: PHASE_2R_DRAFT_RISK_IDS.LEARNING_SIDE_EFFECT,
    reason: 'Draft edits can propose intent; they cannot decide durable learning eligibility.',
  },
  {
    id: PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.PROVIDER_READINESS_DECISIONS,
    riskId: PHASE_2R_DRAFT_RISK_IDS.EVIDENCE_ENGINE_LEAK,
    reason: 'Provider readiness is a server/provider projection, not client draft authority.',
  },
  {
    id: PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.ROUTING_SIDE_EFFECTS,
    riskId: PHASE_2R_DRAFT_RISK_IDS.ROUTING_SIDE_EFFECT,
    reason: 'Draft routing target intent must not execute Arr writes or routing side effects.',
  },
  {
    id: PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS.MIGRATION_ACCEPTANCE,
    riskId: PHASE_2R_DRAFT_RISK_IDS.DURABLE_AUTHORITY_CONFUSION,
    reason: 'Migration acceptance requires server validation and migration gates, not client draft state.',
  },
]);

function listPhase2RDraftFieldRecords() {
  return PHASE_2R_DRAFT_FIELD_RECORDS;
}

function getPhase2RDraftFieldRecord(fieldId) {
  return PHASE_2R_DRAFT_FIELD_RECORDS.find(record => record.id === fieldId) || null;
}

function listPhase2RDraftFieldsByAuthority(authorityId) {
  return PHASE_2R_DRAFT_FIELD_RECORDS.filter(record => record.authorityId === authorityId);
}

function listPhase2RProhibitedDraftResponsibilities() {
  return PHASE_2R_PROHIBITED_RESPONSIBILITIES;
}

function getPhase2RProhibitedDraftResponsibility(responsibilityId) {
  return PHASE_2R_PROHIBITED_RESPONSIBILITIES.find(record => record.id === responsibilityId) || null;
}

function canPhase2RDraftFieldPersistNativeIntent(fieldId) {
  return getPhase2RDraftFieldRecord(fieldId)?.mayPersistNativeIntent === true;
}

function canPhase2RDraftFieldSerializeLegacyBridge(fieldId) {
  return getPhase2RDraftFieldRecord(fieldId)?.maySerializeLegacyBridge === true;
}

function isPhase2RDraftFieldCompatibilityOnly(fieldId) {
  return getPhase2RDraftFieldRecord(fieldId)?.compatibilityOnly === true;
}

function hasRawLegacyProductTerm(record) {
  if (!record || record.authorityId !== PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT) {
    return false;
  }

  const productText = [
    record.id,
    record.label,
    record.productMeaning,
  ].filter(Boolean).join(' ');

  return RAW_LEGACY_PRODUCT_TERM_PATTERNS.some(pattern => pattern.test(productText));
}

function validatePhase2RDraftFieldContract(record) {
  if (!record || typeof record !== 'object') {
    return {
      valid: false,
      fieldId: null,
      issues: [
        {
          riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.UNKNOWN_FIELD,
          reason: 'Draft field record is missing or invalid.',
        },
      ],
    };
  }

  const issues = [];

  if (!Object.values(PHASE_2R_DRAFT_FIELD_IDS).includes(record.id)) {
    issues.push({
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.UNKNOWN_FIELD,
      reason: 'Draft field is not in the Phase 2R field vocabulary.',
    });
  }

  if (!Object.values(PHASE_2R_DRAFT_AUTHORITY_IDS).includes(record.authorityId)) {
    issues.push({
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.MISSING_AUTHORITY,
      reason: 'Draft field has no recognized authority classification.',
    });
  }

  if (!Object.values(PHASE_2R_NATIVE_MAPPING_IDS).includes(record.nativeMappingId)) {
    issues.push({
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.MISSING_NATIVE_MAPPING,
      reason: 'Draft field has no recognized native mapping classification.',
    });
  }

  if (
    record.mayPersistNativeIntent
    && record.authorityId !== PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT
  ) {
    issues.push({
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.NATIVE_FIELD_NOT_DECLARED_INTENT,
      reason: 'Only operator-declared intent fields may be native intent candidates.',
    });
  }

  if (record.compatibilityOnly && record.mayPersistNativeIntent) {
    issues.push({
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.COMPATIBILITY_FIELD_PERSISTS_NATIVE,
      reason: 'Compatibility-only draft fields cannot persist as native intent.',
    });
  }

  if (
    record.authorityId === PHASE_2R_DRAFT_AUTHORITY_IDS.UI_ONLY_TRANSIENT_STATE
    && (record.mayPersistNativeIntent || record.maySerializeLegacyBridge)
  ) {
    issues.push({
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.UI_FIELD_SERIALIZES,
      reason: 'UI-only transient state cannot serialize through native intent or the legacy bridge.',
    });
  }

  if (
    record.authorityId === PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION
    && (record.mayPersistNativeIntent || record.maySerializeLegacyBridge)
  ) {
    issues.push({
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.READ_ONLY_PROJECTION_SERIALIZES,
      reason: 'Server read-only projections cannot serialize as draft edits.',
    });
  }

  if (
    record.authorityId === PHASE_2R_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT
    && record.mayContainObservedEvidence
  ) {
    issues.push({
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.OBSERVED_EVIDENCE_IN_DECLARED_INTENT,
      reason: 'Operator-declared intent fields cannot own observed evidence.',
    });
  }

  if (hasRawLegacyProductTerm(record)) {
    issues.push({
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.RAW_LEGACY_TERM_IN_PRODUCT_FIELD,
      reason: 'Operator-facing draft fields must be readable without raw legacy storage terminology.',
    });
  }

  return {
    valid: issues.length === 0,
    fieldId: record.id || null,
    issues,
  };
}

function validatePhase2RDraftFieldOwnership(fieldId, proposedAuthorityId) {
  const record = getPhase2RDraftFieldRecord(fieldId);

  if (!record) {
    return {
      valid: false,
      riskId: PHASE_2R_DRAFT_RISK_IDS.DURABLE_AUTHORITY_CONFUSION,
      reason: 'Unknown draft field.',
    };
  }

  if (record.authorityId !== proposedAuthorityId) {
    return {
      valid: false,
      riskId: PHASE_2R_DRAFT_RISK_IDS.DURABLE_AUTHORITY_CONFUSION,
      reason: 'Draft field authority does not match the Phase 2R contract.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Draft field authority matches the Phase 2R contract.',
  };
}

function evaluatePhase2RDraftResponsibilitySet(responsibilityIds = []) {
  const normalizedIds = Array.isArray(responsibilityIds) ? responsibilityIds : [];
  const prohibitedIds = normalizedIds.filter(responsibilityId => (
    Boolean(getPhase2RProhibitedDraftResponsibility(responsibilityId))
  ));
  const unknownIds = normalizedIds.filter(responsibilityId => (
    !Object.values(PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS).includes(responsibilityId)
  ));

  return {
    valid: prohibitedIds.length === 0 && unknownIds.length === 0,
    prohibitedIds,
    unknownIds,
  };
}

function summarizePhase2RDraftContract() {
  const countsByAuthority = PHASE_2R_DRAFT_FIELD_RECORDS.reduce((counts, record) => {
    counts[record.authorityId] = (counts[record.authorityId] || 0) + 1;
    return counts;
  }, {});

  return {
    draftIsDurableAuthority: false,
    serverValidationRequired: true,
    rawLegacyStorageTermsRequired: false,
    fieldCount: PHASE_2R_DRAFT_FIELD_RECORDS.length,
    countsByAuthority,
    nativeIntentCandidateFieldIds: PHASE_2R_DRAFT_FIELD_RECORDS
      .filter(record => record.mayPersistNativeIntent)
      .map(record => record.id),
    compatibilityOnlyFieldIds: PHASE_2R_DRAFT_FIELD_RECORDS
      .filter(record => record.compatibilityOnly)
      .map(record => record.id),
    readOnlyProjectionFieldIds: PHASE_2R_DRAFT_FIELD_RECORDS
      .filter(record => record.authorityId === PHASE_2R_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION)
      .map(record => record.id),
    prohibitedResponsibilityIds: PHASE_2R_PROHIBITED_RESPONSIBILITIES.map(record => record.id),
  };
}

function buildPhase2RDraftContractAudit({ fieldRecords = PHASE_2R_DRAFT_FIELD_RECORDS } = {}) {
  const fieldResults = fieldRecords.map(validatePhase2RDraftFieldContract);
  const knownFieldIds = fieldRecords.map(record => record?.id).filter(Boolean);
  const missingFieldIds = Object.values(PHASE_2R_DRAFT_FIELD_IDS)
    .filter(fieldId => !knownFieldIds.includes(fieldId));
  const duplicateFieldIds = knownFieldIds
    .filter((fieldId, index) => knownFieldIds.indexOf(fieldId) !== index)
    .filter((fieldId, index, allIds) => allIds.indexOf(fieldId) === index);
  const issues = [
    ...fieldResults.flatMap(result => result.issues.map(issue => ({
      fieldId: result.fieldId,
      ...issue,
    }))),
    ...missingFieldIds.map(fieldId => ({
      fieldId,
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.UNKNOWN_FIELD,
      reason: 'Required Phase 2R draft field is missing from the contract.',
    })),
    ...duplicateFieldIds.map(fieldId => ({
      fieldId,
      riskId: PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS.UNKNOWN_FIELD,
      reason: 'Draft field appears more than once in the contract.',
    })),
  ];

  return {
    ok: issues.length === 0,
    checkedFieldCount: fieldRecords.length,
    requiredFieldCount: Object.values(PHASE_2R_DRAFT_FIELD_IDS).length,
    fieldResults,
    missingFieldIds,
    duplicateFieldIds,
    issues,
  };
}

export {
  PHASE_2R_DRAFT_AUTHORITY_IDS,
  PHASE_2R_DRAFT_CONTRACT_AUDIT_RISK_IDS,
  PHASE_2R_DRAFT_FIELD_IDS,
  PHASE_2R_DRAFT_PROHIBITED_AUTHORITY_IDS,
  PHASE_2R_DRAFT_RISK_IDS,
  PHASE_2R_NATIVE_MAPPING_IDS,
  buildPhase2RDraftContractAudit,
  canPhase2RDraftFieldPersistNativeIntent,
  canPhase2RDraftFieldSerializeLegacyBridge,
  evaluatePhase2RDraftResponsibilitySet,
  getPhase2RDraftFieldRecord,
  getPhase2RProhibitedDraftResponsibility,
  isPhase2RDraftFieldCompatibilityOnly,
  listPhase2RDraftFieldRecords,
  listPhase2RDraftFieldsByAuthority,
  listPhase2RProhibitedDraftResponsibilities,
  summarizePhase2RDraftContract,
  validatePhase2RDraftFieldContract,
  validatePhase2RDraftFieldOwnership,
};
