import {
  POLICY_BUILDER_BOUNDARY_CATEGORIES,
  POLICY_BUILDER_BOUNDARY_RISK_IDS,
  classifyPolicyBuilderClientPath,
} from './policyBuilderBoundaryInventory.mjs';

const MODAL_ALLOWED_RESPONSIBILITY_IDS = Object.freeze({
  OPEN_CLOSE_LIFECYCLE: 'open_close_lifecycle',
  SAVE_CANCEL_ACTIONS: 'save_cancel_actions',
  CHILD_COMPONENT_COMPOSITION: 'child_component_composition',
  LOADING_ERROR_PRESENTATION: 'loading_error_presentation',
  COMMAND_ROUTING_TO_COMPOSABLES: 'command_routing_to_composables',
});

const MODAL_PROHIBITED_RESPONSIBILITY_IDS = Object.freeze({
  EVIDENCE_GENERATION: 'evidence_generation',
  INTENT_INFERENCE: 'intent_inference',
  LEARNING_DECISIONS: 'learning_decisions',
  READINESS_DECISIONS: 'readiness_decisions',
  MIGRATION_PARITY_DECISIONS: 'migration_parity_decisions',
  RAW_LEGACY_PAYLOAD_MUTATION: 'raw_legacy_payload_mutation',
});

const MODAL_EXTRACTION_TARGET_IDS = Object.freeze({
  DIAGNOSTIC_PREVIEW_SURFACES: 'diagnostic_preview_surfaces',
  ADVANCED_SCORING_CONTROLS: 'advanced_scoring_controls',
  SUMMARY_VIEW_PROJECTION: 'summary_view_projection',
  LEGACY_COMMAND_ADAPTERS: 'legacy_command_adapters',
  SAVE_FAILURE_NOTIFICATION: 'save_failure_notification',
});

const MODAL_ORCHESTRATION_DECISION_IDS = Object.freeze({
  KEEP_IN_MODAL: 'keep_in_modal',
  MOVE_TO_COMPOSABLE: 'move_to_composable',
  MOVE_TO_PRESENTATION_COMPONENT: 'move_to_presentation_component',
  MOVE_TO_SERVER_CONTRACT: 'move_to_server_contract',
  RECLASSIFY_OR_DELETE_AFTER_ENGINE_CUTLINE: 'reclassify_or_delete_after_engine_cutline',
});

const MODAL_TOUCHPOINT_IDS = Object.freeze({
  MODEL_VALUE_BINDING: 'model_value_binding',
  SAVE_PAYLOAD_DELEGATION: 'save_payload_delegation',
  DRAFT_SIGNAL_COMMAND_ROUTING: 'draft_signal_command_routing',
  PROFILE_REFRESH_COMMAND_ROUTING: 'profile_refresh_command_routing',
  DIAGNOSTIC_PREVIEW_COMPOSITION: 'diagnostic_preview_composition',
  ADVANCED_SCORING_COMPOSITION: 'advanced_scoring_composition',
  SUMMARY_VIEW_PROJECTION: 'summary_view_projection',
  LEGACY_TEMPLATE_COMMAND_ADAPTERS: 'legacy_template_command_adapters',
  SAVE_FAILURE_BROWSER_ALERT: 'save_failure_browser_alert',
});

const MODAL_PUBLIC_EVENT_IDS = Object.freeze({
  UPDATE_MODEL_VALUE: 'update:modelValue',
  SAVE: 'save',
  CLOSE: 'close',
});

const MODAL_EVENT_PAYLOAD_AUTHORITY_IDS = Object.freeze({
  VIEW_STATE: 'view_state',
  DELEGATED_SAVE_PAYLOAD: 'delegated_save_payload',
  NO_PAYLOAD: 'no_payload',
});

const MODAL_TARGET_BOUNDARY_IDS = Object.freeze({
  ENGINE_CUTLINE: 'engine_cutline',
  OPERATOR_SURFACE_ENGINE_CUTLINE: 'operator_surface_engine_cutline',
  MODAL_ORCHESTRATION: 'modal_orchestration',
  LEGACY_BRIDGE: 'legacy_bridge',
});

