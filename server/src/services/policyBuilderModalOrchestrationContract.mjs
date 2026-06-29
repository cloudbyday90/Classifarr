import {
  POLICY_BUILDER_BOUNDARY_CATEGORIES,
  POLICY_BUILDER_BOUNDARY_RISK_IDS,
  classifyPolicyBuilderClientPath,
} from './policyBuilderPhase1BoundaryInventory.mjs';

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
  RECLASSIFY_OR_DELETE_AFTER_PHASE_6R: 'reclassify_or_delete_after_phase_6r',
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
    targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.RECLASSIFY_OR_DELETE_AFTER_PHASE_6R,
    targetPhase: '6R',
    reason: 'Impact and replay previews are diagnostics; Phase 6R must classify them as engine primitives, migration verifiers, or deletion candidates.',
    relatedRiskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
    ],
  },
  {
    id: MODAL_EXTRACTION_TARGET_IDS.ADVANCED_SCORING_CONTROLS,
    currentOwner: 'PolicyBuilderModal.vue composes advanced scoring and weight controls.',
    targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.RECLASSIFY_OR_DELETE_AFTER_PHASE_6R,
    targetPhase: '3R/6R',
    reason: 'Advanced scoring controls conflict with destination-first policy setup unless later phases reframe or remove them.',
    relatedRiskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.DIAGNOSTIC_PRODUCT_SURFACE,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.CLIENT_ENGINE_LOGIC,
    ],
  },
  {
    id: MODAL_EXTRACTION_TARGET_IDS.SUMMARY_VIEW_PROJECTION,
    currentOwner: 'PolicyBuilderModal.vue builds intent summary view data from the current draft.',
    targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_COMPOSABLE,
    targetPhase: '1R.2',
    reason: 'Summary projection should be treated as display state and moved behind a focused orchestration/view-model boundary when the modal is narrowed.',
    relatedRiskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
  },
  {
    id: MODAL_EXTRACTION_TARGET_IDS.LEGACY_COMMAND_ADAPTERS,
    currentOwner: 'PolicyBuilderModal.vue adapts starter-template custom-signal events into draft commands.',
    targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_COMPOSABLE,
    targetPhase: '1R.5',
    reason: 'The modal can route commands temporarily, but legacy terminology and payload adaptation should be contained by bridge ownership.',
    relatedRiskIds: [
      POLICY_BUILDER_BOUNDARY_RISK_IDS.LEGACY_PAYLOAD_TOUCHPOINT,
      POLICY_BUILDER_BOUNDARY_RISK_IDS.MIXED_BOUNDARY,
    ],
  },
  {
    id: MODAL_EXTRACTION_TARGET_IDS.SAVE_FAILURE_NOTIFICATION,
    currentOwner: 'PolicyBuilderModal.vue uses a browser alert after save failure.',
    targetDecisionId: MODAL_ORCHESTRATION_DECISION_IDS.MOVE_TO_PRESENTATION_COMPONENT,
    targetPhase: '1R.2',
    reason: 'Save failure is allowed presentation, but it should use the app notification pattern instead of direct browser alerting.',
    relatedRiskIds: [],
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
  };
}

export {
  MODAL_ALLOWED_RESPONSIBILITY_IDS,
  MODAL_EXTRACTION_TARGET_IDS,
  MODAL_ORCHESTRATION_DECISION_IDS,
  MODAL_PROHIBITED_RESPONSIBILITY_IDS,
  buildPolicyBuilderModalBoundarySummary,
  evaluateModalResponsibilitySet,
  getModalAllowedResponsibility,
  getModalExtractionTarget,
  getModalProhibitedResponsibility,
  isModalResponsibilityAllowed,
  isModalResponsibilityProhibited,
  listModalAllowedResponsibilities,
  listModalExtractionTargets,
  listModalProhibitedResponsibilities,
};
