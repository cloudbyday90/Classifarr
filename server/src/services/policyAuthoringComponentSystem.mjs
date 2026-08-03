import {
  POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS,
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from './policyAuthoringDestinationFlow.mjs';

const POLICY_AUTHORING_COMPONENT_IDS = Object.freeze({
  DESTINATION_CONTEXT_CARD: 'destination_context_card',
  OBSERVED_PROFILE_SUMMARY: 'observed_profile_summary',
  DESTINATION_PROPOSAL_CARD: 'destination_proposal_card',
  INTENT_SIGNAL_PICKER: 'intent_signal_picker',
  INTENT_SIGNAL_CHIP_LIST: 'intent_signal_chip_list',
  HARD_LIMIT_CONTROL: 'hard_limit_control',
  AVOID_CONTROL: 'avoid_control',
  REVIEW_TRIGGER_CONTROL: 'review_trigger_control',
  DESTINATION_EMPTY_STATE_NOTICE: 'destination_empty_state_notice',
  STARTER_TEMPLATE_SUGGESTION: 'starter_template_suggestion',
});

const POLICY_AUTHORING_PRIMITIVE_IDS = Object.freeze({
  MODAL_AND_SECTION_CONTAINER: 'modal_and_section_container',
  SUMMARY_AND_READINESS_CARD: 'summary_and_readiness_card',
  WARNING_AND_NEXT_ACTION_MESSAGE: 'warning_and_next_action_message',
  OPTION_SELECT: 'option_select',
  MULTI_SELECT_AND_CHIP_CONTROL: 'multi_select_and_chip_control',
  ACTION_BUTTON: 'action_button',
  OBSERVED_PROFILE_SUGGESTION_ROW: 'observed_profile_suggestion_row',
  EMPTY_LOADING_ERROR_STATE: 'empty_loading_error_state',
  TEMPLATE_DETAIL_AND_MECHANICS_SURFACE: 'template_detail_and_mechanics_surface',
});

const POLICY_AUTHORING_COMPONENT_DECISION_IDS = Object.freeze({
  KEEP_AS_PRIMITIVE: 'keep_as_primitive',
  REWRITE_AS_TARGET: 'rewrite_as_target',
  REPLACE_WITH_TARGET: 'replace_with_target',
  DELETE_FROM_NORMAL_PATH: 'delete_from_normal_path',
});

const POLICY_AUTHORING_OPTION_SOURCE_IDS = Object.freeze({
  OBSERVED_IN_LIBRARY: 'observed_in_library',
  SUGGESTED_FROM_OBSERVED_PROFILE: 'suggested_from_observed_profile',
  SUGGESTED_FROM_STARTER_TEMPLATE: 'suggested_from_starter_template',
  COMMON_STATIC_OPTION: 'common_static_option',
  OPERATOR_ADDED_CUSTOM: 'operator_added_custom',
  ALREADY_DECLARED: 'already_declared',
  UNAVAILABLE_CONFLICTING_INTENT: 'unavailable_conflicting_intent',
});

const POLICY_AUTHORING_INTERACTION_RULE_IDS = Object.freeze({
  ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS: 'add_values_through_typed_draft_commands',
  REMOVE_VALUES_THROUGH_TYPED_DRAFT_COMMANDS: 'remove_values_through_typed_draft_commands',
  DISABLED_CHOICES_EXPLAIN_REASON: 'disabled_choices_explain_reason',
  DESTRUCTIVE_OR_BLOCKING_REQUIRES_CONFIRMATION: 'destructive_or_blocking_requires_confirmation',
  READINESS_LINKS_TO_RESOLVING_COMPONENT: 'readiness_links_to_resolving_component',
  OBSERVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE: 'observed_values_require_explicit_acceptance',
  PREPARED_PROPOSAL_REQUIRES_SERVER_ADMISSION: 'prepared_proposal_requires_server_admission',
});

const POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS = Object.freeze({
  KEYBOARD_OPERABLE: 'keyboard_operable',
  VISIBLE_LABEL_AND_DESCRIPTION: 'visible_label_and_description',
  MULTI_SELECT_STATE_ANNOUNCED: 'multi_select_state_announced',
  FOCUS_VISIBLE_AND_NOT_OBSCURED: 'focus_visible_and_not_obscured',
  TARGET_SIZE_MINIMUM: 'target_size_minimum',
  ERROR_AND_DISABLED_REASON_PROGRAMMATIC: 'error_and_disabled_reason_programmatic',
});

const POLICY_AUTHORING_COMPONENT_RISK_IDS = Object.freeze({
  UNKNOWN_COMPONENT: 'unknown_component',
  UNKNOWN_PRIMITIVE: 'unknown_primitive',
  UNKNOWN_OPTION_SOURCE: 'unknown_option_source',
  UNKNOWN_INTERACTION_RULE: 'unknown_interaction_rule',
  UNKNOWN_ACCESSIBILITY_RULE: 'unknown_accessibility_rule',
  OBSERVED_EVIDENCE_AUTO_DECLARED: 'observed_evidence_auto_declared',
  RAW_LEGACY_MECHANIC_IN_NORMAL_PATH: 'raw_legacy_mechanic_in_normal_path',
  UNEXPLAINED_DISABLED_CHOICE: 'unexplained_disabled_choice',
  INACCESSIBLE_CUSTOM_CONTROL: 'inaccessible_custom_control',
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

const POLICY_AUTHORING_TARGET_COMPONENTS = deepFreeze([
  {
    id: POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
    label: 'DestinationContextCard',
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
    questionId: null,
    normalPath: true,
    defaultMultiSelect: false,
    acceptsObservedEvidence: true,
    commandBoundaryRequired: false,
    notes: 'Selects or displays the connected destination library before any policy mechanics.',
  },
  {
    id: POLICY_AUTHORING_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
    label: 'ObservedProfileSummary',
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    normalPath: true,
    defaultMultiSelect: false,
    acceptsObservedEvidence: true,
    commandBoundaryRequired: false,
    notes: 'Shows observed library evidence as read-only context and suggestion source.',
  },
  {
    id: POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_PROPOSAL_CARD,
    label: 'PolicyDestinationProposalCard',
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.SAVE_OR_DEFER,
    questionId: null,
    normalPath: true,
    defaultMultiSelect: false,
    acceptsObservedEvidence: true,
    commandBoundaryRequired: true,
    notes: 'Explains one server-derived proposed destination and admits it through the opaque revision-bound server action without exposing a generic rule picker.',
  },
  {
    id: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    label: 'IntentSignalPicker',
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    normalPath: true,
    defaultMultiSelect: true,
    acceptsObservedEvidence: true,
    commandBoundaryRequired: true,
    notes: 'Adds simple belongs-here and helpful-match values through typed draft commands.',
  },
  {
    id: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
    label: 'IntentSignalChipList',
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    normalPath: true,
    defaultMultiSelect: true,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: true,
    notes: 'Displays declared values and removes them through typed draft commands.',
  },
  {
    id: POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    label: 'HardLimitControl',
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    normalPath: true,
    defaultMultiSelect: false,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: true,
    notes: 'Confirms blocking constraints with explicit operator action.',
  },
  {
    id: POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
    label: 'AvoidControl',
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    normalPath: true,
    defaultMultiSelect: true,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: true,
    notes: 'Adds avoid values explicitly and never infers absence as exclusion.',
  },
  {
    id: POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    label: 'ReviewTriggerControl',
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHEN_SHOULD_CLASSIFARR_ASK,
    normalPath: true,
    defaultMultiSelect: true,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: true,
    notes: 'Defines uncertainty triggers without exposing raw confidence internals.',
  },
  {
    id: POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
    label: 'PolicyDestinationEmptyStateNotice',
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
    questionId: null,
    normalPath: true,
    defaultMultiSelect: false,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: false,
    notes: 'Shows one bounded next action within the destination question that owns an empty or routing state.',
  },
  {
    id: POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
    label: 'StarterTemplateSuggestion',
    flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_HELPS_BUT_DOES_NOT_DECIDE,
    normalPath: false,
    defaultMultiSelect: false,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: true,
    notes: 'Offers template-derived suggestions after destination context without becoming the primary model.',
  },
]);

const POLICY_AUTHORING_PRIMITIVE_DECISIONS = deepFreeze([
  {
    primitiveId: POLICY_AUTHORING_PRIMITIVE_IDS.MODAL_AND_SECTION_CONTAINER,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REWRITE_AS_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
    ],
    normalPath: true,
  },
  {
    primitiveId: POLICY_AUTHORING_PRIMITIVE_IDS.SUMMARY_AND_READINESS_CARD,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REPLACE_WITH_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
    ],
    normalPath: true,
  },
  {
    primitiveId: POLICY_AUTHORING_PRIMITIVE_IDS.WARNING_AND_NEXT_ACTION_MESSAGE,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REWRITE_AS_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
      POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    ],
    normalPath: true,
  },
  {
    primitiveId: POLICY_AUTHORING_PRIMITIVE_IDS.OPTION_SELECT,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REPLACE_WITH_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
    ],
    normalPath: true,
  },
  {
    primitiveId: POLICY_AUTHORING_PRIMITIVE_IDS.MULTI_SELECT_AND_CHIP_CONTROL,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    ],
    normalPath: true,
  },
  {
    primitiveId: POLICY_AUTHORING_PRIMITIVE_IDS.ACTION_BUTTON,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
      POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    ],
    normalPath: true,
  },
  {
    primitiveId: POLICY_AUTHORING_PRIMITIVE_IDS.OBSERVED_PROFILE_SUGGESTION_ROW,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REWRITE_AS_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    ],
    normalPath: true,
  },
  {
    primitiveId: POLICY_AUTHORING_PRIMITIVE_IDS.EMPTY_LOADING_ERROR_STATE,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.REWRITE_AS_TARGET,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
    ],
    normalPath: true,
  },
  {
    primitiveId: POLICY_AUTHORING_PRIMITIVE_IDS.TEMPLATE_DETAIL_AND_MECHANICS_SURFACE,
    decisionId: POLICY_AUTHORING_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
    ],
    normalPath: false,
  },
]);

