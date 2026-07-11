import {
  buildPolicyIntentWritePreflight,
} from './policyIntentRequestValidator.mjs';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
} from './policyIntentSchema.mjs';
import {
  POLICY_AUTHORING_DRAFT_COMMAND_IDS,
} from './policyAuthoringDraftCommandBoundary.mjs';
import {
  PHASE_2R_DRAFT_FIELD_IDS,
} from './policyBuilderPhase2DraftContract.mjs';

const PHASE_2R_AUTHORITY_OWNER_IDS = Object.freeze({
  CLIENT_UX_GUARDRAIL: 'client_ux_guardrail',
  SERVER_ROUTE_PREFLIGHT: 'server_route_preflight',
  SERVER_REQUEST_VALIDATOR: 'server_request_validator',
  SERVER_INTENT_CONTRACT: 'server_intent_contract',
  LEGACY_BRIDGE_COMPATIBILITY: 'legacy_bridge_compatibility',
  PHASE_6R_ENGINE_PROJECTION: 'phase_6r_engine_projection',
  PHASE_8R_NATIVE_STORAGE: 'phase_8r_native_storage',
});

const PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS = Object.freeze({
  CLIENT_DRAFT_COMMAND_GUARDRAILS: 'client_draft_command_guardrails',
  CLIENT_DRAFT_VIEW_GUARDRAILS: 'client_draft_view_guardrails',
  ROUTE_PAYLOAD_PREFLIGHT: 'route_payload_preflight',
  INTENT_DRAFT_REQUEST_SCHEMA: 'intent_draft_request_schema',
  INTENT_CONTRACT_VALIDATION: 'intent_contract_validation',
  DRAFT_WARNING_ALIGNMENT: 'draft_warning_alignment',
  LEGACY_BRIDGE_SERIALIZATION: 'legacy_bridge_serialization',
  PROFILE_TO_INTENT_SUGGESTIONS: 'profile_to_intent_suggestions',
  NATIVE_INTENT_STORAGE_REPLACEMENT: 'native_intent_storage_replacement',
});

const PHASE_2R_AUTHORITY_INSERTION_POINT_IDS = Object.freeze({
  POLICY_WRITE_ROUTE_PREFLIGHT: 'policy_write_route_preflight',
  POLICY_INTENT_REQUEST_VALIDATOR: 'policy_intent_request_validator',
  POLICY_INTENT_CONTRACT_VALIDATOR: 'policy_intent_contract_validator',
  PROFILE_TO_INTENT_SUGGESTION_PROVIDER: 'profile_to_intent_suggestion_provider',
  NATIVE_INTENT_STORAGE_MAPPER: 'native_intent_storage_mapper',
});

const PHASE_2R_AUTHORITY_WARNING_REASON_IDS = Object.freeze({
  SERVER_VALIDATION_REQUIRED: 'server_validation_required',
  NATIVE_INTENT_STORAGE_NOT_ENABLED: 'native_intent_storage_not_enabled',
  MISSING_PURPOSE: 'missing_purpose',
  HARD_LIMIT_REQUIRES_STRICT_CONSTRAINT: 'hard_limit_requires_strict_constraint',
  HELPFUL_HINT_CANNOT_BE_STRICT: 'helpful_hint_cannot_be_strict',
  AVOID_SHOULD_BE_EXCLUSION: 'avoid_should_be_exclusion',
  LEGACY_PRESET_PARTIAL_INFERENCE: 'legacy_preset_partial_inference',
});

const PHASE_2R_AUTHORITY_RISK_IDS = Object.freeze({
  CLIENT_AUTHORITY_CONFUSION: 'client_authority_confusion',
  UNSAFE_NATIVE_STORAGE_CLAIM: 'unsafe_native_storage_claim',
  ROUTING_SIDE_EFFECT_LEAK: 'routing_side_effect_leak',
  MISSING_SERVER_INSERTION_POINT: 'missing_server_insertion_point',
  RAW_DRAFT_ECHO: 'raw_draft_echo',
});

