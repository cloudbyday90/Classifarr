import {
  AUTHORITY_LEVELS,
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
import {
  POLICY_UX_TERM_IDS,
} from './policyUserMentalModel.mjs';

const POLICY_AUTHORING_DRAFT_FIELD_IDS = Object.freeze({
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

const POLICY_AUTHORING_DRAFT_AUTHORITY_IDS = Object.freeze({
  OPERATOR_DECLARED_INTENT: 'operator_declared_intent',
  INFERRED_COMPATIBILITY_PROJECTION: 'inferred_compatibility_projection',
  UI_ONLY_TRANSIENT_STATE: 'ui_only_transient_state',
  SERVER_READ_ONLY_PROJECTION: 'server_read_only_projection',
  LEGACY_BRIDGE_METADATA: 'legacy_bridge_metadata',
});

const POLICY_AUTHORING_NATIVE_MAPPING_IDS = Object.freeze({
  NATIVE_INTENT_CANDIDATE: 'native_intent_candidate',
  NATIVE_REVIEW_CANDIDATE: 'native_review_candidate',
  NATIVE_ROUTING_CANDIDATE: 'native_routing_candidate',
  COMPATIBILITY_ONLY: 'compatibility_only',
  READ_ONLY_PROJECTION_ONLY: 'read_only_projection_only',
  UI_ONLY: 'ui_only',
});

const POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS = Object.freeze({
  OBSERVED_EVIDENCE_GENERATION: 'observed_evidence_generation',
  LEARNING_DECISIONS: 'learning_decisions',
  PROVIDER_READINESS_DECISIONS: 'provider_readiness_decisions',
  ROUTING_SIDE_EFFECTS: 'routing_side_effects',
  MIGRATION_ACCEPTANCE: 'migration_acceptance',
});

const POLICY_AUTHORING_DRAFT_RISK_IDS = Object.freeze({
  DURABLE_AUTHORITY_CONFUSION: 'durable_authority_confusion',
  EVIDENCE_ENGINE_LEAK: 'evidence_engine_leak',
  LEARNING_SIDE_EFFECT: 'learning_side_effect',
  ROUTING_SIDE_EFFECT: 'routing_side_effect',
  LEGACY_STORAGE_SHAPE_LEAK: 'legacy_storage_shape_leak',
  UI_STATE_SERIALIZATION: 'ui_state_serialization',
});

const POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS = Object.freeze({
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

const POLICY_AUTHORING_DRAFT_FIELD_RECORDS = deepFreeze([
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.BELONGS_HERE,
    label: 'Belongs Here',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.BELONGS_HERE,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
    productMeaning: 'Signals the operator accepts as destination identity.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
    label: 'Helpful Matches',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
    productMeaning: 'Soft supporting evidence the operator accepts as helpful but not decisive alone.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.HARD_LIMITS,
    label: 'Hard Limits',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.HARD_LIMITS,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
    productMeaning: 'Explicit operator constraints that can block a destination.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.AVOID,
    label: 'Avoid',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.AVOID,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.NATIVE_INTENT_CANDIDATE,
    productMeaning: 'Explicit operator warnings that lower confidence without becoming hard limits by default.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.ASK_WHEN,
    label: 'Ask When',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.NATIVE_REVIEW_CANDIDATE,
    productMeaning: 'Operator-declared review triggers for uncertainty, conflict, or missing evidence.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.ROUTING_TARGET,
    label: 'Routing Target',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT,
    authorityLevel: AUTHORITY_LEVELS.DECLARED_INTENT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    uxTermId: POLICY_UX_TERM_IDS.ROUTING_TARGET,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.NATIVE_ROUTING_CANDIDATE,
    productMeaning: 'Operator-declared routing target intent without performing Arr writes from draft state.',
    mayPersistNativeIntent: true,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.ASSUMPTIONS,
    label: 'Assumptions',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.INFERRED_COMPATIBILITY_PROJECTION,
    authorityLevel: AUTHORITY_LEVELS.NON_AUTHORITY,
    authoritySourceId: AUTHORITY_SOURCE_IDS.AI_OUTPUT,
    uxTermId: null,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.COMPATIBILITY_ONLY,
    productMeaning: 'Non-authoritative explanation of inferred or compatibility-projected assumptions.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: true,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.WARNINGS,
    label: 'Warnings',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.INFERRED_COMPATIBILITY_PROJECTION,
    authorityLevel: AUTHORITY_LEVELS.NON_AUTHORITY,
    authoritySourceId: AUTHORITY_SOURCE_IDS.AI_OUTPUT,
    uxTermId: null,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.COMPATIBILITY_ONLY,
    productMeaning: 'Non-authoritative draft warnings that require operator or server validation.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: true,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.SOURCE_METADATA,
    label: 'Source Metadata',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.LEGACY_BRIDGE_METADATA,
    authorityLevel: AUTHORITY_LEVELS.DRAFT_SEED,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    uxTermId: null,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.COMPATIBILITY_ONLY,
    productMeaning: 'Provenance and compatibility metadata for current bridge serialization.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: true,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.UI_STATE,
    label: 'UI State',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.UI_ONLY_TRANSIENT_STATE,
    authorityLevel: AUTHORITY_LEVELS.NON_AUTHORITY,
    authoritySourceId: null,
    uxTermId: null,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.UI_ONLY,
    productMeaning: 'Transient editing state such as expansion, focus, search, and local input buffers.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
    label: 'Evidence Projection',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
    authorityLevel: AUTHORITY_LEVELS.OBSERVED_EVIDENCE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    uxTermId: null,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.READ_ONLY_PROJECTION_ONLY,
    productMeaning: 'Read-only server-provided observed evidence that may suggest edits but is not draft intent.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: true,
    compatibilityOnly: false,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.READINESS_PROJECTION,
    label: 'Readiness Projection',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION,
    authorityLevel: AUTHORITY_LEVELS.NON_AUTHORITY,
    authoritySourceId: null,
    uxTermId: POLICY_UX_TERM_IDS.READINESS,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.READ_ONLY_PROJECTION_ONLY,
    productMeaning: 'Read-only server readiness state that draft editing can display but not decide.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: false,
    mayContainObservedEvidence: false,
    compatibilityOnly: false,
  },
  {
    id: POLICY_AUTHORING_DRAFT_FIELD_IDS.LEGACY_BRIDGE_METADATA,
    label: 'Legacy Bridge Metadata',
    authorityId: POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.LEGACY_BRIDGE_METADATA,
    authorityLevel: AUTHORITY_LEVELS.DRAFT_SEED,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    uxTermId: null,
    nativeMappingId: POLICY_AUTHORING_NATIVE_MAPPING_IDS.COMPATIBILITY_ONLY,
    productMeaning: 'Compatibility-only metadata needed to preserve current preset/custom-signal behavior.',
    mayPersistNativeIntent: false,
    maySerializeLegacyBridge: true,
    mayContainObservedEvidence: false,
    compatibilityOnly: true,
  },
]);

const POLICY_AUTHORING_PROHIBITED_DRAFT_RESPONSIBILITIES = deepFreeze([
  {
    id: POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.OBSERVED_EVIDENCE_GENERATION,
    riskId: POLICY_AUTHORING_DRAFT_RISK_IDS.EVIDENCE_ENGINE_LEAK,
    reason: 'Observed evidence must come from server-owned evidence/readiness contracts, not draft state.',
  },
  {
    id: POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.LEARNING_DECISIONS,
    riskId: POLICY_AUTHORING_DRAFT_RISK_IDS.LEARNING_SIDE_EFFECT,
    reason: 'Draft edits can propose intent; they cannot decide durable learning eligibility.',
  },
  {
    id: POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.PROVIDER_READINESS_DECISIONS,
    riskId: POLICY_AUTHORING_DRAFT_RISK_IDS.EVIDENCE_ENGINE_LEAK,
    reason: 'Provider readiness is a server/provider projection, not client draft authority.',
  },
  {
    id: POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.ROUTING_SIDE_EFFECTS,
    riskId: POLICY_AUTHORING_DRAFT_RISK_IDS.ROUTING_SIDE_EFFECT,
    reason: 'Draft routing target intent must not execute Arr writes or routing side effects.',
  },
  {
    id: POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS.MIGRATION_ACCEPTANCE,
    riskId: POLICY_AUTHORING_DRAFT_RISK_IDS.DURABLE_AUTHORITY_CONFUSION,
    reason: 'Migration acceptance requires server validation and migration gates, not client draft state.',
  },
]);

function listPolicyAuthoringDraftFieldRecords() {
  return POLICY_AUTHORING_DRAFT_FIELD_RECORDS;
}

function getPolicyAuthoringDraftFieldRecord(fieldId) {
  return POLICY_AUTHORING_DRAFT_FIELD_RECORDS.find(record => record.id === fieldId) || null;
}

function listPolicyAuthoringDraftFieldsByAuthority(authorityId) {
  return POLICY_AUTHORING_DRAFT_FIELD_RECORDS.filter(record => record.authorityId === authorityId);
}

function listPolicyAuthoringProhibitedDraftResponsibilities() {
  return POLICY_AUTHORING_PROHIBITED_DRAFT_RESPONSIBILITIES;
}

function getPolicyAuthoringProhibitedDraftResponsibility(responsibilityId) {
  return POLICY_AUTHORING_PROHIBITED_DRAFT_RESPONSIBILITIES.find(record => record.id === responsibilityId) || null;
}

function canPolicyAuthoringDraftFieldPersistNativeIntent(fieldId) {
  return getPolicyAuthoringDraftFieldRecord(fieldId)?.mayPersistNativeIntent === true;
}

function canPolicyAuthoringDraftFieldSerializeLegacyBridge(fieldId) {
  return getPolicyAuthoringDraftFieldRecord(fieldId)?.maySerializeLegacyBridge === true;
}

function isPolicyAuthoringDraftFieldCompatibilityOnly(fieldId) {
  return getPolicyAuthoringDraftFieldRecord(fieldId)?.compatibilityOnly === true;
}

function hasRawLegacyProductTerm(record) {
  if (!record || record.authorityId !== POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT) {
    return false;
  }

  const productText = [
    record.id,
    record.label,
    record.productMeaning,
  ].filter(Boolean).join(' ');

  return RAW_LEGACY_PRODUCT_TERM_PATTERNS.some(pattern => pattern.test(productText));
}

function validatePolicyAuthoringDraftFieldContract(record) {
  if (!record || typeof record !== 'object') {
    return {
      valid: false,
      fieldId: null,
      issues: [
        {
          riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.UNKNOWN_FIELD,
          reason: 'Draft field record is missing or invalid.',
        },
      ],
    };
  }

  const issues = [];

  if (!Object.values(POLICY_AUTHORING_DRAFT_FIELD_IDS).includes(record.id)) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.UNKNOWN_FIELD,
      reason: 'Draft field is not in the declared policy authoring field vocabulary.',
    });
  }

  if (!Object.values(POLICY_AUTHORING_DRAFT_AUTHORITY_IDS).includes(record.authorityId)) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.MISSING_AUTHORITY,
      reason: 'Draft field has no recognized authority classification.',
    });
  }

  if (!Object.values(POLICY_AUTHORING_NATIVE_MAPPING_IDS).includes(record.nativeMappingId)) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.MISSING_NATIVE_MAPPING,
      reason: 'Draft field has no recognized native mapping classification.',
    });
  }

  if (
    record.mayPersistNativeIntent
    && record.authorityId !== POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.NATIVE_FIELD_NOT_DECLARED_INTENT,
      reason: 'Only operator-declared intent fields may be native intent candidates.',
    });
  }

  if (record.compatibilityOnly && record.mayPersistNativeIntent) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.COMPATIBILITY_FIELD_PERSISTS_NATIVE,
      reason: 'Compatibility-only draft fields cannot persist as native intent.',
    });
  }

  if (
    record.authorityId === POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.UI_ONLY_TRANSIENT_STATE
    && (record.mayPersistNativeIntent || record.maySerializeLegacyBridge)
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.UI_FIELD_SERIALIZES,
      reason: 'UI-only transient state cannot serialize through native intent or the legacy bridge.',
    });
  }

  if (
    record.authorityId === POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION
    && (record.mayPersistNativeIntent || record.maySerializeLegacyBridge)
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.READ_ONLY_PROJECTION_SERIALIZES,
      reason: 'Server read-only projections cannot serialize as draft edits.',
    });
  }

  if (
    record.authorityId === POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.OPERATOR_DECLARED_INTENT
    && record.mayContainObservedEvidence
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.OBSERVED_EVIDENCE_IN_DECLARED_INTENT,
      reason: 'Operator-declared intent fields cannot own observed evidence.',
    });
  }

  if (hasRawLegacyProductTerm(record)) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.RAW_LEGACY_TERM_IN_PRODUCT_FIELD,
      reason: 'Operator-facing draft fields must be readable without raw legacy storage terminology.',
    });
  }

  return {
    valid: issues.length === 0,
    fieldId: record.id || null,
    issues,
  };
}