const POLICY_AUTHORING_OPTION_SOURCE_RECORDS = deepFreeze([
  {
    id: POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
    visibleGroupLabel: 'Already in this library',
    canAutoDeclare: false,
    selectable: true,
    requiresExplanation: true,
  },
  {
    id: POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
    visibleGroupLabel: 'Suggested from this library',
    canAutoDeclare: false,
    selectable: true,
    requiresExplanation: true,
  },
  {
    id: POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
    visibleGroupLabel: 'Suggested by starter template',
    canAutoDeclare: false,
    selectable: true,
    requiresExplanation: true,
  },
  {
    id: POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
    visibleGroupLabel: 'Common options',
    canAutoDeclare: false,
    selectable: true,
    requiresExplanation: false,
  },
  {
    id: POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
    visibleGroupLabel: 'Custom value',
    canAutoDeclare: false,
    selectable: true,
    requiresExplanation: true,
  },
  {
    id: POLICY_AUTHORING_OPTION_SOURCE_IDS.ALREADY_DECLARED,
    visibleGroupLabel: 'Already added',
    canAutoDeclare: false,
    selectable: false,
    requiresExplanation: true,
  },
  {
    id: POLICY_AUTHORING_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT,
    visibleGroupLabel: 'Unavailable',
    canAutoDeclare: false,
    selectable: false,
    requiresExplanation: true,
  },
]);

