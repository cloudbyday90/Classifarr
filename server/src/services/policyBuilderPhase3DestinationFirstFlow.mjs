import {
  PHASE_3R_WORKFLOW_ROLE_IDS,
} from './policyBuilderPhase3WorkflowInventory.mjs';

const PHASE_3R_DESTINATION_FLOW_STEP_IDS = Object.freeze({
  SELECT_LIBRARY: 'select_library',
  REVIEW_OBSERVED_DESTINATION: 'review_observed_destination',
  ACCEPT_OR_EDIT_DECLARED_INTENT: 'accept_or_edit_declared_intent',
  CONFIRM_HARD_LIMITS: 'confirm_hard_limits',
  CONFIRM_ROUTING_READINESS: 'confirm_routing_readiness',
  SAVE_OR_DEFER: 'save_or_defer',
});

const PHASE_3R_DESTINATION_QUESTION_IDS = Object.freeze({
  WHAT_BELONGS_HERE: 'what_belongs_here',
  WHAT_SHOULD_NOT_GO_HERE: 'what_should_not_go_here',
  WHAT_HELPS_BUT_DOES_NOT_DECIDE: 'what_helps_but_does_not_decide',
  WHEN_SHOULD_CLASSIFARR_ASK: 'when_should_classifarr_ask',
  CAN_THIS_ROUTE: 'can_this_route',
});

const PHASE_3R_DESTINATION_EMPTY_STATE_IDS = Object.freeze({
  NEW_LIBRARY: 'new_library',
  SPARSE_LIBRARY: 'sparse_library',
  UNMAPPED_LIBRARY: 'unmapped_library',
});

const PHASE_3R_DESTINATION_NEXT_ACTION_IDS = Object.freeze({
  SELECT_CONNECTED_LIBRARY: 'select_connected_library',
  SYNC_MEDIA_SERVER_LIBRARY: 'sync_media_server_library',
  REVIEW_OBSERVED_PROFILE: 'review_observed_profile',
  ACCEPT_OBSERVED_SUGGESTIONS: 'accept_observed_suggestions',
  ADD_DECLARED_INTENT: 'add_declared_intent',
  CONFIRM_HARD_LIMITS: 'confirm_hard_limits',
  MAP_ROUTING_DESTINATION: 'map_routing_destination',
  SAVE_POLICY: 'save_policy',
  DEFER_POLICY: 'defer_policy',
});

const PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS = Object.freeze({
  STARTER_TEMPLATE_FIRST: 'starter_template_first',
  RAW_SCORING_WEIGHTS: 'raw_scoring_weights',
  REPLAY_OR_PROVIDER_DIAGNOSTICS: 'replay_or_provider_diagnostics',
  LEGACY_PRESET_INTERNALS: 'legacy_preset_internals',
  RAW_BRIDGE_STORAGE: 'raw_bridge_storage',
});