const PHASE_2R_AUTHORITY_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_RESPONSIBILITY: 'unknown_responsibility',
  UNKNOWN_OWNER: 'unknown_owner',
  MISSING_MODULE_BOUNDARY: 'missing_module_boundary',
  CLIENT_MARKED_AUTHORITATIVE: 'client_marked_authoritative',
  SERVER_MARKED_NON_AUTHORITATIVE: 'server_marked_non_authoritative',
  AUTHORITATIVE_RECORD_MISSING_INSERTION_POINT: 'authoritative_record_missing_insertion_point',
  UNKNOWN_INSERTION_POINT: 'unknown_insertion_point',
  INSERTION_POINT_ECHOES_RAW_DRAFT: 'insertion_point_echoes_raw_draft',
  NATIVE_STORAGE_ENABLED_BEFORE_PHASE_8R: 'native_storage_enabled_before_phase_8r',
  MISSING_WARNING_REASON_CODE: 'missing_warning_reason_code',
  MISSING_NATIVE_STORAGE_STEP: 'missing_native_storage_step',
});

const PHASE_2R_NATIVE_STORAGE_MODE_IDS = Object.freeze({
  LEGACY_BRIDGE_ONLY: 'legacy_bridge_only',
  DUAL_READ_WRITE_PLANNED: 'dual_read_write_planned',
  NATIVE_STORAGE_READY: 'native_storage_ready',
});

const REQUIRED_PHASE_2R_SERVER_WARNING_REASON_IDS = Object.freeze([
  PHASE_2R_AUTHORITY_WARNING_REASON_IDS.SERVER_VALIDATION_REQUIRED,
  PHASE_2R_AUTHORITY_WARNING_REASON_IDS.NATIVE_INTENT_STORAGE_NOT_ENABLED,
  PHASE_2R_AUTHORITY_WARNING_REASON_IDS.MISSING_PURPOSE,
  PHASE_2R_AUTHORITY_WARNING_REASON_IDS.HARD_LIMIT_REQUIRES_STRICT_CONSTRAINT,
  PHASE_2R_AUTHORITY_WARNING_REASON_IDS.HELPFUL_HINT_CANNOT_BE_STRICT,
  PHASE_2R_AUTHORITY_WARNING_REASON_IDS.AVOID_SHOULD_BE_EXCLUSION,
  PHASE_2R_AUTHORITY_WARNING_REASON_IDS.LEGACY_PRESET_PARTIAL_INFERENCE,
]);