const POLICY_AUTHORING_INTERACTION_RULES = deepFreeze([
  {
    id: POLICY_AUTHORING_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
    requiredForComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
    ],
    notes: 'Adding values must emit typed commands instead of mutating raw bridge payloads.',
  },
  {
    id: POLICY_AUTHORING_INTERACTION_RULE_IDS.REMOVE_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
    requiredForComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    ],
    notes: 'Removing values must emit typed commands and preserve provenance.',
  },
  {
    id: POLICY_AUTHORING_INTERACTION_RULE_IDS.DISABLED_CHOICES_EXPLAIN_REASON,
    requiredForComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
    ],
    notes: 'Disabled choices need visible and programmatic reason text.',
  },
  {
    id: POLICY_AUTHORING_INTERACTION_RULE_IDS.DESTRUCTIVE_OR_BLOCKING_REQUIRES_CONFIRMATION,
    requiredForComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
    ],
    notes: 'Controls that can block routing or classification require explicit operator confirmation.',
  },
  {
    id: POLICY_AUTHORING_INTERACTION_RULE_IDS.READINESS_LINKS_TO_RESOLVING_COMPONENT,
    requiredForComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
    ],
    notes: 'Readiness next actions must link to the component that resolves the issue.',
  },
  {
    id: POLICY_AUTHORING_INTERACTION_RULE_IDS.OBSERVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE,
    requiredForComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    ],
    notes: 'Observed evidence may prefill suggestions but never silently becomes declared intent.',
  },
  {
    id: POLICY_AUTHORING_INTERACTION_RULE_IDS.PREPARED_PROPOSAL_REQUIRES_SERVER_ADMISSION,
    requiredForComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_PROPOSAL_CARD,
    ],
    notes: 'A prepared proposal must forward only its server-issued reference and revision through the admitted create action; the browser cannot reconstruct policy intent.',
  },
]);