const MODAL_ORCHESTRATION_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_TOUCHPOINT: 'unknown_touchpoint',
  PROHIBITED_RESPONSIBILITY: 'prohibited_responsibility',
  UNMAPPED_EXTRACTION_TARGET: 'unmapped_extraction_target',
  UNKNOWN_PUBLIC_EVENT: 'unknown_public_event',
  INVALID_EVENT_RESPONSIBILITY: 'invalid_event_responsibility',
  EVENT_PAYLOAD_NOT_DELEGATED: 'event_payload_not_delegated',
  INVALID_EVENT_VALIDATOR_EXPECTATION: 'invalid_event_validator_expectation',
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

const MODAL_ALLOWED_RESPONSIBILITIES = deepFreeze([
  {
    id: MODAL_ALLOWED_RESPONSIBILITY_IDS.OPEN_CLOSE_LIFECYCLE,
    label: 'Open and close lifecycle',
    modalMayOwn: 'Bind modal visibility to `modelValue` and emit `update:modelValue`.',
    guardrail: 'Visibility state must not trigger evidence, migration, learning, or routing side effects.',
  },
  {
    id: MODAL_ALLOWED_RESPONSIBILITY_IDS.SAVE_CANCEL_ACTIONS,
    label: 'High-level save and cancel actions',
    modalMayOwn: 'Call the current save command and emit cancel/close events.',
    guardrail: 'Save payload construction must stay delegated to owned draft/serializer boundaries.',
  },
  {
    id: MODAL_ALLOWED_RESPONSIBILITY_IDS.CHILD_COMPONENT_COMPOSITION,
    label: 'Child component composition',
    modalMayOwn: 'Compose policy-builder child components and pass already-derived data through props.',
    guardrail: 'Composition must not calculate policy evidence, readiness, or migration parity.',
  },
  {
    id: MODAL_ALLOWED_RESPONSIBILITY_IDS.LOADING_ERROR_PRESENTATION,
    label: 'Loading and error presentation',
    modalMayOwn: 'Display loading, disabled, stale, and error states returned by composables.',
    guardrail: 'The modal may render state but must not decide whether a state is authoritative.',
  },
  {
    id: MODAL_ALLOWED_RESPONSIBILITY_IDS.COMMAND_ROUTING_TO_COMPOSABLES,
    label: 'Command routing to owned composables',
    modalMayOwn: 'Translate child component events into explicit composable commands.',
    guardrail: 'Routing must stay narrow and cannot mutate raw legacy payloads directly.',
  },
]);

const MODAL_PROHIBITED_RESPONSIBILITIES = deepFreeze([
  {
    id: MODAL_PROHIBITED_RESPONSIBILITY_IDS.EVIDENCE_GENERATION,
    label: 'Evidence generation',
    reason: 'Evidence belongs to server-owned engine/readiness contracts or bounded adapters, not modal state.',
  },
  {
    id: MODAL_PROHIBITED_RESPONSIBILITY_IDS.INTENT_INFERENCE,
    label: 'Intent inference',
    reason: 'The modal may edit declared intent but cannot infer destination meaning from options, profiles, or templates.',
  },
  {
    id: MODAL_PROHIBITED_RESPONSIBILITY_IDS.LEARNING_DECISIONS,
    label: 'Learning decisions',
    reason: 'Learning eligibility requires the future server learning guard and cannot be derived in the browser.',
  },
  {
    id: MODAL_PROHIBITED_RESPONSIBILITY_IDS.READINESS_DECISIONS,
    label: 'Readiness decisions',
    reason: 'The modal can display readiness but cannot decide automation safety.',
  },
  {
    id: MODAL_PROHIBITED_RESPONSIBILITY_IDS.MIGRATION_PARITY_DECISIONS,
    label: 'Migration or parity decisions',
    reason: 'Migration verification and replay/parity interpretation are maintainer/server concerns, not normal modal workflow.',
  },
  {
    id: MODAL_PROHIBITED_RESPONSIBILITY_IDS.RAW_LEGACY_PAYLOAD_MUTATION,
    label: 'Raw legacy payload mutation',
    reason: 'Preset/custom-signal mutation must stay inside compatibility bridge and serializer modules.',
  },
]);

