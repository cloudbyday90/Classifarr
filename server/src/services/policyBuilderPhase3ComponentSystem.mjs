import {
  PHASE_3R_DESTINATION_FLOW_STEP_IDS,
  PHASE_3R_DESTINATION_QUESTION_IDS,
} from './policyBuilderPhase3DestinationFirstFlow.mjs';

const PHASE_3R_COMPONENT_IDS = Object.freeze({
  DESTINATION_CONTEXT_CARD: 'destination_context_card',
  OBSERVED_PROFILE_SUMMARY: 'observed_profile_summary',
  INTENT_SIGNAL_PICKER: 'intent_signal_picker',
  INTENT_SIGNAL_CHIP_LIST: 'intent_signal_chip_list',
  HARD_LIMIT_CONTROL: 'hard_limit_control',
  AVOID_CONTROL: 'avoid_control',
  REVIEW_TRIGGER_CONTROL: 'review_trigger_control',
  READINESS_NEXT_ACTION_CARD: 'readiness_next_action_card',
  STARTER_TEMPLATE_SUGGESTION: 'starter_template_suggestion',
  MIGRATION_VERIFIER_PANEL: 'migration_verifier_panel',
});

const PHASE_3R_PRIMITIVE_IDS = Object.freeze({
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

const PHASE_3R_COMPONENT_DECISION_IDS = Object.freeze({
  KEEP_AS_PRIMITIVE: 'keep_as_primitive',
  REWRITE_AS_TARGET: 'rewrite_as_target',
  REPLACE_WITH_TARGET: 'replace_with_target',
  DELETE_FROM_NORMAL_PATH: 'delete_from_normal_path',
});

const PHASE_3R_OPTION_SOURCE_IDS = Object.freeze({
  OBSERVED_IN_LIBRARY: 'observed_in_library',
  SUGGESTED_FROM_OBSERVED_PROFILE: 'suggested_from_observed_profile',
  SUGGESTED_FROM_STARTER_TEMPLATE: 'suggested_from_starter_template',
  COMMON_STATIC_OPTION: 'common_static_option',
  ALREADY_DECLARED: 'already_declared',
  UNAVAILABLE_CONFLICTING_INTENT: 'unavailable_conflicting_intent',
});

const PHASE_3R_INTERACTION_RULE_IDS = Object.freeze({
  ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS: 'add_values_through_typed_draft_commands',
  REMOVE_VALUES_THROUGH_TYPED_DRAFT_COMMANDS: 'remove_values_through_typed_draft_commands',
  DISABLED_CHOICES_EXPLAIN_REASON: 'disabled_choices_explain_reason',
  DESTRUCTIVE_OR_BLOCKING_REQUIRES_CONFIRMATION: 'destructive_or_blocking_requires_confirmation',
  READINESS_LINKS_TO_RESOLVING_COMPONENT: 'readiness_links_to_resolving_component',
  OBSERVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE: 'observed_values_require_explicit_acceptance',
});

const PHASE_3R_ACCESSIBILITY_RULE_IDS = Object.freeze({
  KEYBOARD_OPERABLE: 'keyboard_operable',
  VISIBLE_LABEL_AND_DESCRIPTION: 'visible_label_and_description',
  MULTI_SELECT_STATE_ANNOUNCED: 'multi_select_state_announced',
  FOCUS_VISIBLE_AND_NOT_OBSCURED: 'focus_visible_and_not_obscured',
  TARGET_SIZE_MINIMUM: 'target_size_minimum',
  ERROR_AND_DISABLED_REASON_PROGRAMMATIC: 'error_and_disabled_reason_programmatic',
});

const PHASE_3R_COMPONENT_RISK_IDS = Object.freeze({
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

const PHASE_3R_TARGET_COMPONENTS = deepFreeze([
  {
    id: PHASE_3R_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
    label: 'DestinationContextCard',
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.SELECT_LIBRARY,
    questionId: null,
    normalPath: true,
    defaultMultiSelect: false,
    acceptsObservedEvidence: true,
    commandBoundaryRequired: false,
    notes: 'Selects or displays the connected destination library before any policy mechanics.',
  },
  {
    id: PHASE_3R_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
    label: 'ObservedProfileSummary',
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.REVIEW_OBSERVED_DESTINATION,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    normalPath: true,
    defaultMultiSelect: false,
    acceptsObservedEvidence: true,
    commandBoundaryRequired: false,
    notes: 'Shows observed library evidence as read-only context and suggestion source.',
  },
  {
    id: PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    label: 'IntentSignalPicker',
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    normalPath: true,
    defaultMultiSelect: true,
    acceptsObservedEvidence: true,
    commandBoundaryRequired: true,
    notes: 'Adds simple belongs-here and helpful-match values through typed draft commands.',
  },
  {
    id: PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
    label: 'IntentSignalChipList',
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    normalPath: true,
    defaultMultiSelect: true,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: true,
    notes: 'Displays declared values and removes them through typed draft commands.',
  },
  {
    id: PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    label: 'HardLimitControl',
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    normalPath: true,
    defaultMultiSelect: false,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: true,
    notes: 'Confirms blocking constraints with explicit operator action.',
  },
  {
    id: PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
    label: 'AvoidControl',
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_HARD_LIMITS,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    normalPath: true,
    defaultMultiSelect: true,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: true,
    notes: 'Adds avoid values explicitly and never infers absence as exclusion.',
  },
  {
    id: PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    label: 'ReviewTriggerControl',
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHEN_SHOULD_CLASSIFARR_ASK,
    normalPath: true,
    defaultMultiSelect: true,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: true,
    notes: 'Defines uncertainty triggers without exposing raw confidence internals.',
  },
  {
    id: PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
    label: 'ReadinessNextActionCard',
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.CONFIRM_ROUTING_READINESS,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.CAN_THIS_ROUTE,
    normalPath: true,
    defaultMultiSelect: false,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: false,
    notes: 'Shows one next action per readiness issue and links to the resolving component.',
  },
  {
    id: PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
    label: 'StarterTemplateSuggestion',
    flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_HELPS_BUT_DOES_NOT_DECIDE,
    normalPath: false,
    defaultMultiSelect: false,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: true,
    notes: 'Offers template-derived suggestions after destination context without becoming the primary model.',
  },
  {
    id: PHASE_3R_COMPONENT_IDS.MIGRATION_VERIFIER_PANEL,
    label: 'MigrationVerifierPanel',
    flowStepId: null,
    questionId: null,
    normalPath: false,
    defaultMultiSelect: false,
    acceptsObservedEvidence: false,
    commandBoundaryRequired: false,
    notes: 'Maintainer/verifier-only replacement for old preview, replay, migration, and provider diagnostic panels.',
  },
]);

const PHASE_3R_PRIMITIVE_DECISIONS = deepFreeze([
  {
    primitiveId: PHASE_3R_PRIMITIVE_IDS.MODAL_AND_SECTION_CONTAINER,
    decisionId: PHASE_3R_COMPONENT_DECISION_IDS.REWRITE_AS_TARGET,
    targetComponentIds: [
      PHASE_3R_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
      PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
    ],
    normalPath: true,
  },
  {
    primitiveId: PHASE_3R_PRIMITIVE_IDS.SUMMARY_AND_READINESS_CARD,
    decisionId: PHASE_3R_COMPONENT_DECISION_IDS.REPLACE_WITH_TARGET,
    targetComponentIds: [
      PHASE_3R_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
      PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
    ],
    normalPath: true,
  },
  {
    primitiveId: PHASE_3R_PRIMITIVE_IDS.WARNING_AND_NEXT_ACTION_MESSAGE,
    decisionId: PHASE_3R_COMPONENT_DECISION_IDS.REWRITE_AS_TARGET,
    targetComponentIds: [
      PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
      PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    ],
    normalPath: true,
  },
  {
    primitiveId: PHASE_3R_PRIMITIVE_IDS.OPTION_SELECT,
    decisionId: PHASE_3R_COMPONENT_DECISION_IDS.REPLACE_WITH_TARGET,
    targetComponentIds: [
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
    ],
    normalPath: true,
  },
  {
    primitiveId: PHASE_3R_PRIMITIVE_IDS.MULTI_SELECT_AND_CHIP_CONTROL,
    decisionId: PHASE_3R_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
      PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
      PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    ],
    normalPath: true,
  },
  {
    primitiveId: PHASE_3R_PRIMITIVE_IDS.ACTION_BUTTON,
    decisionId: PHASE_3R_COMPONENT_DECISION_IDS.KEEP_AS_PRIMITIVE,
    targetComponentIds: [
      PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
      PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    ],
    normalPath: true,
  },
  {
    primitiveId: PHASE_3R_PRIMITIVE_IDS.OBSERVED_PROFILE_SUGGESTION_ROW,
    decisionId: PHASE_3R_COMPONENT_DECISION_IDS.REWRITE_AS_TARGET,
    targetComponentIds: [
      PHASE_3R_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    ],
    normalPath: true,
  },
  {
    primitiveId: PHASE_3R_PRIMITIVE_IDS.EMPTY_LOADING_ERROR_STATE,
    decisionId: PHASE_3R_COMPONENT_DECISION_IDS.REWRITE_AS_TARGET,
    targetComponentIds: [
      PHASE_3R_COMPONENT_IDS.DESTINATION_CONTEXT_CARD,
      PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
    ],
    normalPath: true,
  },
  {
    primitiveId: PHASE_3R_PRIMITIVE_IDS.TEMPLATE_DETAIL_AND_MECHANICS_SURFACE,
    decisionId: PHASE_3R_COMPONENT_DECISION_IDS.DELETE_FROM_NORMAL_PATH,
    targetComponentIds: [
      PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
      PHASE_3R_COMPONENT_IDS.MIGRATION_VERIFIER_PANEL,
    ],
    normalPath: false,
  },
]);

const PHASE_3R_OPTION_SOURCE_RECORDS = deepFreeze([
  {
    id: PHASE_3R_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
    visibleGroupLabel: 'Already in this library',
    canAutoDeclare: false,
    selectable: true,
    requiresExplanation: true,
  },
  {
    id: PHASE_3R_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
    visibleGroupLabel: 'Suggested from this library',
    canAutoDeclare: false,
    selectable: true,
    requiresExplanation: true,
  },
  {
    id: PHASE_3R_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
    visibleGroupLabel: 'Suggested by starter template',
    canAutoDeclare: false,
    selectable: true,
    requiresExplanation: true,
  },
  {
    id: PHASE_3R_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
    visibleGroupLabel: 'Common options',
    canAutoDeclare: false,
    selectable: true,
    requiresExplanation: false,
  },
  {
    id: PHASE_3R_OPTION_SOURCE_IDS.ALREADY_DECLARED,
    visibleGroupLabel: 'Already added',
    canAutoDeclare: false,
    selectable: false,
    requiresExplanation: true,
  },
  {
    id: PHASE_3R_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT,
    visibleGroupLabel: 'Unavailable',
    canAutoDeclare: false,
    selectable: false,
    requiresExplanation: true,
  },
]);

const PHASE_3R_INTERACTION_RULES = deepFreeze([
  {
    id: PHASE_3R_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
    requiredForComponentIds: [
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
      PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
      PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
    ],
    notes: 'Adding values must emit typed commands instead of mutating raw bridge payloads.',
  },
  {
    id: PHASE_3R_INTERACTION_RULE_IDS.REMOVE_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
    requiredForComponentIds: [
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
      PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
      PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    ],
    notes: 'Removing values must emit typed commands and preserve provenance.',
  },
  {
    id: PHASE_3R_INTERACTION_RULE_IDS.DISABLED_CHOICES_EXPLAIN_REASON,
    requiredForComponentIds: [
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
    ],
    notes: 'Disabled choices need visible and programmatic reason text.',
  },
  {
    id: PHASE_3R_INTERACTION_RULE_IDS.DESTRUCTIVE_OR_BLOCKING_REQUIRES_CONFIRMATION,
    requiredForComponentIds: [
      PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
    ],
    notes: 'Controls that can block routing or classification require explicit operator confirmation.',
  },
  {
    id: PHASE_3R_INTERACTION_RULE_IDS.READINESS_LINKS_TO_RESOLVING_COMPONENT,
    requiredForComponentIds: [
      PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
    ],
    notes: 'Readiness next actions must link to the component that resolves the issue.',
  },
  {
    id: PHASE_3R_INTERACTION_RULE_IDS.OBSERVED_VALUES_REQUIRE_EXPLICIT_ACCEPTANCE,
    requiredForComponentIds: [
      PHASE_3R_COMPONENT_IDS.OBSERVED_PROFILE_SUMMARY,
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    ],
    notes: 'Observed evidence may prefill suggestions but never silently becomes declared intent.',
  },
]);

const PHASE_3R_ACCESSIBILITY_RULES = deepFreeze([
  {
    id: PHASE_3R_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE,
    requiredForComponentIds: Object.values(PHASE_3R_COMPONENT_IDS),
    notes: 'Every interactive target must be reachable and operable by keyboard.',
  },
  {
    id: PHASE_3R_ACCESSIBILITY_RULE_IDS.VISIBLE_LABEL_AND_DESCRIPTION,
    requiredForComponentIds: Object.values(PHASE_3R_COMPONENT_IDS),
    notes: 'Controls need visible labels and helper text tied to the destination question.',
  },
  {
    id: PHASE_3R_ACCESSIBILITY_RULE_IDS.MULTI_SELECT_STATE_ANNOUNCED,
    requiredForComponentIds: [
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
      PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
      PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    ],
    notes: 'Multi-select controls must expose selected, disabled, and grouped option state.',
  },
  {
    id: PHASE_3R_ACCESSIBILITY_RULE_IDS.FOCUS_VISIBLE_AND_NOT_OBSCURED,
    requiredForComponentIds: Object.values(PHASE_3R_COMPONENT_IDS),
    notes: 'Keyboard focus must remain visible and not hidden behind cards or sticky footer controls.',
  },
  {
    id: PHASE_3R_ACCESSIBILITY_RULE_IDS.TARGET_SIZE_MINIMUM,
    requiredForComponentIds: [
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
      PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
      PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
      PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
    ],
    notes: 'Pointer targets should satisfy WCAG 2.2 target-size minimum or spacing exceptions.',
  },
  {
    id: PHASE_3R_ACCESSIBILITY_RULE_IDS.ERROR_AND_DISABLED_REASON_PROGRAMMATIC,
    requiredForComponentIds: [
      PHASE_3R_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
      PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
      PHASE_3R_COMPONENT_IDS.READINESS_NEXT_ACTION_CARD,
    ],
    notes: 'Error and disabled reason text must be available to assistive technology.',
  },
]);

function listPhase3RTargetComponents() {
  return PHASE_3R_TARGET_COMPONENTS;
}

function listPhase3RPrimitiveDecisions() {
  return PHASE_3R_PRIMITIVE_DECISIONS;
}

function listPhase3ROptionSourceRecords() {
  return PHASE_3R_OPTION_SOURCE_RECORDS;
}

function listPhase3RInteractionRules() {
  return PHASE_3R_INTERACTION_RULES;
}

function listPhase3RAccessibilityRules() {
  return PHASE_3R_ACCESSIBILITY_RULES;
}

function getPhase3RTargetComponent(componentId) {
  return PHASE_3R_TARGET_COMPONENTS.find(component => component.id === componentId) || null;
}

function getPhase3RPrimitiveDecision(primitiveId) {
  return PHASE_3R_PRIMITIVE_DECISIONS.find(decision => decision.primitiveId === primitiveId) || null;
}

function getPhase3ROptionSourceRecord(sourceId) {
  return PHASE_3R_OPTION_SOURCE_RECORDS.find(source => source.id === sourceId) || null;
}

function validatePhase3RComponentVocabulary(componentIds = []) {
  const knownIds = Object.values(PHASE_3R_COMPONENT_IDS);
  const unknownComponentIds = componentIds.filter(componentId => !knownIds.includes(componentId));

  return {
    valid: unknownComponentIds.length === 0,
    riskId: unknownComponentIds.length === 0
      ? null
      : PHASE_3R_COMPONENT_RISK_IDS.UNKNOWN_COMPONENT,
    unknownComponentIds,
  };
}

function validatePhase3ROptionSource(sourceId) {
  const record = getPhase3ROptionSourceRecord(sourceId);
  if (!record) {
    return {
      valid: false,
      riskId: PHASE_3R_COMPONENT_RISK_IDS.UNKNOWN_OPTION_SOURCE,
      reason: 'Unknown Phase 3R option source.',
    };
  }

  if (record.canAutoDeclare) {
    return {
      valid: false,
      riskId: PHASE_3R_COMPONENT_RISK_IDS.OBSERVED_EVIDENCE_AUTO_DECLARED,
      reason: 'Option sources cannot silently become declared intent.',
    };
  }

  if (!record.selectable && !record.requiresExplanation) {
    return {
      valid: false,
      riskId: PHASE_3R_COMPONENT_RISK_IDS.UNEXPLAINED_DISABLED_CHOICE,
      reason: 'Disabled option sources must explain why they cannot be selected.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Option source is explicit and cannot auto-declare intent.',
  };
}

function validatePhase3RComponentInteraction(componentId) {
  const component = getPhase3RTargetComponent(componentId);
  if (!component) {
    return {
      valid: false,
      riskId: PHASE_3R_COMPONENT_RISK_IDS.UNKNOWN_COMPONENT,
      missingRuleIds: [],
      reason: 'Unknown Phase 3R component.',
    };
  }

  const requiredRuleIds = PHASE_3R_INTERACTION_RULES
    .filter(rule => rule.requiredForComponentIds.includes(componentId))
    .map(rule => rule.id);
  const missingRuleIds = component.commandBoundaryRequired &&
    !requiredRuleIds.includes(PHASE_3R_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS) &&
    !requiredRuleIds.includes(PHASE_3R_INTERACTION_RULE_IDS.REMOVE_VALUES_THROUGH_TYPED_DRAFT_COMMANDS)
    ? [PHASE_3R_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS]
    : [];

  return {
    valid: missingRuleIds.length === 0,
    riskId: missingRuleIds.length === 0
      ? null
      : PHASE_3R_COMPONENT_RISK_IDS.RAW_LEGACY_MECHANIC_IN_NORMAL_PATH,
    requiredRuleIds,
    missingRuleIds,
    reason: missingRuleIds.length === 0
      ? 'Component interaction rules satisfy the Phase 3R component contract.'
      : 'Command-boundary component is missing typed command interaction coverage.',
  };
}

function validatePhase3RComponentAccessibility(componentId) {
  const component = getPhase3RTargetComponent(componentId);
  if (!component) {
    return {
      valid: false,
      riskId: PHASE_3R_COMPONENT_RISK_IDS.UNKNOWN_COMPONENT,
      ruleIds: [],
      reason: 'Unknown Phase 3R component.',
    };
  }

  const ruleIds = PHASE_3R_ACCESSIBILITY_RULES
    .filter(rule => rule.requiredForComponentIds.includes(componentId))
    .map(rule => rule.id);

  return {
    valid: ruleIds.includes(PHASE_3R_ACCESSIBILITY_RULE_IDS.KEYBOARD_OPERABLE) &&
      ruleIds.includes(PHASE_3R_ACCESSIBILITY_RULE_IDS.VISIBLE_LABEL_AND_DESCRIPTION),
    riskId: ruleIds.length > 0 ? null : PHASE_3R_COMPONENT_RISK_IDS.INACCESSIBLE_CUSTOM_CONTROL,
    ruleIds,
    reason: 'Component has Phase 3R accessibility requirements.',
  };
}

function summarizePhase3RComponentSystem() {
  const normalPathComponentIds = PHASE_3R_TARGET_COMPONENTS
    .filter(component => component.normalPath)
    .map(component => component.id);
  const supportOnlyComponentIds = PHASE_3R_TARGET_COMPONENTS
    .filter(component => !component.normalPath)
    .map(component => component.id);
  const multiSelectDefaultComponentIds = PHASE_3R_TARGET_COMPONENTS
    .filter(component => component.defaultMultiSelect)
    .map(component => component.id);
  const commandBoundaryComponentIds = PHASE_3R_TARGET_COMPONENTS
    .filter(component => component.commandBoundaryRequired)
    .map(component => component.id);
  const observedEvidenceComponentIds = PHASE_3R_TARGET_COMPONENTS
    .filter(component => component.acceptsObservedEvidence)
    .map(component => component.id);

  return {
    targetComponentCount: PHASE_3R_TARGET_COMPONENTS.length,
    primitiveDecisionCount: PHASE_3R_PRIMITIVE_DECISIONS.length,
    optionSourceCount: PHASE_3R_OPTION_SOURCE_RECORDS.length,
    interactionRuleCount: PHASE_3R_INTERACTION_RULES.length,
    accessibilityRuleCount: PHASE_3R_ACCESSIBILITY_RULES.length,
    normalPathComponentIds,
    supportOnlyComponentIds,
    multiSelectDefaultComponentIds,
    commandBoundaryComponentIds,
    observedEvidenceComponentIds,
  };
}

export {
  PHASE_3R_ACCESSIBILITY_RULE_IDS,
  PHASE_3R_COMPONENT_DECISION_IDS,
  PHASE_3R_COMPONENT_IDS,
  PHASE_3R_COMPONENT_RISK_IDS,
  PHASE_3R_INTERACTION_RULE_IDS,
  PHASE_3R_OPTION_SOURCE_IDS,
  PHASE_3R_PRIMITIVE_IDS,
  getPhase3ROptionSourceRecord,
  getPhase3RPrimitiveDecision,
  getPhase3RTargetComponent,
  listPhase3RAccessibilityRules,
  listPhase3RInteractionRules,
  listPhase3ROptionSourceRecords,
  listPhase3RPrimitiveDecisions,
  listPhase3RTargetComponents,
  summarizePhase3RComponentSystem,
  validatePhase3RComponentAccessibility,
  validatePhase3RComponentInteraction,
  validatePhase3RComponentVocabulary,
  validatePhase3ROptionSource,
};