function validatePolicyAuthoringDraftFieldOwnership(fieldId, proposedAuthorityId) {
  const record = getPolicyAuthoringDraftFieldRecord(fieldId);

  if (!record) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_RISK_IDS.DURABLE_AUTHORITY_CONFUSION,
      reason: 'Unknown draft field.',
    };
  }

  if (record.authorityId !== proposedAuthorityId) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_RISK_IDS.DURABLE_AUTHORITY_CONFUSION,
      reason: 'Draft field authority does not match the policy authoring contract.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Draft field authority matches the policy authoring contract.',
  };
}

function evaluatePolicyAuthoringDraftResponsibilitySet(responsibilityIds = []) {
  const normalizedIds = Array.isArray(responsibilityIds) ? responsibilityIds : [];
  const prohibitedIds = normalizedIds.filter(responsibilityId => (
    Boolean(getPolicyAuthoringProhibitedDraftResponsibility(responsibilityId))
  ));
  const unknownIds = normalizedIds.filter(responsibilityId => (
    !Object.values(POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS).includes(responsibilityId)
  ));

  return {
    valid: prohibitedIds.length === 0 && unknownIds.length === 0,
    prohibitedIds,
    unknownIds,
  };
}

function summarizePolicyAuthoringDraftContract() {
  const countsByAuthority = POLICY_AUTHORING_DRAFT_FIELD_RECORDS.reduce((counts, record) => {
    counts[record.authorityId] = (counts[record.authorityId] || 0) + 1;
    return counts;
  }, {});

  return {
    draftIsDurableAuthority: false,
    serverValidationRequired: true,
    rawLegacyStorageTermsRequired: false,
    fieldCount: POLICY_AUTHORING_DRAFT_FIELD_RECORDS.length,
    countsByAuthority,
    nativeIntentCandidateFieldIds: POLICY_AUTHORING_DRAFT_FIELD_RECORDS
      .filter(record => record.mayPersistNativeIntent)
      .map(record => record.id),
    compatibilityOnlyFieldIds: POLICY_AUTHORING_DRAFT_FIELD_RECORDS
      .filter(record => record.compatibilityOnly)
      .map(record => record.id),
    readOnlyProjectionFieldIds: POLICY_AUTHORING_DRAFT_FIELD_RECORDS
      .filter(record => record.authorityId === POLICY_AUTHORING_DRAFT_AUTHORITY_IDS.SERVER_READ_ONLY_PROJECTION)
      .map(record => record.id),
    prohibitedResponsibilityIds: POLICY_AUTHORING_PROHIBITED_DRAFT_RESPONSIBILITIES.map(record => record.id),
  };
}