const MODAL_EXTRACTION_TARGETS = deepFreeze([
  {
    id: MODAL_EXTRACTION_TARGET_IDS.DIAGNOSTIC_PREVIEW_SURFACES,
    currentOwner: 'PolicyBuilderModal.vue composes impact and replay preview cards in the normal modal flow.',
    targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.RECLASSIFY_OR_DELETE_AFTER_ENGINE_CUTLINE,
    targetBoundaryId: MODAL_TARGET_BOUNDARY_IDS.ENGINE_CUTLINE,
    reason: 'Impact and replay previews are diagnostics; engine cutline review must classify them as engine primitives, migration verifiers, or deletion candidates.',
    relatedRiskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
    ],
  },
  {
    id: MODAL_EXTRACTION_TARGET_IDS.ADVANCED_SCORING_CONTROLS,
    currentOwner: 'PolicyBuilderModal.vue composes advanced scoring and weight controls.',
    targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.RECLASSIFY_OR_DELETE_AFTER_ENGINE_CUTLINE,
    targetBoundaryId: MODAL_TARGET_BOUNDARY_IDS.OPERATOR_SURFACE_ENGINE_CUTLINE,
    reason: 'Advanced scoring controls conflict with destination-first policy setup until the engine cutline reclassifies or removes them.',
    relatedRiskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
    ],
  },
  {
    id: MODAL_EXTRACTION_TARGET_IDS.SUMMARY_VIEW_PROJECTION,
    currentOwner: 'PolicyBuilderModal.vue builds intent summary view data from the current draft.',
    targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_COMPOSABLE,
    targetBoundaryId: MODAL_TARGET_BOUNDARY_IDS.MODAL_ORCHESTRATION,
    reason: 'Summary projection should be treated as display state and moved behind a focused orchestration/view-model boundary when the modal is narrowed.',
    relatedRiskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
  },
  {
    id: MODAL_EXTRACTION_TARGET_IDS.LEGACY_COMMAND_ADAPTERS,
    currentOwner: 'PolicyBuilderModal.vue adapts starter-template custom-signal events into draft commands.',
    targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_COMPOSABLE,
    targetBoundaryId: MODAL_TARGET_BOUNDARY_IDS.LEGACY_BRIDGE,
    reason: 'The modal can route commands temporarily, but legacy terminology and payload adaptation should be contained by bridge ownership.',
    relatedRiskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.LEGACY_PAYLOAD_TOUCHPOINT,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
  },
  {
    id: MODAL_EXTRACTION_TARGET_IDS.SAVE_FAILURE_NOTIFICATION,
    currentOwner: 'PolicyBuilderModal.vue delegates save-failure presentation to the app toast pattern.',
    targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_PRESENTATION_COMPONENT,
    targetBoundaryId: MODAL_TARGET_BOUNDARY_IDS.MODAL_ORCHESTRATION,
    reason: 'Save failure is allowed presentation, but blocking browser dialogs are not part of the modal orchestration contract.',
    relatedRiskIds: [],
  },
]);