const PHASE_3R_DESTINATION_RISK_IDS = Object.freeze({
  MISSING_STEP: 'missing_step',
  WRONG_STEP_ORDER: 'wrong_step_order',
  TEMPLATE_BEFORE_DESTINATION: 'template_before_destination',
  EMPTY_STATE_WITHOUT_ACTION: 'empty_state_without_action',
  INTERNAL_MECHANIC_IN_NORMAL_FLOW: 'internal_mechanic_in_normal_flow',
  UNKNOWN_FLOW_ARTIFACT: 'unknown_flow_artifact',
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

const PHASE_3R_DESTINATION_FLOW_STEPS = deepFreeze([
  {
    id: PHASE_3R_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
    order: 1,
    roleId: PHASE_3R_WORKFLOW_ROLE_IDS.WORKFLOW_SHELL,
    primaryQuestionId: null,
    requiredNextActionIds: [
      PHASE_3R_DESTINATION_NEXT_ACTION_IDS.SELECT_CONNECTED_LIBRARY,
    ],
    allowsStarterTemplates: false,
    allowsAdvancedMechanics: false,
    operatorOutcome: 'A connected media-server library is selected as the destination source of truth.',
  },
  {
    id: PHASE_3R_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
    order: 2,
    roleId: PHASE_3R_WORKFLOW_ROLE_IDS.DESTINATION_CONTEXT,
    primaryQuestionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    requiredNextActionIds: [
      PHASE_3R_DESTINATION_NEXT_ACTION_IDS.REVIEW_OBSERVED_PROFILE,
    ],
    allowsStarterTemplates: false,
    allowsAdvancedMechanics: false,
    operatorOutcome: 'The operator sees what already appears to belong in this destination before policy mechanics.',
  },
  {
    id: PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    order: 3,
    roleId: PHASE_3R_WORKFLOW_ROLE_IDS.DECLARED_INTENT_EDITING,
    primaryQuestionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_HELPS_BUT_DOES_NOT_DECIDE,
    requiredNextActionIds: [
      PHASE_3R_DESTINATION_NEXT_ACTION_IDS.ACCEPT_OBSERVED_SUGGESTIONS,
      PHASE_3R_DESTINATION_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
    ],
    allowsStarterTemplates: true,
    allowsAdvancedMechanics: false,
    operatorOutcome: 'Observed suggestions or starter-template hints become declared intent only after explicit acceptance.',
  },
  {
    id: PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
    order: 4,
    roleId: PHASE_3R_WORKFLOW_ROLE_IDS.DECLARED_INTENT_EDITING,
    primaryQuestionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    requiredNextActionIds: [
      PHASE_3R_DESTINATION_NEXT_ACTION_IDS.CONFIRM_HARD_LIMITS,
    ],
    allowsStarterTemplates: false,
    allowsAdvancedMechanics: false,
    operatorOutcome: 'Blocking constraints are explicit and not inferred from absence or broad hints.',
  },
  {
    id: PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
    order: 5,
    roleId: PHASE_3R_WORKFLOW_ROLE_IDS.READINESS_NEXT_ACTION,
    primaryQuestionId: PHASE_3R_DESTINATION_QUESTION_IDS.CAN_THIS_ROUTE,
    requiredNextActionIds: [
      PHASE_3R_DESTINATION_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
    ],
    allowsStarterTemplates: false,
    allowsAdvancedMechanics: false,
    operatorOutcome: 'Routing readiness is expressed as a next action, not provider diagnostics or replay mechanics.',
  },
  {
    id: PHASE_3R_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
    order: 6,
    roleId: PHASE_3R_WORKFLOW_ROLE_IDS.WORKFLOW_SHELL,
    primaryQuestionId: null,
    requiredNextActionIds: [
      PHASE_3R_DESTINATION_NEXT_ACTION_IDS.SAVE_POLICY,
      PHASE_3R_DESTINATION_NEXT_ACTION_IDS.DEFER_POLICY,
    ],
    allowsStarterTemplates: false,
    allowsAdvancedMechanics: false,
    operatorOutcome: 'The operator saves a clear destination intent or defers without creating ambiguous policy state.',
  },
]);

const PHASE_3R_DESTINATION_QUESTIONS = deepFreeze([
  {
    id: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    label: 'What belongs here?',
    intentField: 'belongs_here',
    normalPath: true,
    acceptsObservedEvidence: true,
    requiresExplicitAcceptance: true,
    notes: 'Use observed library profile values as suggestions, not automatic rules.',
  },
  {
    id: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    label: 'What should not go here?',
    intentField: 'avoid_or_hard_limits',
    normalPath: true,
    acceptsObservedEvidence: false,
    requiresExplicitAcceptance: true,
    notes: 'Hard limits and avoid rules require declared operator intent.',
  },
  {
    id: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_HELPS_BUT_DOES_NOT_DECIDE,
    label: 'What helps but should not decide alone?',
    intentField: 'helpful_matches',
    normalPath: true,
    acceptsObservedEvidence: true,
    requiresExplicitAcceptance: true,
    notes: 'Soft evidence can improve fit but cannot become a destination rule by itself.',
  },
  {
    id: PHASE_3R_DESTINATION_QUESTION_IDS.WHEN_SHOULD_CLASSIFARR_ASK,
    label: 'When should Classifarr ask?',
    intentField: 'review_triggers',
    normalPath: true,
    acceptsObservedEvidence: false,
    requiresExplicitAcceptance: true,
    notes: 'Review triggers describe uncertainty and should not be hidden behind confidence internals.',
  },
  {
    id: PHASE_3R_DESTINATION_QUESTION_IDS.CAN_THIS_ROUTE,
    label: 'Can this route?',
    intentField: 'routing_readiness',
    normalPath: true,
    acceptsObservedEvidence: false,
    requiresExplicitAcceptance: false,
    notes: 'Routing readiness points to configuration actions instead of exposing provider or replay diagnostics.',
  },
]);

const PHASE_3R_DESTINATION_EMPTY_STATES = deepFreeze([
  {
    id: PHASE_3R_DESTINATION_EMPTY_STATE_IDS.NEW_LIBRARY,
    label: 'New library',
    description: 'No observed profile is available yet.',
    nextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.SYNC_MEDIA_SERVER_LIBRARY,
    internalDetailsAllowed: false,
  },
  {
    id: PHASE_3R_DESTINATION_EMPTY_STATE_IDS.SPARSE_LIBRARY,
    label: 'Sparse library',
    description: 'Observed profile has too few examples to safely suggest intent.',
    nextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.ADD_DECLARED_INTENT,
    internalDetailsAllowed: false,
  },
  {
    id: PHASE_3R_DESTINATION_EMPTY_STATE_IDS.UNMAPPED_LIBRARY,
    label: 'Unmapped library',
    description: 'This destination cannot route until it is mapped to an Arr root folder.',
    nextActionId: PHASE_3R_DESTINATION_NEXT_ACTION_IDS.MAP_ROUTING_DESTINATION,
    internalDetailsAllowed: false,
  },
]);

const PHASE_3R_DESTINATION_FORBIDDEN_MECHANICS = deepFreeze([
  {
    id: PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.STARTER_TEMPLATE_FIRST,
    riskId: PHASE_3R_DESTINATION_RISK_IDS.TEMPLATE_BEFORE_DESTINATION,
    reason: 'Starter templates can fill gaps only after destination context is visible.',
  },
  {
    id: PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_SCORING_WEIGHTS,
    riskId: PHASE_3R_DESTINATION_RISK_IDS.INTERNAL_MECHANIC_IN_NORMAL_FLOW,
    reason: 'Raw scoring weights make operators tune internals instead of declaring destination intent.',
  },
  {
    id: PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.REPLAY_OR_PROVIDER_DIAGNOSTICS,
    riskId: PHASE_3R_DESTINATION_RISK_IDS.INTERNAL_MECHANIC_IN_NORMAL_FLOW,
    reason: 'Replay and provider readiness belong to verifier/support flows, not normal authoring.',
  },
  {
    id: PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.LEGACY_PRESET_INTERNALS,
    riskId: PHASE_3R_DESTINATION_RISK_IDS.INTERNAL_MECHANIC_IN_NORMAL_FLOW,
    reason: 'Legacy preset internals are compatibility details, not product language.',
  },
  {
    id: PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS.RAW_BRIDGE_STORAGE,
    riskId: PHASE_3R_DESTINATION_RISK_IDS.INTERNAL_MECHANIC_IN_NORMAL_FLOW,
    reason: 'Raw bridge storage must remain hidden behind draft commands and server validation.',
  },
]);

function listPhase3RDestinationFlowSteps() {
  return PHASE_3R_DESTINATION_FLOW_STEPS;
}

function listPhase3RDestinationQuestions() {
  return PHASE_3R_DESTINATION_QUESTIONS;
}

function listPhase3RDestinationEmptyStates() {
  return PHASE_3R_DESTINATION_EMPTY_STATES;
}

function listPhase3RDestinationForbiddenMechanics() {
  return PHASE_3R_DESTINATION_FORBIDDEN_MECHANICS;
}

function getPhase3RDestinationFlowStep(stepId) {
  return PHASE_3R_DESTINATION_FLOW_STEPS.find(step => step.id === stepId) || null;
}

function getPhase3RDestinationQuestion(questionId) {
  return PHASE_3R_DESTINATION_QUESTIONS.find(question => question.id === questionId) || null;
}

function getPhase3RDestinationEmptyState(emptyStateId) {
  return PHASE_3R_DESTINATION_EMPTY_STATES.find(emptyState => emptyState.id === emptyStateId) || null;
}

function validatePhase3RDestinationFlowSequence(stepIds = []) {
  const expectedStepIds = PHASE_3R_DESTINATION_FLOW_STEPS.map(step => step.id);
  const missingStepIds = expectedStepIds.filter(stepId => !stepIds.includes(stepId));
  const unknownStepIds = stepIds.filter(stepId => !expectedStepIds.includes(stepId));
  const wrongOrder = stepIds.some((stepId, index) => expectedStepIds[index] !== stepId);

  if (missingStepIds.length > 0) {
    return {
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.MISSING_STEP,
      missingStepIds,
      unknownStepIds,
      reason: 'Destination-first flow is missing required steps.',
    };
  }

  if (unknownStepIds.length > 0) {
    return {
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.UNKNOWN_FLOW_ARTIFACT,
      missingStepIds,
      unknownStepIds,
      reason: 'Destination-first flow includes unknown steps.',
    };
  }

  if (wrongOrder) {
    return {
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.WRONG_STEP_ORDER,
      missingStepIds,
      unknownStepIds,
      reason: 'Destination-first flow steps are out of order.',
    };
  }

  return {
    valid: true,
    riskId: null,
    missingStepIds: [],
    unknownStepIds: [],
    reason: 'Destination-first flow sequence matches the Phase 3R.2 contract.',
  };
}

function validatePhase3RStarterTemplatePlacement(stepId) {
  const step = getPhase3RDestinationFlowStep(stepId);
  if (!step) {
    return {
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.UNKNOWN_FLOW_ARTIFACT,
      reason: 'Unknown destination-first flow step.',
    };
  }

  if (step.order < 3 && step.allowsStarterTemplates) {
    return {
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.TEMPLATE_BEFORE_DESTINATION,
      reason: 'Starter templates cannot appear before destination context and observed meaning.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Starter-template placement stays behind destination context.',
  };
}

function validatePhase3REmptyStateNextAction(emptyStateId) {
  const emptyState = getPhase3RDestinationEmptyState(emptyStateId);
  if (!emptyState) {
    return {
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.UNKNOWN_FLOW_ARTIFACT,
      reason: 'Unknown destination-first empty state.',
    };
  }

  if (!emptyState.nextActionId || emptyState.internalDetailsAllowed) {
    return {
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.EMPTY_STATE_WITHOUT_ACTION,
      reason: 'Empty state must show an operator next action instead of internals.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Empty state has a bounded operator next action.',
  };
}

function validatePhase3RForbiddenMechanic(mechanicId) {
  const mechanic = PHASE_3R_DESTINATION_FORBIDDEN_MECHANICS
    .find(record => record.id === mechanicId);

  if (!mechanic) {
    return {
      valid: false,
      riskId: PHASE_3R_DESTINATION_RISK_IDS.UNKNOWN_FLOW_ARTIFACT,
      reason: 'Unknown destination-first forbidden mechanic.',
    };
  }

  return {
    valid: false,
    riskId: mechanic.riskId,
    reason: mechanic.reason,
  };
}

function summarizePhase3RDestinationFirstFlow() {
  const steps = listPhase3RDestinationFlowSteps();
  const questionIds = listPhase3RDestinationQuestions().map(question => question.id);
  const emptyStateIds = listPhase3RDestinationEmptyStates().map(emptyState => emptyState.id);
  const forbiddenMechanicIds = listPhase3RDestinationForbiddenMechanics().map(mechanic => mechanic.id);
  const templateStepIds = steps.filter(step => step.allowsStarterTemplates).map(step => step.id);
  const advancedMechanicStepIds = steps.filter(step => step.allowsAdvancedMechanics).map(step => step.id);

  return {
    stepCount: steps.length,
    questionCount: questionIds.length,
    emptyStateCount: emptyStateIds.length,
    forbiddenMechanicCount: forbiddenMechanicIds.length,
    stepIds: steps.map(step => step.id),
    questionIds,
    emptyStateIds,
    forbiddenMechanicIds,
    templateStepIds,
    advancedMechanicStepIds,
    destinationContextBeforeTemplates: templateStepIds.every(stepId =>
      getPhase3RDestinationFlowStep(stepId)?.order > 2),
    normalFlowExposesAdvancedMechanics: advancedMechanicStepIds.length > 0,
  };
}

export {
  PHASE_3R_DESTINATION_EMPTY_STATE_IDS,
  PHASE_3R_DESTINATION_FLOW_STEP_IDS,
  PHASE_3R_DESTINATION_FORBIDDEN_MECHANIC_IDS,
  PHASE_3R_DESTINATION_NEXT_ACTION_IDS,
  PHASE_3R_DESTINATION_QUESTION_IDS,
  PHASE_3R_DESTINATION_RISK_IDS,
  getPhase3RDestinationEmptyState,
  getPhase3RDestinationFlowStep,
  getPhase3RDestinationQuestion,
  listPhase3RDestinationEmptyStates,
  listPhase3RDestinationFlowSteps,
  listPhase3RDestinationForbiddenMechanics,
  listPhase3RDestinationQuestions,
  summarizePhase3RDestinationFirstFlow,
  validatePhase3RDestinationFlowSequence,
  validatePhase3REmptyStateNextAction,
  validatePhase3RForbiddenMechanic,
  validatePhase3RStarterTemplatePlacement,
};