const REQUIRED_PHASE_2R_NATIVE_STORAGE_STEP_IDS = Object.freeze([
  'create_from_native_intent',
  'edit_native_intent_projection',
  'serialize_to_native_intent',
  'retain_legacy_bridge_for_unconverted_policies',
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

const PHASE_2R_AUTHORITY_RESPONSIBILITY_RECORDS = deepFreeze([
  {
    id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_COMMAND_GUARDRAILS,
    ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL,
    authoritative: false,
    currentModulePath: 'client/src/composables/usePolicyIntentDraft.js',
    insertionPointId: null,
    notes: 'Client commands provide immediate UX feedback but cannot decide durable policy validity.',
  },
  {
    id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.CLIENT_DRAFT_VIEW_GUARDRAILS,
    ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL,
    authoritative: false,
    currentModulePath: 'client/src/utils/policyIntentDraftView.js',
    insertionPointId: null,
    notes: 'Client view projections render state and warnings but cannot own evidence or readiness decisions.',
  },
  {
    id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.ROUTE_PAYLOAD_PREFLIGHT,
    ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_ROUTE_PREFLIGHT,
    authoritative: true,
    currentModulePath: 'server/src/routes/policiesRoutePolicyWrite.mjs',
    insertionPointId: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_WRITE_ROUTE_PREFLIGHT,
    notes: 'Policy write routes validate explicit draft input before response preflight diagnostics are attached.',
  },
  {
    id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_DRAFT_REQUEST_SCHEMA,
    ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR,
    authoritative: true,
    currentModulePath: 'server/src/services/policyIntentRequestValidator.mjs',
    insertionPointId: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
    notes: 'Server request schema is the current authority for accepted draft payload shape.',
  },
  {
    id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.INTENT_CONTRACT_VALIDATION,
    ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_INTENT_CONTRACT,
    authoritative: true,
    currentModulePath: 'server/src/services/policyIntentSchema.mjs',
    insertionPointId: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_CONTRACT_VALIDATOR,
    notes: 'Phase 5R should promote this validation layer to the native intent contract authority.',
  },
  {
    id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.DRAFT_WARNING_ALIGNMENT,
    ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_INTENT_CONTRACT,
    authoritative: true,
    currentModulePath: 'server/src/services/policyIntentSchema.mjs',
    insertionPointId: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_CONTRACT_VALIDATOR,
    notes: 'Draft warnings should use server reason codes where possible instead of client-only labels.',
  },
  {
    id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.LEGACY_BRIDGE_SERIALIZATION,
    ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.LEGACY_BRIDGE_COMPATIBILITY,
    authoritative: false,
    currentModulePath: 'client/src/utils/policyIntentDraftBridge.js',
    insertionPointId: null,
    notes: 'The bridge preserves compatibility until native storage replaces it; it is not policy authority.',
  },
  {
    id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.PROFILE_TO_INTENT_SUGGESTIONS,
    ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.PHASE_6R_ENGINE_PROJECTION,
    authoritative: false,
    currentModulePath: 'future Phase 6R server profile-to-intent suggestion provider',
    insertionPointId: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER,
    notes: 'Server suggestions may seed draft options but cannot become declared intent without operator/server acceptance.',
  },
  {
    id: PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS.NATIVE_INTENT_STORAGE_REPLACEMENT,
    ownerId: PHASE_2R_AUTHORITY_OWNER_IDS.PHASE_8R_NATIVE_STORAGE,
    authoritative: true,
    currentModulePath: 'future Phase 8R native intent storage mapper',
    insertionPointId: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.NATIVE_INTENT_STORAGE_MAPPER,
    notes: 'Native storage must pass migration, rollback, and parity gates before replacing the legacy bridge.',
  },
]);

const PHASE_2R_AUTHORITY_INSERTION_POINT_RECORDS = deepFreeze([
  {
    id: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_WRITE_ROUTE_PREFLIGHT,
    modulePath: 'server/src/routes/policiesRoutePolicyWrite.mjs',
    currentEntryPoint: 'buildRouteIntentWritePreflight',
    targetPhase: '2R.5',
    blocksRawDraftEcho: true,
  },
  {
    id: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
    modulePath: 'server/src/services/policyIntentRequestValidator.mjs',
    currentEntryPoint: 'validatePolicyIntentWritePayload',
    targetPhase: '2R.5',
    blocksRawDraftEcho: true,
  },
  {
    id: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_CONTRACT_VALIDATOR,
    modulePath: 'server/src/services/policyIntentSchema.mjs',
    currentEntryPoint: 'validatePolicyIntentContract',
    targetPhase: '5R',
    blocksRawDraftEcho: true,
  },
  {
    id: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER,
    modulePath: 'future server/src/services/policyProfileIntentSuggestion*.mjs',
    currentEntryPoint: null,
    targetPhase: '6R',
    blocksRawDraftEcho: true,
  },
  {
    id: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.NATIVE_INTENT_STORAGE_MAPPER,
    modulePath: 'future server/src/services/policyIntentStorage*.mjs',
    currentEntryPoint: null,
    targetPhase: '8R',
    blocksRawDraftEcho: true,
  },
]);

const PHASE_2R_NATIVE_STORAGE_REPLACEMENT_STEPS = deepFreeze([
  {
    id: 'create_from_native_intent',
    modeId: PHASE_2R_NATIVE_STORAGE_MODE_IDS.DUAL_READ_WRITE_PLANNED,
    requirement: 'Read native intent first when present and fall back to the legacy bridge for unconverted policies.',
  },
  {
    id: 'edit_native_intent_projection',
    modeId: PHASE_2R_NATIVE_STORAGE_MODE_IDS.DUAL_READ_WRITE_PLANNED,
    requirement: 'Keep product components editing the same draft/view/command contracts while storage changes underneath.',
  },
  {
    id: 'serialize_to_native_intent',
    modeId: PHASE_2R_NATIVE_STORAGE_MODE_IDS.NATIVE_STORAGE_READY,
    requirement: 'Persist server-validated native intent instead of trusting client bridge inference.',
  },
  {
    id: 'retain_legacy_bridge_for_unconverted_policies',
    modeId: PHASE_2R_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
    requirement: 'Keep bridge compatibility until conversion parity, rollback snapshots, and deletion gates pass.',
  },
]);

function listPhase2RAuthorityResponsibilities() {
  return PHASE_2R_AUTHORITY_RESPONSIBILITY_RECORDS;
}

function getPhase2RAuthorityResponsibility(responsibilityId) {
  return PHASE_2R_AUTHORITY_RESPONSIBILITY_RECORDS.find(record => record.id === responsibilityId) || null;
}

function listPhase2RAuthorityResponsibilitiesByOwner(ownerId) {
  return PHASE_2R_AUTHORITY_RESPONSIBILITY_RECORDS.filter(record => record.ownerId === ownerId);
}

function listPhase2RAuthorityInsertionPoints() {
  return PHASE_2R_AUTHORITY_INSERTION_POINT_RECORDS;
}

function getPhase2RAuthorityInsertionPoint(insertionPointId) {
  return PHASE_2R_AUTHORITY_INSERTION_POINT_RECORDS.find(record => record.id === insertionPointId) || null;
}

function listPhase2RNativeStorageReplacementSteps() {
  return PHASE_2R_NATIVE_STORAGE_REPLACEMENT_STEPS;
}

function listPhase2RServerWarningReasonIds() {
  return Object.values(PHASE_2R_AUTHORITY_WARNING_REASON_IDS);
}

function validatePhase2RAuthorityAssignment({ responsibilityId, ownerId } = {}) {
  const record = getPhase2RAuthorityResponsibility(responsibilityId);
  if (!record) {
    return {
      valid: false,
      riskId: PHASE_2R_AUTHORITY_RISK_IDS.MISSING_SERVER_INSERTION_POINT,
      reason: 'Unknown Phase 2R authority responsibility.',
    };
  }

  if (record.ownerId !== ownerId) {
    return {
      valid: false,
      riskId: record.authoritative
        ? PHASE_2R_AUTHORITY_RISK_IDS.CLIENT_AUTHORITY_CONFUSION
        : PHASE_2R_AUTHORITY_RISK_IDS.UNSAFE_NATIVE_STORAGE_CLAIM,
      reason: 'Authority owner does not match the Phase 2R preparation contract.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Authority owner matches the Phase 2R preparation contract.',
  };
}

function validatePhase2RAuthorityResponsibilityRecord(record) {
  if (!record || typeof record !== 'object') {
    return {
      valid: false,
      responsibilityId: null,
      issues: [
        {
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
          reason: 'Phase 2R authority responsibility record is missing or invalid.',
        },
      ],
    };
  }

  const issues = [];

  if (!Object.values(PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS).includes(record.id)) {
    issues.push({
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
      reason: 'Authority responsibility is not in the Phase 2R responsibility vocabulary.',
    });
  }

  if (!Object.values(PHASE_2R_AUTHORITY_OWNER_IDS).includes(record.ownerId)) {
    issues.push({
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_OWNER,
      reason: 'Authority responsibility has no recognized owner.',
    });
  }

  if (!record.currentModulePath || !record.notes) {
    issues.push({
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.MISSING_MODULE_BOUNDARY,
      reason: 'Authority responsibility must declare a module path and boundary note.',
    });
  }

  if (
    record.ownerId === PHASE_2R_AUTHORITY_OWNER_IDS.CLIENT_UX_GUARDRAIL
    && record.authoritative
  ) {
    issues.push({
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.CLIENT_MARKED_AUTHORITATIVE,
      reason: 'Client UX guardrails cannot be authoritative for durable policy validity.',
    });
  }

  if (
    [
      PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_ROUTE_PREFLIGHT,
      PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_REQUEST_VALIDATOR,
      PHASE_2R_AUTHORITY_OWNER_IDS.SERVER_INTENT_CONTRACT,
      PHASE_2R_AUTHORITY_OWNER_IDS.PHASE_8R_NATIVE_STORAGE,
    ].includes(record.ownerId)
    && !record.authoritative
  ) {
    issues.push({
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.SERVER_MARKED_NON_AUTHORITATIVE,
      reason: 'Server authority and native storage responsibilities must be authoritative when active.',
    });
  }

  if (record.authoritative && !record.insertionPointId) {
    issues.push({
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.AUTHORITATIVE_RECORD_MISSING_INSERTION_POINT,
      reason: 'Authoritative responsibilities need an explicit server insertion point.',
    });
  }

  if (
    record.insertionPointId
    && !Object.values(PHASE_2R_AUTHORITY_INSERTION_POINT_IDS).includes(record.insertionPointId)
  ) {
    issues.push({
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_INSERTION_POINT,
      reason: 'Authority responsibility references an unknown insertion point.',
    });
  }

  return {
    valid: issues.length === 0,
    responsibilityId: record.id || null,
    issues,
  };
}

function validatePhase2RServerInsertionPoint(insertionPointId) {
  const record = getPhase2RAuthorityInsertionPoint(insertionPointId);
  if (!record) {
    return {
      valid: false,
      riskId: PHASE_2R_AUTHORITY_RISK_IDS.MISSING_SERVER_INSERTION_POINT,
      reason: 'Unknown Phase 2R server insertion point.',
    };
  }

  if (!record.blocksRawDraftEcho) {
    return {
      valid: false,
      riskId: PHASE_2R_AUTHORITY_RISK_IDS.RAW_DRAFT_ECHO,
      reason: 'Server insertion point must not echo raw draft payloads.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Server insertion point is declared and blocks raw draft echo.',
  };
}

function validatePhase2RInsertionPointRecord(record) {
  if (!record || typeof record !== 'object') {
    return {
      valid: false,
      insertionPointId: null,
      issues: [
        {
          riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_INSERTION_POINT,
          reason: 'Phase 2R insertion point record is missing or invalid.',
        },
      ],
    };
  }

  const issues = [];

  if (!Object.values(PHASE_2R_AUTHORITY_INSERTION_POINT_IDS).includes(record.id)) {
    issues.push({
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_INSERTION_POINT,
      reason: 'Insertion point is not in the Phase 2R insertion-point vocabulary.',
    });
  }

  if (!record.modulePath) {
    issues.push({
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.MISSING_MODULE_BOUNDARY,
      reason: 'Insertion point must declare a module path.',
    });
  }

  if (!record.blocksRawDraftEcho) {
    issues.push({
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.INSERTION_POINT_ECHOES_RAW_DRAFT,
      reason: 'Insertion points must block raw draft echo.',
    });
  }

  return {
    valid: issues.length === 0,
    insertionPointId: record.id || null,
    issues,
  };
}

function buildPhase2RServerAuthorityPreflight(payload = {}) {
  const preflight = buildPolicyIntentWritePreflight(payload);

  if (!preflight) {
    return null;
  }

  return {
    ...preflight,
    client_draft_authoritative: false,
    server_validation_authoritative: true,
    native_intent_storage_mode: PHASE_2R_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
    server_insertion_point_id: PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_REQUEST_VALIDATOR,
    phase5_contract_schema_version: POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    phase6_profile_suggestion_field_ids: [
      PHASE_2R_DRAFT_FIELD_IDS.BELONGS_HERE,
      PHASE_2R_DRAFT_FIELD_IDS.HELPFUL_MATCHES,
      PHASE_2R_DRAFT_FIELD_IDS.HARD_LIMITS,
      PHASE_2R_DRAFT_FIELD_IDS.AVOID,
    ],
    future_command_ids: [
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      POLICY_AUTHORING_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
    ],
  };
}

function buildPhase2RServerAuthorityAudit({
  responsibilities = PHASE_2R_AUTHORITY_RESPONSIBILITY_RECORDS,
  insertionPoints = PHASE_2R_AUTHORITY_INSERTION_POINT_RECORDS,
  warningReasonIds = REQUIRED_PHASE_2R_SERVER_WARNING_REASON_IDS,
  nativeStorageSteps = PHASE_2R_NATIVE_STORAGE_REPLACEMENT_STEPS,
  nativeStorageMode = PHASE_2R_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
} = {}) {
  const responsibilityResults = responsibilities.map(validatePhase2RAuthorityResponsibilityRecord);
  const insertionPointResults = insertionPoints.map(validatePhase2RInsertionPointRecord);
  const responsibilityIds = responsibilities.map(record => record?.id).filter(Boolean);
  const insertionPointIds = insertionPoints.map(record => record?.id).filter(Boolean);
  const nativeStorageStepIds = nativeStorageSteps.map(step => step?.id).filter(Boolean);
  const missingResponsibilityIds = Object.values(PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS)
    .filter(responsibilityId => !responsibilityIds.includes(responsibilityId));
  const duplicateResponsibilityIds = responsibilityIds
    .filter((responsibilityId, index) => responsibilityIds.indexOf(responsibilityId) !== index)
    .filter((responsibilityId, index, allIds) => allIds.indexOf(responsibilityId) === index);
  const missingInsertionPointIds = Object.values(PHASE_2R_AUTHORITY_INSERTION_POINT_IDS)
    .filter(insertionPointId => !insertionPointIds.includes(insertionPointId));
  const duplicateInsertionPointIds = insertionPointIds
    .filter((insertionPointId, index) => insertionPointIds.indexOf(insertionPointId) !== index)
    .filter((insertionPointId, index, allIds) => allIds.indexOf(insertionPointId) === index);
  const missingWarningReasonIds = REQUIRED_PHASE_2R_SERVER_WARNING_REASON_IDS
    .filter(reasonId => !warningReasonIds.includes(reasonId));
  const missingNativeStorageStepIds = REQUIRED_PHASE_2R_NATIVE_STORAGE_STEP_IDS
    .filter(stepId => !nativeStorageStepIds.includes(stepId));
  const issues = [
    ...responsibilityResults.flatMap(result => result.issues.map(issue => ({
      responsibilityId: result.responsibilityId,
      ...issue,
    }))),
    ...insertionPointResults.flatMap(result => result.issues.map(issue => ({
      insertionPointId: result.insertionPointId,
      ...issue,
    }))),
    ...missingResponsibilityIds.map(responsibilityId => ({
      responsibilityId,
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
      reason: 'Required Phase 2R authority responsibility is missing.',
    })),
    ...duplicateResponsibilityIds.map(responsibilityId => ({
      responsibilityId,
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_RESPONSIBILITY,
      reason: 'Authority responsibility appears more than once.',
    })),
    ...missingInsertionPointIds.map(insertionPointId => ({
      insertionPointId,
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_INSERTION_POINT,
      reason: 'Required Phase 2R insertion point is missing.',
    })),
    ...duplicateInsertionPointIds.map(insertionPointId => ({
      insertionPointId,
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.UNKNOWN_INSERTION_POINT,
      reason: 'Authority insertion point appears more than once.',
    })),
    ...missingWarningReasonIds.map(reasonId => ({
      warningReasonId: reasonId,
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.MISSING_WARNING_REASON_CODE,
      reason: 'Required server warning reason code is missing.',
    })),
    ...missingNativeStorageStepIds.map(stepId => ({
      nativeStorageStepId: stepId,
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.MISSING_NATIVE_STORAGE_STEP,
      reason: 'Required native storage replacement step is missing.',
    })),
    ...(nativeStorageMode !== PHASE_2R_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY ? [{
      riskId: PHASE_2R_AUTHORITY_AUDIT_RISK_IDS.NATIVE_STORAGE_ENABLED_BEFORE_PHASE_8R,
      reason: 'Native intent storage must stay disabled until Phase 8R gates pass.',
    }] : []),
  ];

  return {
    ok: issues.length === 0,
    checkedResponsibilityCount: responsibilities.length,
    requiredResponsibilityCount: Object.values(PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS).length,
    checkedInsertionPointCount: insertionPoints.length,
    requiredInsertionPointCount: Object.values(PHASE_2R_AUTHORITY_INSERTION_POINT_IDS).length,
    responsibilityResults,
    insertionPointResults,
    missingResponsibilityIds,
    duplicateResponsibilityIds,
    missingInsertionPointIds,
    duplicateInsertionPointIds,
    missingWarningReasonIds,
    missingNativeStorageStepIds,
    nativeStorageMode,
    issues,
  };
}

function summarizePhase2RServerAuthorityPreparation() {
  const countsByOwner = PHASE_2R_AUTHORITY_RESPONSIBILITY_RECORDS.reduce((counts, record) => {
    counts[record.ownerId] = (counts[record.ownerId] || 0) + 1;
    return counts;
  }, {});

  return {
    responsibilityCount: PHASE_2R_AUTHORITY_RESPONSIBILITY_RECORDS.length,
    insertionPointCount: PHASE_2R_AUTHORITY_INSERTION_POINT_RECORDS.length,
    nativeStorageReplacementStepCount: PHASE_2R_NATIVE_STORAGE_REPLACEMENT_STEPS.length,
    countsByOwner,
    clientDraftAuthoritative: false,
    serverValidationAuthoritative: true,
    nativeIntentPersistenceEnabled: false,
    nativeIntentStorageMode: PHASE_2R_NATIVE_STORAGE_MODE_IDS.LEGACY_BRIDGE_ONLY,
    phase5InsertionPointIds: [
      PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.POLICY_INTENT_CONTRACT_VALIDATOR,
    ],
    phase6InsertionPointIds: [
      PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.PROFILE_TO_INTENT_SUGGESTION_PROVIDER,
    ],
    phase8InsertionPointIds: [
      PHASE_2R_AUTHORITY_INSERTION_POINT_IDS.NATIVE_INTENT_STORAGE_MAPPER,
    ],
  };
}

export {
  PHASE_2R_AUTHORITY_AUDIT_RISK_IDS,
  PHASE_2R_AUTHORITY_INSERTION_POINT_IDS,
  PHASE_2R_AUTHORITY_OWNER_IDS,
  PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS,
  PHASE_2R_AUTHORITY_RISK_IDS,
  PHASE_2R_AUTHORITY_WARNING_REASON_IDS,
  PHASE_2R_NATIVE_STORAGE_MODE_IDS,
  buildPhase2RServerAuthorityAudit,
  buildPhase2RServerAuthorityPreflight,
  getPhase2RAuthorityInsertionPoint,
  getPhase2RAuthorityResponsibility,
  listPhase2RAuthorityInsertionPoints,
  listPhase2RAuthorityResponsibilities,
  listPhase2RAuthorityResponsibilitiesByOwner,
  listPhase2RNativeStorageReplacementSteps,
  listPhase2RServerWarningReasonIds,
  summarizePhase2RServerAuthorityPreparation,
  validatePhase2RAuthorityAssignment,
  validatePhase2RAuthorityResponsibilityRecord,
  validatePhase2RInsertionPointRecord,
  validatePhase2RServerInsertionPoint,
};