const MODAL_TOUCHPOINTS = deepFreeze([
  {
    id: MODAL_TOUCHPOINT_IDS.MODEL_VALUE_BINDING,
    description: 'Modal binds `modelValue` through `isOpen` and emits `update:modelValue`.',
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.OPEN_CLOSE_LIFECYCLE,
    decisionId: MODAL_ORCHESTRATION_DECISION_IDS.KEEP_IN_MODAL,
  },
  {
    id: MODAL_TOUCHPOINT_IDS.SAVE_PAYLOAD_DELEGATION,
    description: 'Modal calls `buildSavePayload()` from policy-builder state before emitting save.',
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.SAVE_CANCEL_ACTIONS,
    decisionId: MODAL_ORCHESTRATION_DECISION_IDS.KEEP_IN_MODAL,
  },
  {
    id: MODAL_TOUCHPOINT_IDS.DRAFT_SIGNAL_COMMAND_ROUTING,
    description: 'Modal routes intent editor signal events to draft-state commands.',
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.COMMAND_ROUTING_TO_COMPOSABLES,
    decisionId: MODAL_ORCHESTRATION_DECISION_IDS.KEEP_IN_MODAL,
  },
  {
    id: MODAL_TOUCHPOINT_IDS.PROFILE_REFRESH_COMMAND_ROUTING,
    description: 'Modal routes profile refresh requests to the reference-data composable.',
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.COMMAND_ROUTING_TO_COMPOSABLES,
    decisionId: MODAL_ORCHESTRATION_DECISION_IDS.KEEP_IN_MODAL,
  },
  {
    id: MODAL_TOUCHPOINT_IDS.DIAGNOSTIC_PREVIEW_COMPOSITION,
    description: 'Modal composes impact and replay preview cards in the current flow.',
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.CHILD_COMPONENT_COMPOSITION,
    extractionTargetId: MODAL_EXTRACTION_TARGET_IDS.DIAGNOSTIC_PREVIEW_SURFACES,
    decisionId: MODAL_ORCHESTRATION_DECISION_IDS.RECLASSIFY_OR_DELETE_AFTER_ENGINE_CUTLINE,
  },
  {
    id: MODAL_TOUCHPOINT_IDS.ADVANCED_SCORING_COMPOSITION,
    description: 'Modal composes advanced scoring controls.',
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.CHILD_COMPONENT_COMPOSITION,
    extractionTargetId: MODAL_EXTRACTION_TARGET_IDS.ADVANCED_SCORING_CONTROLS,
    decisionId: MODAL_ORCHESTRATION_DECISION_IDS.RECLASSIFY_OR_DELETE_AFTER_ENGINE_CUTLINE,
  },
  {
    id: MODAL_TOUCHPOINT_IDS.SUMMARY_VIEW_PROJECTION,
    description: 'Modal builds summary view data from the draft.',
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.CHILD_COMPONENT_COMPOSITION,
    extractionTargetId: MODAL_EXTRACTION_TARGET_IDS.SUMMARY_VIEW_PROJECTION,
    decisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_COMPOSABLE,
  },
  {
    id: MODAL_TOUCHPOINT_IDS.LEGACY_TEMPLATE_COMMAND_ADAPTERS,
    description: 'Modal adapts starter-template customization events to current draft commands.',
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.COMMAND_ROUTING_TO_COMPOSABLES,
    extractionTargetId: MODAL_EXTRACTION_TARGET_IDS.LEGACY_COMMAND_ADAPTERS,
    decisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_COMPOSABLE,
  },
  {
    id: MODAL_TOUCHPOINT_IDS.SAVE_FAILURE_BROWSER_ALERT,
    description: 'Modal delegates save-failure presentation to the app toast pattern.',
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.LOADING_ERROR_PRESENTATION,
    extractionTargetId: MODAL_EXTRACTION_TARGET_IDS.SAVE_FAILURE_NOTIFICATION,
    decisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_PRESENTATION_COMPONENT,
  },
]);

const MODAL_PUBLIC_EVENTS = deepFreeze([
  {
    id: MODAL_PUBLIC_EVENT_IDS.UPDATE_MODEL_VALUE,
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.OPEN_CLOSE_LIFECYCLE,
    payloadAuthorityId: MODAL_EVENT_PAYLOAD_AUTHORITY_IDS.VIEW_STATE,
    payloadShape: 'boolean',
    validatorExpected: true,
    notes: 'Vue v-model uses `modelValue` plus `update:modelValue`; the modal only emits visibility state.',
  },
  {
    id: MODAL_PUBLIC_EVENT_IDS.SAVE,
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.SAVE_CANCEL_ACTIONS,
    payloadAuthorityId: MODAL_EVENT_PAYLOAD_AUTHORITY_IDS.DELEGATED_SAVE_PAYLOAD,
    payloadShape: 'legacy-compatible policy payload object built by draft state boundary',
    validatorExpected: true,
    notes: 'The modal can emit a save payload only after delegating construction to `buildSavePayload()`; server validation remains authoritative.',
  },
  {
    id: MODAL_PUBLIC_EVENT_IDS.CLOSE,
    responsibilityId: MODAL_ALLOWED_RESPONSIBILITY_IDS.OPEN_CLOSE_LIFECYCLE,
    payloadAuthorityId: MODAL_EVENT_PAYLOAD_AUTHORITY_IDS.NO_PAYLOAD,
    payloadShape: 'none',
    validatorExpected: true,
    notes: 'Close communicates operator cancellation only and must not carry policy, evidence, or legacy payload data.',
  },
]);

function listModalAllowedResponsibilities() {
  return MODAL_ALLOWED_RESPONSIBILITIES;
}

function getModalAllowedResponsibility(responsibilityId) {
  return MODAL_ALLOWED_RESPONSIBILITIES.find(item => item.id === responsibilityId) || null;
}