const POLICY_AUTHORING_ACCESSIBILITY_RULES = deepFreeze([
  {
    id: POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE,
    requiredForComponentIds: Object.values(POLICY_AUTHORING_COMPONENT_IDS),
    notes: 'Every interactive target must be reachable and operable by keyboard.',
  },
  {
    id: POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.VISIBLE_LABEL_AND_DESCRIPTION,
    requiredForComponentIds: Object.values(POLICY_AUTHORING_COMPONENT_IDS),
    notes: 'Controls need visible labels and helper text tied to the destination question.',
  },
  {
    id: POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.MULTI_SELECT_STATE_ANNOUNCED,
    requiredForComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    ],
    notes: 'Multi-select controls must expose selected, disabled, and grouped option state.',
  },
  {
    id: POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.FOCUS_VISIBLE_AND_NOT_OBSCURED,
    requiredForComponentIds: Object.values(POLICY_AUTHORING_COMPONENT_IDS),
    notes: 'Keyboard focus must remain visible and not hidden behind cards or sticky footer controls.',
  },
  {
    id: POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.TARGET_SIZE_MINIMUM,
    requiredForComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
      POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_PROPOSAL_CARD,
    ],
    notes: 'Pointer targets should satisfy WCAG 2.2 target-size minimum or spacing exceptions.',
  },
  {
    id: POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.ERROR_AND_DISABLED_REASON_PROGRAMMATIC,
    requiredForComponentIds: [
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_EMPTY_STATE_NOTICE,
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_PROPOSAL_CARD,
    ],
    notes: 'Error and disabled reason text must be available to assistive technology.',
  },
]);

function listPolicyAuthoringTargetComponents() {
  return POLICY_AUTHORING_TARGET_COMPONENTS;
}

function listPolicyAuthoringPrimitiveDecisions() {
  return POLICY_AUTHORING_PRIMITIVE_DECISIONS;
}

function listPolicyAuthoringOptionSourceRecords() {
  return POLICY_AUTHORING_OPTION_SOURCE_RECORDS;
}

function listPolicyAuthoringInteractionRules() {
  return POLICY_AUTHORING_INTERACTION_RULES;
}

function listPolicyAuthoringAccessibilityRules() {
  return POLICY_AUTHORING_ACCESSIBILITY_RULES;
}

function getPolicyAuthoringTargetComponent(componentId) {
  return POLICY_AUTHORING_TARGET_COMPONENTS.find(component => component.id === componentId) || null;
}

function getPolicyAuthoringPrimitiveDecision(primitiveId) {
  return POLICY_AUTHORING_PRIMITIVE_DECISIONS.find(decision => decision.primitiveId === primitiveId) || null;
}

function getPolicyAuthoringOptionSourceRecord(sourceId) {
  return POLICY_AUTHORING_OPTION_SOURCE_RECORDS.find(source => source.id === sourceId) || null;
}

function validatePolicyAuthoringComponentVocabulary(componentIds = []) {
  const knownIds = Object.values(POLICY_AUTHORING_COMPONENT_IDS);
  const unknownComponentIds = componentIds.filter(componentId => !knownIds.includes(componentId));

  return {
    valid: unknownComponentIds.length === 0,
    riskId: unknownComponentIds.length === 0
      ? null
      : POLICY_AUTHORING_COMPONENT_RISK_IDS.UNKNOWN_COMPONENT,
    unknownComponentIds,
  };
}

function validatePolicyAuthoringOptionSource(sourceId) {
  const record = getPolicyAuthoringOptionSourceRecord(sourceId);
  if (!record) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_COMPONENT_RISK_IDS.UNKNOWN_OPTION_SOURCE,
      reason: 'Unknown policy authoring option source.',
    };
  }

  if (record.canAutoDeclare) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_COMPONENT_RISK_IDS.OBSERVED_EVIDENCE_AUTO_DECLARED,
      reason: 'Option sources cannot silently become declared intent.',
    };
  }

  if (!record.selectable && !record.requiresExplanation) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_COMPONENT_RISK_IDS.UNEXPLAINED_DISABLED_CHOICE,
      reason: 'Disabled option sources must explain why they cannot be selected.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Option source is explicit and cannot auto-declare intent.',
  };
}

