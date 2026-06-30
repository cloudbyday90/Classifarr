import {
  buildPolicyIntentWritePreflight,
} from './policyIntentRequestValidator.mjs';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
} from './policyIntentSchema.mjs';
import {
  PHASE_2R_DRAFT_COMMAND_IDS,
} from './policyBuilderPhase2DraftCommandBoundary.mjs';
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

const PHASE_2R_NATIVE_STORAGE_MODE_IDS = Object.freeze({
  LEGACY_BRIDGE_ONLY: 'legacy_bridge_only',
  DUAL_READ_WRITE_PLANNED: 'dual_read_write_planned',
  NATIVE_STORAGE_READY: 'native_storage_ready',
});

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
      PHASE_2R_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
      PHASE_2R_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
    ],
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
  PHASE_2R_AUTHORITY_INSERTION_POINT_IDS,
  PHASE_2R_AUTHORITY_OWNER_IDS,
  PHASE_2R_AUTHORITY_RESPONSIBILITY_IDS,
  PHASE_2R_AUTHORITY_RISK_IDS,
  PHASE_2R_AUTHORITY_WARNING_REASON_IDS,
  PHASE_2R_NATIVE_STORAGE_MODE_IDS,
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
  validatePhase2RServerInsertionPoint,
};