function listModalProhibitedResponsibilities() {
  return MODAL_PROHIBITED_RESPONSIBILITIES;
}

function getModalProhibitedResponsibility(responsibilityId) {
  return MODAL_PROHIBITED_RESPONSIBILITIES.find(item => item.id === responsibilityId) || null;
}

function listModalExtractionTargets() {
  return MODAL_EXTRACTION_TARGETS;
}

function getModalExtractionTarget(targetId) {
  return MODAL_EXTRACTION_TARGETS.find(target => target.id === targetId) || null;
}

function listModalTouchpoints() {
  return MODAL_TOUCHPOINTS;
}

function getModalTouchpoint(touchpointId) {
  return MODAL_TOUCHPOINTS.find(touchpoint => touchpoint.id === touchpointId) || null;
}

function listModalPublicEvents() {
  return MODAL_PUBLIC_EVENTS;
}

function getModalPublicEvent(eventId) {
  return MODAL_PUBLIC_EVENTS.find(event => event.id === eventId) || null;
}

function isModalResponsibilityAllowed(responsibilityId) {
  return Boolean(getModalAllowedResponsibility(responsibilityId));
}

function isModalResponsibilityProhibited(responsibilityId) {
  return Boolean(getModalProhibitedResponsibility(responsibilityId));
}

function evaluateModalResponsibilitySet(responsibilityIds = []) {
  const normalizedIds = Array.isArray(responsibilityIds) ? responsibilityIds : [];
  const prohibitedIds = normalizedIds.filter(isModalResponsibilityProhibited);
  const unknownIds = normalizedIds.filter(responsibilityId => (
    !isModalResponsibilityAllowed(responsibilityId) &&
    !isModalResponsibilityProhibited(responsibilityId)
  ));

  return {
    valid: prohibitedIds.length === 0 && unknownIds.length === 0,
    allowedIds: normalizedIds.filter(isModalResponsibilityAllowed),
    prohibitedIds,
    unknownIds,
  };
}

function buildPolicyBuilderModalBoundarySummary() {
  const modalRecord = classifyPolicyBuilderClientPath('client/src/components/policies/PolicyBuilderModal.vue');

  return {
    path: modalRecord.path,
    category: modalRecord.category,
    expectedCategory: POLICY_BUILDER_BOUNDARY_CATEGORIES.UI_ORCHESTRATION,
    mixedBoundary: modalRecord.mixedBoundary,
    allowedResponsibilityIds: MODAL_ALLOWED_RESPONSIBILITIES.map(item => item.id),
    prohibitedResponsibilityIds: MODAL_PROHIBITED_RESPONSIBILITIES.map(item => item.id),
    extractionTargetIds: MODAL_EXTRACTION_TARGETS.map(item => item.id),
    touchpointIds: MODAL_TOUCHPOINTS.map(item => item.id),
    publicEventIds: MODAL_PUBLIC_EVENTS.map(item => item.id),
  };
}

function validateModalPublicEvent(event = {}) {
  const issues = [];

  if (!Object.values(MODAL_PUBLIC_EVENT_IDS).includes(event.id)) {
    issues.push({
      riskId: MODAL_ORCHESTRATION_AUDIT_RISK_IDS.UNKNOWN_PUBLIC_EVENT,
      eventId: event.id || null,
      message: 'Modal public event is not part of the modal orchestration event contract.',
    });
  }

  if (!isModalResponsibilityAllowed(event.responsibilityId)) {
    issues.push({
      riskId: MODAL_ORCHESTRATION_AUDIT_RISK_IDS.INVALID_EVENT_RESPONSIBILITY,
      eventId: event.id || null,
      responsibilityId: event.responsibilityId || null,
      message: 'Modal public event must map to an allowed orchestration responsibility.',
    });
  }

  if (event.id === MODAL_PUBLIC_EVENT_IDS.SAVE &&
      event.payloadAuthorityId !== MODAL_EVENT_PAYLOAD_AUTHORITY_IDS.DELEGATED_SAVE_PAYLOAD) {
    issues.push({
      riskId: MODAL_ORCHESTRATION_AUDIT_RISK_IDS.EVENT_PAYLOAD_NOT_DELEGATED,
      eventId: event.id,
      payloadAuthorityId: event.payloadAuthorityId || null,
      message: 'Modal save events must use delegated save payload authority.',
    });
  }

  if (event.validatorExpected !== true) {
    issues.push({
      riskId: MODAL_ORCHESTRATION_AUDIT_RISK_IDS.INVALID_EVENT_VALIDATOR_EXPECTATION,
      eventId: event.id || null,
      message: 'Modal public events must expect a runtime emit validator.',
    });
  }

  return {
    ok: issues.length === 0,
    eventId: event.id || null,
    issues,
  };
}