function validatePolicyAuthoringComponentInteraction(componentId) {
  const component = getPolicyAuthoringTargetComponent(componentId);
  if (!component) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_COMPONENT_RISK_IDS.UNKNOWN_COMPONENT,
      missingRuleIds: [],
      reason: 'Unknown policy authoring component.',
    };
  }

  const requiredRuleIds = POLICY_AUTHORING_INTERACTION_RULES
    .filter(rule => rule.requiredForComponentIds.includes(componentId))
    .map(rule => rule.id);
  const missingRuleIds = component.commandBoundaryRequired &&
    !requiredRuleIds.includes(POLICY_AUTHORING_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS) &&
    !requiredRuleIds.includes(POLICY_AUTHORING_INTERACTION_RULE_IDS.REMOVE_VALUES_THROUGH_TYPED_DRAFT_COMMANDS)
    ? [POLICY_AUTHORING_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS]
    : [];

  return {
    valid: missingRuleIds.length === 0,
    riskId: missingRuleIds.length === 0
      ? null
      : POLICY_AUTHORING_COMPONENT_RISK_IDS.RAW_LEGACY_MECHANIC_IN_NORMAL_PATH,
    requiredRuleIds,
    missingRuleIds,
    reason: missingRuleIds.length === 0
      ? 'Component interaction rules satisfy the policy authoring component contract.'
      : 'Command-boundary component is missing typed command interaction coverage.',
  };
}

function validatePolicyAuthoringComponentAccessibility(componentId) {
  const component = getPolicyAuthoringTargetComponent(componentId);
  if (!component) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_COMPONENT_RISK_IDS.UNKNOWN_COMPONENT,
      ruleIds: [],
      reason: 'Unknown policy authoring component.',
    };
  }

  const ruleIds = POLICY_AUTHORING_ACCESSIBILITY_RULES
    .filter(rule => rule.requiredForComponentIds.includes(componentId))
    .map(rule => rule.id);

  return {
    valid: ruleIds.includes(POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE) &&
      ruleIds.includes(POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS.VISIBLE_LABEL_AND_DESCRIPTION),
    riskId: ruleIds.length > 0 ? null : POLICY_AUTHORING_COMPONENT_RISK_IDS.INACCESSIBLE_CUSTOM_CONTROL,
    ruleIds,
    reason: 'Component has policy authoring accessibility requirements.',
  };
}

function summarizePolicyAuthoringComponentSystem() {
  const normalPathComponentIds = POLICY_AUTHORING_TARGET_COMPONENTS
    .filter(component => component.normalPath)
    .map(component => component.id);
  const supportOnlyComponentIds = POLICY_AUTHORING_TARGET_COMPONENTS
    .filter(component => !component.normalPath)
    .map(component => component.id);
  const multiSelectDefaultComponentIds = POLICY_AUTHORING_TARGET_COMPONENTS
    .filter(component => component.defaultMultiSelect)
    .map(component => component.id);
  const commandBoundaryComponentIds = POLICY_AUTHORING_TARGET_COMPONENTS
    .filter(component => component.commandBoundaryRequired)
    .map(component => component.id);
  const observedEvidenceComponentIds = POLICY_AUTHORING_TARGET_COMPONENTS
    .filter(component => component.acceptsObservedEvidence)
    .map(component => component.id);

  return {
    targetComponentCount: POLICY_AUTHORING_TARGET_COMPONENTS.length,
    primitiveDecisionCount: POLICY_AUTHORING_PRIMITIVE_DECISIONS.length,
    optionSourceCount: POLICY_AUTHORING_OPTION_SOURCE_RECORDS.length,
    interactionRuleCount: POLICY_AUTHORING_INTERACTION_RULES.length,
    accessibilityRuleCount: POLICY_AUTHORING_ACCESSIBILITY_RULES.length,
    normalPathComponentIds,
    supportOnlyComponentIds,
    multiSelectDefaultComponentIds,
    commandBoundaryComponentIds,
    observedEvidenceComponentIds,
  };
}

export {
  POLICY_AUTHORING_ACCESSIBILITY_RULE_IDS,
  POLICY_AUTHORING_COMPONENT_DECISION_IDS,
  POLICY_AUTHORING_COMPONENT_IDS,
  POLICY_AUTHORING_COMPONENT_RISK_IDS,
  POLICY_AUTHORING_INTERACTION_RULE_IDS,
  POLICY_AUTHORING_OPTION_SOURCE_IDS,
  POLICY_AUTHORING_PRIMITIVE_IDS,
  getPolicyAuthoringOptionSourceRecord,
  getPolicyAuthoringPrimitiveDecision,
  getPolicyAuthoringTargetComponent,
  listPolicyAuthoringAccessibilityRules,
  listPolicyAuthoringInteractionRules,
  listPolicyAuthoringOptionSourceRecords,
  listPolicyAuthoringPrimitiveDecisions,
  listPolicyAuthoringTargetComponents,
  summarizePolicyAuthoringComponentSystem,
  validatePolicyAuthoringComponentAccessibility,
  validatePolicyAuthoringComponentInteraction,
  validatePolicyAuthoringComponentVocabulary,
  validatePolicyAuthoringOptionSource,
};