function buildPolicyAuthoringDraftContractAudit({ fieldRecords = POLICY_AUTHORING_DRAFT_FIELD_RECORDS } = {}) {
  const fieldResults = fieldRecords.map(validatePolicyAuthoringDraftFieldContract);
  const knownFieldIds = fieldRecords.map(record => record?.id).filter(Boolean);
  const missingFieldIds = Object.values(POLICY_AUTHORING_DRAFT_FIELD_IDS)
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
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.UNKNOWN_FIELD,
      reason: 'Required policy authoring draft field is missing from the contract.',
    })),
    ...duplicateFieldIds.map(fieldId => ({
      fieldId,
      riskId: POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS.UNKNOWN_FIELD,
      reason: 'Draft field appears more than once in the contract.',
    })),
  ];

  return {
    ok: issues.length === 0,
    checkedFieldCount: fieldRecords.length,
    requiredFieldCount: Object.values(POLICY_AUTHORING_DRAFT_FIELD_IDS).length,
    fieldResults,
    missingFieldIds,
    duplicateFieldIds,
    issues,
  };
}

export {
  POLICY_AUTHORING_DRAFT_AUTHORITY_IDS,
  POLICY_AUTHORING_DRAFT_CONTRACT_AUDIT_RISK_IDS,
  POLICY_AUTHORING_DRAFT_FIELD_IDS,
  POLICY_AUTHORING_DRAFT_PROHIBITED_AUTHORITY_IDS,
  POLICY_AUTHORING_DRAFT_RISK_IDS,
  POLICY_AUTHORING_NATIVE_MAPPING_IDS,
  buildPolicyAuthoringDraftContractAudit,
  canPolicyAuthoringDraftFieldPersistNativeIntent,
  canPolicyAuthoringDraftFieldSerializeLegacyBridge,
  evaluatePolicyAuthoringDraftResponsibilitySet,
  getPolicyAuthoringDraftFieldRecord,
  getPolicyAuthoringProhibitedDraftResponsibility,
  isPolicyAuthoringDraftFieldCompatibilityOnly,
  listPolicyAuthoringDraftFieldRecords,
  listPolicyAuthoringDraftFieldsByAuthority,
  listPolicyAuthoringProhibitedDraftResponsibilities,
  summarizePolicyAuthoringDraftContract,
  validatePolicyAuthoringDraftFieldContract,
  validatePolicyAuthoringDraftFieldOwnership,
};