function buildPolicyBuilderModalPublicEventAudit(events = MODAL_PUBLIC_EVENTS) {
  const normalizedEvents = Array.isArray(events) ? events : [];
  const eventResults = normalizedEvents.map(validateModalPublicEvent);
  const issues = eventResults.flatMap(result => result.issues);

  return {
    ok: issues.length === 0,
    checkedCount: eventResults.length,
    issues,
    eventResults,
  };
}

function buildPolicyBuilderModalOrchestrationAudit(touchpoints = MODAL_TOUCHPOINTS) {
  const normalizedTouchpoints = Array.isArray(touchpoints) ? touchpoints : [];
  const knownTouchpointIds = MODAL_TOUCHPOINTS.map(touchpoint => touchpoint.id);
  const publicEventAudit = buildPolicyBuilderModalPublicEventAudit();
  const issues = [...publicEventAudit.issues];

  normalizedTouchpoints.forEach((touchpoint) => {
    if (!knownTouchpointIds.includes(touchpoint.id)) {
      issues.push({
        riskId: MODAL_ORCHESTRATION_AUDIT_RISK_IDS.UNKNOWN_TOUCHPOINT,
        touchpointId: touchpoint.id,
        message: 'Modal touchpoint is not part of the modal orchestration contract.',
      });
    }

    if (isModalResponsibilityProhibited(touchpoint.responsibilityId)) {
      issues.push({
        riskId: MODAL_ORCHESTRATION_AUDIT_RISK_IDS.PROHIBITED_RESPONSIBILITY,
        touchpointId: touchpoint.id,
        responsibilityId: touchpoint.responsibilityId,
        message: 'Modal touchpoint is mapped to a prohibited responsibility.',
      });
    }

    if (touchpoint.extractionTargetId && !getModalExtractionTarget(touchpoint.extractionTargetId)) {
      issues.push({
        riskId: MODAL_ORCHESTRATION_AUDIT_RISK_IDS.UNMAPPED_EXTRACTION_TARGET,
        touchpointId: touchpoint.id,
        extractionTargetId: touchpoint.extractionTargetId,
        message: 'Modal touchpoint references an unknown extraction target.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    checkedCount: normalizedTouchpoints.length,
    publicEventAudit,
    extractionTouchpointIds: normalizedTouchpoints
      .filter(touchpoint => Boolean(touchpoint.extractionTargetId))
      .map(touchpoint => touchpoint.id),
    issues,
  };
}

export {
  MODAL_ALLOWED_RESPONSIBILITY_IDS,
  MODAL_EXTRACTION_TARGET_IDS,
  MODAL_EVENT_PAYLOAD_AUTHORITY_IDS,
  MODAL_ORCHESTRATION_AUDIT_RISK_IDS,
  MODAL_ORCHESTRATION_DECISION_IDS,
  MODAL_PROHIBITED_RESPONSIBILITY_IDS,
  MODAL_PUBLIC_EVENT_IDS,
  MODAL_TARGET_BOUNDARY_IDS,
  MODAL_TOUCHPOINT_IDS,
  buildPolicyBuilderModalPublicEventAudit,
  buildPolicyBuilderModalOrchestrationAudit,
  buildPolicyBuilderModalBoundarySummary,
  evaluateModalResponsibilitySet,
  getModalAllowedResponsibility,
  getModalExtractionTarget,
  getModalProhibitedResponsibility,
  getModalPublicEvent,
  getModalTouchpoint,
  isModalResponsibilityAllowed,
  isModalResponsibilityProhibited,
  listModalAllowedResponsibilities,
  listModalExtractionTargets,
  listModalProhibitedResponsibilities,
  listModalPublicEvents,
  listModalTouchpoints,
  validateModalPublicEvent,
};
