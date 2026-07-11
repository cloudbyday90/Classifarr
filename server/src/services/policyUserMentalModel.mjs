import {
  AUTHORITY_SOURCE_IDS,
  isDurablePolicyAuthority,
} from './policyAuthorityVocabulary.mjs';

const MENTAL_MODEL_QUESTION_IDS = Object.freeze({
  OBSERVED_BELONGS_HERE: 'observed_belongs_here',
  DECLARED_LIMITS: 'declared_limits',
  REVIEW_BEHAVIOR: 'review_behavior',
  ROUTING_TARGET: 'routing_target',
});

const POLICY_UX_TERM_IDS = Object.freeze({
  BELONGS_HERE: 'belongs_here',
  HELPFUL_MATCHES: 'helpful_matches',
  HARD_LIMITS: 'hard_limits',
  AVOID: 'avoid',
  ASK_WHEN_UNSURE: 'ask_when_unsure',
  ROUTING_TARGET: 'routing_target',
  READINESS: 'readiness',
});

const POLICY_UX_SELECTION_PATTERN_IDS = Object.freeze({
  OBSERVED_SUGGESTION_MULTI_SELECT: 'observed_suggestion_multi_select',
  DECLARED_SIGNAL_MULTI_SELECT: 'declared_signal_multi_select',
  DECLARED_CONSTRAINT_MULTI_SELECT: 'declared_constraint_multi_select',
  REVIEW_TRIGGER_CHECKLIST: 'review_trigger_checklist',
  ROUTING_READINESS_SUMMARY: 'routing_readiness_summary',
  NEXT_ACTION_STATUS: 'next_action_status',
});

const POLICY_SETUP_FIELD_CONTROL_KIND_IDS = Object.freeze({
  OBSERVED_MULTI_SELECT: 'observed_multi_select',
  DECLARED_MULTI_SELECT: 'declared_multi_select',
  DECLARED_CHECKLIST: 'declared_checklist',
  STATUS_SUMMARY: 'status_summary',
  NEXT_ACTION_STATUS: 'next_action_status',
});

const POLICY_SETUP_ANSWER_KIND_IDS = Object.freeze({
  ACCEPT_OBSERVED_SUGGESTIONS: 'accept_observed_suggestions',
  DECLARE_DESTINATION_RULES: 'declare_destination_rules',
  CONFIGURE_REVIEW_TRIGGERS: 'configure_review_triggers',
  REVIEW_READINESS_STATUS: 'review_readiness_status',
});

const POLICY_SETUP_SURFACE_ROLE_IDS = Object.freeze({
  OBSERVED_SUGGESTION_REVIEW: 'observed_suggestion_review',
  DECLARED_INTENT_EDIT: 'declared_intent_edit',
  REVIEW_BEHAVIOR_EDIT: 'review_behavior_edit',
  READINESS_STATUS: 'readiness_status',
});

const POLICY_SETUP_ACTION_KIND_IDS = Object.freeze({
  REVIEW_SUGGESTIONS: 'review_suggestions',
  EDIT_DESTINATION_RULES: 'edit_destination_rules',
  CONFIGURE_REVIEW_TRIGGERS: 'configure_review_triggers',
  CHECK_ROUTING_READINESS: 'check_routing_readiness',
});

const POLICY_SETUP_STEP_IDS = Object.freeze({
  OBSERVED_APPLICATION: 'observed_application',
  DECLARED_DESTINATION_RULES: 'declared_destination_rules',
  REVIEW_BEHAVIOR: 'review_behavior',
  ROUTING_AND_READINESS: 'routing_and_readiness',
});

const POLICY_UX_TERM_AUDIT_RISK_IDS = Object.freeze({
  MISSING_LABEL: 'missing_label',
  MISSING_PLAIN_QUESTION: 'missing_plain_question',
  MISSING_HELPER: 'missing_helper',
  UNKNOWN_SELECTION_PATTERN: 'unknown_selection_pattern',
  MISSING_POLICY_ENGINE_CONCEPT: 'missing_policy_engine_concept',
  MISSING_DECLARED_INTENT_SOURCE: 'missing_declared_intent_source',
  MISSING_OBSERVED_EVIDENCE_SOURCE: 'missing_observed_evidence_source',
  HARD_LIMITS_ALLOW_OBSERVED_EVIDENCE: 'hard_limits_allow_observed_evidence',
  INTERNAL_POLICY_LANGUAGE: 'internal_policy_language',
  BROAD_GENRE_AUTHORITY_LANGUAGE: 'broad_genre_authority_language',
});

const POLICY_SETUP_STEP_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_STEP: 'unknown_step',
  MISSING_TITLE: 'missing_title',
  MISSING_OPERATOR_ACTION: 'missing_operator_action',
  UNKNOWN_QUESTION: 'unknown_question',
  MISSING_TERM: 'missing_term',
  UNKNOWN_TERM: 'unknown_term',
  UNKNOWN_SELECTION_PATTERN: 'unknown_selection_pattern',
  TERM_PATTERN_NOT_ALLOWED: 'term_pattern_not_allowed',
  MISSING_DECLARED_INTENT_SOURCE: 'missing_declared_intent_source',
  MISSING_OBSERVED_EVIDENCE_SOURCE: 'missing_observed_evidence_source',
  INTERNAL_POLICY_LANGUAGE: 'internal_policy_language',
  BROAD_GENRE_AUTHORITY_LANGUAGE: 'broad_genre_authority_language',
});

const POLICY_SETUP_CARD_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_STEP: 'unknown_step',
  MISSING_HEADING: 'missing_heading',
  MISSING_QUESTION: 'missing_question',
  MISSING_HELPER: 'missing_helper',
  MISSING_PRIMARY_ACTION: 'missing_primary_action',
  MISSING_EMPTY_STATE: 'missing_empty_state',
  MISSING_COMPLETION_SIGNAL: 'missing_completion_signal',
  MISSING_TERM: 'missing_term',
  UNKNOWN_TERM: 'unknown_term',
  INTERNAL_POLICY_LANGUAGE: 'internal_policy_language',
  BROAD_GENRE_AUTHORITY_LANGUAGE: 'broad_genre_authority_language',
});

const POLICY_SETUP_SURFACE_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_STEP: 'unknown_step',
  UNKNOWN_ROLE: 'unknown_role',
  UNKNOWN_ACTION_KIND: 'unknown_action_kind',
  MISSING_OPERATOR_DECISION: 'missing_operator_decision',
  MISSING_SYSTEM_RESPONSIBILITY: 'missing_system_responsibility',
  DIRECT_POLICY_PERSISTENCE: 'direct_policy_persistence',
  OBSERVED_SURFACE_MISSING_EVIDENCE_SOURCE: 'observed_surface_missing_evidence_source',
  OBSERVED_SURFACE_MISSING_DECLARED_INTENT_SOURCE: 'observed_surface_missing_declared_intent_source',
  DECLARED_SURFACE_CANNOT_EDIT: 'declared_surface_cannot_edit',
  DECLARED_SURFACE_MISSING_OPERATOR_SOURCE: 'declared_surface_missing_operator_source',
  READINESS_SURFACE_CAN_EDIT: 'readiness_surface_can_edit',
  INTERNAL_POLICY_LANGUAGE: 'internal_policy_language',
  BROAD_GENRE_AUTHORITY_LANGUAGE: 'broad_genre_authority_language',
});

const POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_STEP: 'unknown_step',
  INVALID_ORDER: 'invalid_order',
  MISSING_OPERATOR_GOAL: 'missing_operator_goal',
  MISSING_PRIMARY_ACTION: 'missing_primary_action',
  MISSING_COMPLETION_SIGNAL: 'missing_completion_signal',
  MISSING_SYSTEM_BOUNDARY: 'missing_system_boundary',
  MISSING_FAILURE_MODE: 'missing_failure_mode',
  TOO_MANY_PRIMARY_ACTIONS: 'too_many_primary_actions',
  DIRECT_POLICY_PERSISTENCE: 'direct_policy_persistence',
  INTERNAL_POLICY_LANGUAGE: 'internal_policy_language',
  BROAD_GENRE_AUTHORITY_LANGUAGE: 'broad_genre_authority_language',
});

const POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_FIELD_GROUP: 'unknown_field_group',
  UNKNOWN_STEP: 'unknown_step',
  UNKNOWN_TERM: 'unknown_term',
  MISMATCHED_LABEL: 'mismatched_label',
  MISSING_INSTRUCTION: 'missing_instruction',
  UNKNOWN_CONTROL_KIND: 'unknown_control_kind',
  DIRECT_POLICY_PERSISTENCE: 'direct_policy_persistence',
  OBSERVED_CONTROL_MISSING_EVIDENCE_SOURCE: 'observed_control_missing_evidence_source',
  OBSERVED_CONTROL_MISSING_DECLARED_INTENT_SOURCE: 'observed_control_missing_declared_intent_source',
  OBSERVED_CONTROL_CANNOT_ACCEPT_SUGGESTIONS: 'observed_control_cannot_accept_suggestions',
  DECLARED_CONTROL_MISSING_OPERATOR_SOURCE: 'declared_control_missing_operator_source',
  DECLARED_CONTROL_CANNOT_EDIT: 'declared_control_cannot_edit',
  STATUS_CONTROL_CAN_EDIT: 'status_control_can_edit',
  INTERNAL_POLICY_LANGUAGE: 'internal_policy_language',
  BROAD_GENRE_AUTHORITY_LANGUAGE: 'broad_genre_authority_language',
});

const POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_STEP: 'unknown_step',
  UNKNOWN_ANSWER_KIND: 'unknown_answer_kind',
  MISSING_OPERATOR_RESPONSE: 'missing_operator_response',
  MISSING_AUTHORITY_SOURCE: 'missing_authority_source',
  DIRECT_POLICY_PERSISTENCE: 'direct_policy_persistence',
  DIRECT_LEARNING: 'direct_learning',
  DIRECT_ROUTING_EXECUTION: 'direct_routing_execution',
  OBSERVED_ANSWER_MISSING_ACCEPTANCE: 'observed_answer_missing_acceptance',
  STATUS_ANSWER_CAN_EDIT: 'status_answer_can_edit',
  INTERNAL_POLICY_LANGUAGE: 'internal_policy_language',
  BROAD_GENRE_AUTHORITY_LANGUAGE: 'broad_genre_authority_language',
});

const POLICY_SETUP_COPY_RULE_IDS = Object.freeze({
  KNOWN_UX_TERM: 'known_ux_term',
  VISIBLE_LABEL: 'visible_label',
  HELPER_TEXT: 'helper_text',
  OBSERVED_EVIDENCE_CONTEXT: 'observed_evidence_context',
  DECLARED_INTENT_CONTEXT: 'declared_intent_context',
  NO_INTERNAL_LANGUAGE: 'no_internal_language',
  NO_BROAD_GENRE_AUTHORITY: 'no_broad_genre_authority',
});

const POLICY_SETUP_COPY_RISK_IDS = Object.freeze({
  UNKNOWN_UX_TERM: 'unknown_ux_term',
  MISSING_VISIBLE_LABEL: 'missing_visible_label',
  MISMATCHED_VISIBLE_LABEL: 'mismatched_visible_label',
  MISSING_HELPER_TEXT: 'missing_helper_text',
  MISSING_OBSERVED_EVIDENCE_CONTEXT: 'missing_observed_evidence_context',
  MISSING_DECLARED_INTENT_CONTEXT: 'missing_declared_intent_context',
  INTERNAL_POLICY_LANGUAGE: 'internal_policy_language',
  BROAD_GENRE_AUTHORITY_LANGUAGE: 'broad_genre_authority_language',
});

const INTERNAL_LANGUAGE_FLAGS = Object.freeze([
  'scoring weight',
  'score weight',
  'customSignals',
  'provider gate',
  'replay parity',
  'tmdb coverage',
  'genre priority',
  'raw preset',
  'identity signal',
  'compatibility signal',
  'impact preview',
  'provider readiness',
  'internal diagnostic',
]);

const OBSERVED_EVIDENCE_LANGUAGE = Object.freeze([
  'observed',
  'already belongs',
  'current contents',
  'current library',
  'existing library',
  'media-server contents',
  'examples',
]);

const DECLARED_INTENT_LANGUAGE = Object.freeze([
  'declared',
  'operator',
  'explicit',
  'accepted',
  'accepts',
  'intent',
  'should',
]);

const BROAD_GENRE_AUTHORITY_LANGUAGE = Object.freeze([
  'genre priority',
  'genre decides',
  'genres decide',
  'genre defines',
  'genre should win',
  'prioritize genre',
  'winning genre',
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

const POLICY_USER_MENTAL_MODEL = deepFreeze({
  summary: 'Use what already exists, keep what the operator declares, and ask only when the evidence is not safe enough to automate.',
  setupQuestions: [
    {
      id: MENTAL_MODEL_QUESTION_IDS.OBSERVED_BELONGS_HERE,
      question: 'What already belongs here?',
      authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      purpose: 'Use observed library contents as suggestions before the operator accepts declared intent.',
    },
    {
      id: MENTAL_MODEL_QUESTION_IDS.DECLARED_LIMITS,
      question: 'What should always or never belong here?',
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      purpose: 'Capture explicit destination identity, hard limits, and avoid rules.',
    },
    {
      id: MENTAL_MODEL_QUESTION_IDS.REVIEW_BEHAVIOR,
      question: 'When should Classifarr ask?',
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      purpose: 'Define review behavior without turning every answer into learning.',
    },
    {
      id: MENTAL_MODEL_QUESTION_IDS.ROUTING_TARGET,
      question: 'Can this destination route?',
      authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      purpose: 'Separate classification intent from Arr routing readiness.',
    },
  ],
});

const POLICY_UX_TERMS = deepFreeze([
  {
    id: POLICY_UX_TERM_IDS.BELONGS_HERE,
    label: 'Belongs Here',
    plainQuestion: 'What clearly belongs in this destination?',
    helper: 'Use observed examples as suggestions, then accept only the values that should define this destination.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.OBSERVED_SUGGESTION_MULTI_SELECT,
    mustMentionObservedEvidence: true,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Broad genres can suggest fit, but they do not define a destination unless the operator accepts them as intent.',
    policyEngineConcept: 'identity_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
    label: 'Helpful Matches',
    plainQuestion: 'What evidence helps, but should not decide alone?',
    helper: 'Add operator-declared soft evidence that can support a match after destination identity is already plausible.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.DECLARED_SIGNAL_MULTI_SELECT,
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Broad genres usually belong here unless they are accepted as destination identity.',
    policyEngineConcept: 'compatibility_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.HARD_LIMITS,
    label: 'Hard Limits',
    plainQuestion: 'What should block this destination?',
    helper: 'Hard limits only come from explicit operator intent and can block classification or routing.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.DECLARED_CONSTRAINT_MULTI_SELECT,
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Do not infer hard limits from missing examples.',
    policyEngineConcept: 'constraint_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.AVOID,
    label: 'Avoid',
    plainQuestion: 'What should lower confidence before this destination wins?',
    helper: 'Avoid values come from explicit operator intent and warn Classifarr away from weak matches without becoming hard limits by default.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.DECLARED_CONSTRAINT_MULTI_SELECT,
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Avoid broad genres only when the operator explicitly marks them as poor fit.',
    policyEngineConcept: 'negative_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
    label: 'Ask When Unsure',
    plainQuestion: 'When should Classifarr ask for review?',
    helper: 'Use operator-declared review triggers when evidence is missing, conflicting, stale, or not safe enough to automate.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.REVIEW_TRIGGER_CHECKLIST,
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Ask about destination fit, not which broad genre is more important.',
    policyEngineConcept: 'review_trigger',
  },
  {
    id: POLICY_UX_TERM_IDS.ROUTING_TARGET,
    label: 'Routing Target',
    plainQuestion: 'Where should confirmed matches be sent?',
    helper: 'Operator-declared routing readiness is separate from classification confidence.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.ROUTING_READINESS_SUMMARY,
    mustMentionObservedEvidence: false,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Genres do not prove routing readiness.',
    policyEngineConcept: 'routing_evidence',
  },
  {
    id: POLICY_UX_TERM_IDS.READINESS,
    label: 'Readiness',
    plainQuestion: 'What is needed before this destination can automate safely?',
    helper: 'Readiness shows the next action when observed evidence, declared intent, profile freshness, or routing is incomplete.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    selectionPatternId: POLICY_UX_SELECTION_PATTERN_IDS.NEXT_ACTION_STATUS,
    mustMentionObservedEvidence: true,
    mustMentionDeclaredIntent: true,
    broadGenreRule: 'Broad genre overlap can reduce readiness when identity evidence is weak.',
    policyEngineConcept: 'automation_readiness',
  },
]);

const DEFAULT_POLICY_SETUP_COPY = deepFreeze(POLICY_UX_TERMS.map(term => ({
  termId: term.id,
  label: term.label,
  question: term.plainQuestion,
  helperText: term.helper,
  selectionPatternId: term.selectionPatternId,
})));

const POLICY_SETUP_STEPS = deepFreeze([
  {
    id: POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION,
    order: 1,
    title: 'Start with what exists',
    questionId: MENTAL_MODEL_QUESTION_IDS.OBSERVED_BELONGS_HERE,
    termIds: [
      POLICY_UX_TERM_IDS.BELONGS_HERE,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    allowedSelectionPatternIds: [
      POLICY_UX_SELECTION_PATTERN_IDS.OBSERVED_SUGGESTION_MULTI_SELECT,
    ],
    operatorAction: 'Review observed examples and accept only the values that should define this destination.',
  },
  {
    id: POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    order: 2,
    title: 'State what should happen',
    questionId: MENTAL_MODEL_QUESTION_IDS.DECLARED_LIMITS,
    termIds: [
      POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
      POLICY_UX_TERM_IDS.HARD_LIMITS,
      POLICY_UX_TERM_IDS.AVOID,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    allowedSelectionPatternIds: [
      POLICY_UX_SELECTION_PATTERN_IDS.DECLARED_SIGNAL_MULTI_SELECT,
      POLICY_UX_SELECTION_PATTERN_IDS.DECLARED_CONSTRAINT_MULTI_SELECT,
    ],
    operatorAction: 'Add explicit operator intent for soft matches, blocking rules, and poor-fit warnings.',
  },
  {
    id: POLICY_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
    order: 3,
    title: 'Choose when Classifarr should ask',
    questionId: MENTAL_MODEL_QUESTION_IDS.REVIEW_BEHAVIOR,
    termIds: [
      POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
      POLICY_UX_TERM_IDS.READINESS,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    allowedSelectionPatternIds: [
      POLICY_UX_SELECTION_PATTERN_IDS.REVIEW_TRIGGER_CHECKLIST,
      POLICY_UX_SELECTION_PATTERN_IDS.NEXT_ACTION_STATUS,
    ],
    operatorAction: 'Set review triggers and show the next action when evidence, intent, or freshness is not safe enough to automate.',
  },
  {
    id: POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    order: 4,
    title: 'Confirm routing readiness',
    questionId: MENTAL_MODEL_QUESTION_IDS.ROUTING_TARGET,
    termIds: [
      POLICY_UX_TERM_IDS.ROUTING_TARGET,
      POLICY_UX_TERM_IDS.READINESS,
    ],
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    allowedSelectionPatternIds: [
      POLICY_UX_SELECTION_PATTERN_IDS.ROUTING_READINESS_SUMMARY,
      POLICY_UX_SELECTION_PATTERN_IDS.NEXT_ACTION_STATUS,
    ],
    operatorAction: 'Confirm where approved matches can be sent and explain any remaining setup action.',
  },
]);

const DEFAULT_POLICY_SETUP_CARDS = deepFreeze([
  {
    stepId: POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION,
    heading: 'What already belongs here?',
    helperText: 'Use the current library as suggestions. Accept only the values that should describe this destination going forward.',
    primaryActionLabel: 'Review suggestions',
    emptyState: 'Classifarr has not found enough current-library examples yet. You can still declare what belongs here.',
    completionSignal: 'Accepted observed suggestions become declared destination meaning.',
    termIds: [
      POLICY_UX_TERM_IDS.BELONGS_HERE,
    ],
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    heading: 'What should always or never belong here?',
    helperText: 'Add explicit operator intent for helpful matches, hard limits, and avoid values.',
    primaryActionLabel: 'Set destination rules',
    emptyState: 'No declared rules yet. Classifarr can use observed evidence, but clear rules improve automation.',
    completionSignal: 'Declared rules can define, block, or warn before this destination is chosen.',
    termIds: [
      POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
      POLICY_UX_TERM_IDS.HARD_LIMITS,
      POLICY_UX_TERM_IDS.AVOID,
    ],
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
    heading: 'When should Classifarr ask?',
    helperText: 'Choose review triggers for missing, conflicting, stale, or unsafe evidence.',
    primaryActionLabel: 'Set review triggers',
    emptyState: 'No review triggers configured. Classifarr will still ask when readiness is not safe enough to automate.',
    completionSignal: 'Review behavior controls when Classifarr asks instead of learning or routing automatically.',
    termIds: [
      POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
      POLICY_UX_TERM_IDS.READINESS,
    ],
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    heading: 'Can this destination route?',
    helperText: 'Confirm where approved matches can be sent and show the next setup action when routing is incomplete.',
    primaryActionLabel: 'Check routing readiness',
    emptyState: 'No routing target is ready yet. Classification can still review matches before routing is enabled.',
    completionSignal: 'Routing readiness confirms the destination can apply approved matches safely.',
    termIds: [
      POLICY_UX_TERM_IDS.ROUTING_TARGET,
      POLICY_UX_TERM_IDS.READINESS,
    ],
  },
]);

const POLICY_SETUP_SURFACE_CONTRACTS = deepFreeze([
  {
    stepId: POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION,
    roleId: POLICY_SETUP_SURFACE_ROLE_IDS.OBSERVED_SUGGESTION_REVIEW,
    actionKindId: POLICY_SETUP_ACTION_KIND_IDS.REVIEW_SUGGESTIONS,
    operatorDecision: 'Accept observed suggestions as declared destination meaning, edit them, or leave them as evidence only.',
    systemResponsibility: 'Show current media-server examples as suggestions without silently turning them into rules.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canEditDeclaredIntent: true,
    canPersistPolicyIntent: false,
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    roleId: POLICY_SETUP_SURFACE_ROLE_IDS.DECLARED_INTENT_EDIT,
    actionKindId: POLICY_SETUP_ACTION_KIND_IDS.EDIT_DESTINATION_RULES,
    operatorDecision: 'Declare helpful matches, hard limits, or avoid values that should shape this destination.',
    systemResponsibility: 'Capture explicit operator intent without relying on hidden scoring or template mechanics.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canEditDeclaredIntent: true,
    canPersistPolicyIntent: false,
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
    roleId: POLICY_SETUP_SURFACE_ROLE_IDS.REVIEW_BEHAVIOR_EDIT,
    actionKindId: POLICY_SETUP_ACTION_KIND_IDS.CONFIGURE_REVIEW_TRIGGERS,
    operatorDecision: 'Choose when Classifarr should ask instead of automating.',
    systemResponsibility: 'Keep review behavior separate from final item outcomes and durable learning.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canEditDeclaredIntent: true,
    canPersistPolicyIntent: false,
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    roleId: POLICY_SETUP_SURFACE_ROLE_IDS.READINESS_STATUS,
    actionKindId: POLICY_SETUP_ACTION_KIND_IDS.CHECK_ROUTING_READINESS,
    operatorDecision: 'Review whether confirmed matches have a safe route and the next setup action when they do not.',
    systemResponsibility: 'Report readiness status without executing Arr writes or changing policy intent.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    canEditDeclaredIntent: false,
    canPersistPolicyIntent: false,
  },
]);

const DEFAULT_POLICY_SETUP_JOURNEY_STAGES = deepFreeze([
  {
    stepId: POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION,
    order: 1,
    operatorGoal: 'Understand what the current library already appears to contain.',
    primaryActionLabels: [
      'Review suggestions',
    ],
    completionSignal: 'The operator accepted, edited, or skipped observed suggestions without treating them as hidden rules.',
    systemBoundary: 'Show observed media-server evidence as suggestions only.',
    failureModeToAvoid: 'Do not make current contents silently become hard limits or durable intent.',
    canPersistPolicyIntent: false,
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    order: 2,
    operatorGoal: 'State the destination rules that should guide future decisions.',
    primaryActionLabels: [
      'Set destination rules',
    ],
    completionSignal: 'Declared belongs-here, helpful, hard-limit, or avoid choices are ready for explicit save.',
    systemBoundary: 'Capture draft intent without saving until the operator uses the policy save action.',
    failureModeToAvoid: 'Do not ask the operator to tune weights or raw template mechanics before meaning is clear.',
    canPersistPolicyIntent: false,
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
    order: 3,
    operatorGoal: 'Choose when automation should stop and ask.',
    primaryActionLabels: [
      'Set review triggers',
    ],
    completionSignal: 'Review triggers are configured or the default readiness guard remains responsible for unsafe cases.',
    systemBoundary: 'Keep review behavior separate from final outcomes and durable learning.',
    failureModeToAvoid: 'Do not turn every manual answer into learning or a policy rewrite.',
    canPersistPolicyIntent: false,
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    order: 4,
    operatorGoal: 'Confirm whether accepted matches can be routed safely.',
    primaryActionLabels: [
      'Check routing readiness',
    ],
    completionSignal: 'Routing is ready, or the next setup action is visible without blocking declared intent review.',
    systemBoundary: 'Report readiness without executing Arr writes or changing policy intent.',
    failureModeToAvoid: 'Do not present routing availability as classification confidence.',
    canPersistPolicyIntent: false,
  },
]);

const DEFAULT_POLICY_SETUP_FIELD_GROUPS = deepFreeze([
  {
    groupId: POLICY_UX_TERM_IDS.BELONGS_HERE,
    stepId: POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION,
    termId: POLICY_UX_TERM_IDS.BELONGS_HERE,
    label: 'Belongs Here',
    instruction: 'Select one or more current-library suggestions only when they truly describe this destination.',
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.OBSERVED_MULTI_SELECT,
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canAcceptObservedSuggestions: true,
    canEditDeclaredIntent: true,
    canPersistPolicyIntent: false,
  },
  {
    groupId: POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
    stepId: POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    termId: POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
    label: 'Helpful Matches',
    instruction: 'Select one or more soft signals that can help after the destination already looks plausible.',
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.DECLARED_MULTI_SELECT,
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canAcceptObservedSuggestions: false,
    canEditDeclaredIntent: true,
    canPersistPolicyIntent: false,
  },
  {
    groupId: POLICY_UX_TERM_IDS.HARD_LIMITS,
    stepId: POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    termId: POLICY_UX_TERM_IDS.HARD_LIMITS,
    label: 'Hard Limits',
    instruction: 'Select one or more explicit rules that should block this destination.',
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.DECLARED_MULTI_SELECT,
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canAcceptObservedSuggestions: false,
    canEditDeclaredIntent: true,
    canPersistPolicyIntent: false,
  },
  {
    groupId: POLICY_UX_TERM_IDS.AVOID,
    stepId: POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    termId: POLICY_UX_TERM_IDS.AVOID,
    label: 'Avoid',
    instruction: 'Select one or more poor-fit values that should lower confidence without becoming hard limits by default.',
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.DECLARED_MULTI_SELECT,
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canAcceptObservedSuggestions: false,
    canEditDeclaredIntent: true,
    canPersistPolicyIntent: false,
  },
  {
    groupId: POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
    stepId: POLICY_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
    termId: POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE,
    label: 'Ask When Unsure',
    instruction: 'Choose one or more review triggers that should stop automation and ask the operator.',
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.DECLARED_CHECKLIST,
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canAcceptObservedSuggestions: false,
    canEditDeclaredIntent: true,
    canPersistPolicyIntent: false,
  },
  {
    groupId: POLICY_UX_TERM_IDS.ROUTING_TARGET,
    stepId: POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    termId: POLICY_UX_TERM_IDS.ROUTING_TARGET,
    label: 'Routing Target',
    instruction: 'Show the configured route for confirmed matches and the next setup action when routing is not ready.',
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.STATUS_SUMMARY,
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canAcceptObservedSuggestions: false,
    canEditDeclaredIntent: false,
    canPersistPolicyIntent: false,
  },
  {
    groupId: POLICY_UX_TERM_IDS.READINESS,
    stepId: POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    termId: POLICY_UX_TERM_IDS.READINESS,
    label: 'Readiness',
    instruction: 'Show the next action when observed evidence, declared intent, profile freshness, or routing is incomplete.',
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.NEXT_ACTION_STATUS,
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    canAcceptObservedSuggestions: false,
    canEditDeclaredIntent: false,
    canPersistPolicyIntent: false,
  },
]);

const DEFAULT_POLICY_SETUP_ANSWER_SHAPES = deepFreeze([
  {
    stepId: POLICY_SETUP_STEP_IDS.OBSERVED_APPLICATION,
    questionId: MENTAL_MODEL_QUESTION_IDS.OBSERVED_BELONGS_HERE,
    answerKindId: POLICY_SETUP_ANSWER_KIND_IDS.ACCEPT_OBSERVED_SUGGESTIONS,
    operatorResponse: 'Accept one or more observed suggestions, edit them, or leave them as evidence only.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canCreateDraftIntent: true,
    canPersistPolicyIntent: false,
    canCreateLearning: false,
    canExecuteRouting: false,
    requiresExplicitAcceptance: true,
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
    questionId: MENTAL_MODEL_QUESTION_IDS.DECLARED_LIMITS,
    answerKindId: POLICY_SETUP_ANSWER_KIND_IDS.DECLARE_DESTINATION_RULES,
    operatorResponse: 'Declare belongs-here, helpful, hard-limit, or avoid values as draft destination intent.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canCreateDraftIntent: true,
    canPersistPolicyIntent: false,
    canCreateLearning: false,
    canExecuteRouting: false,
    requiresExplicitAcceptance: false,
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
    questionId: MENTAL_MODEL_QUESTION_IDS.REVIEW_BEHAVIOR,
    answerKindId: POLICY_SETUP_ANSWER_KIND_IDS.CONFIGURE_REVIEW_TRIGGERS,
    operatorResponse: 'Choose review triggers that should make Classifarr ask instead of automate.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    ],
    canCreateDraftIntent: true,
    canPersistPolicyIntent: false,
    canCreateLearning: false,
    canExecuteRouting: false,
    requiresExplicitAcceptance: false,
  },
  {
    stepId: POLICY_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    questionId: MENTAL_MODEL_QUESTION_IDS.ROUTING_TARGET,
    answerKindId: POLICY_SETUP_ANSWER_KIND_IDS.REVIEW_READINESS_STATUS,
    operatorResponse: 'Review the routing target and next setup action without changing policy intent.',
    authoritySourceIds: [
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    ],
    canCreateDraftIntent: false,
    canPersistPolicyIntent: false,
    canCreateLearning: false,
    canExecuteRouting: false,
    requiresExplicitAcceptance: false,
  },
]);

function listPolicySetupQuestions() {
  return POLICY_USER_MENTAL_MODEL.setupQuestions;
}

function listPolicyUxTerms() {
  return POLICY_UX_TERMS;
}

function listDefaultPolicySetupCopy() {
  return DEFAULT_POLICY_SETUP_COPY;
}

function listPolicySetupSteps() {
  return POLICY_SETUP_STEPS;
}

function listDefaultPolicySetupCards() {
  return DEFAULT_POLICY_SETUP_CARDS;
}

function listPolicySetupSurfaceContracts() {
  return POLICY_SETUP_SURFACE_CONTRACTS;
}

function listDefaultPolicySetupJourneyStages() {
  return DEFAULT_POLICY_SETUP_JOURNEY_STAGES;
}

function listDefaultPolicySetupFieldGroups() {
  return DEFAULT_POLICY_SETUP_FIELD_GROUPS;
}

function listDefaultPolicySetupAnswerShapes() {
  return DEFAULT_POLICY_SETUP_ANSWER_SHAPES;
}

function getPolicyUxTerm(termId) {
  return POLICY_UX_TERMS.find(term => term.id === termId) || null;
}

function getPolicySetupQuestion(questionId) {
  return POLICY_USER_MENTAL_MODEL.setupQuestions.find(question => question.id === questionId) || null;
}

function getPolicySetupStep(stepId) {
  return POLICY_SETUP_STEPS.find(step => step.id === stepId) || null;
}

function getPolicySetupCard(stepId) {
  return DEFAULT_POLICY_SETUP_CARDS.find(card => card.stepId === stepId) || null;
}

function getPolicySetupSurfaceContract(stepId) {
  return POLICY_SETUP_SURFACE_CONTRACTS.find(surface => surface.stepId === stepId) || null;
}

function getPolicySetupJourneyStage(stepId) {
  return DEFAULT_POLICY_SETUP_JOURNEY_STAGES.find(stage => stage.stepId === stepId) || null;
}

function getPolicySetupFieldGroup(groupId) {
  return DEFAULT_POLICY_SETUP_FIELD_GROUPS.find(group => group.groupId === groupId) || null;
}

function getPolicySetupAnswerShape(stepId) {
  return DEFAULT_POLICY_SETUP_ANSWER_SHAPES.find(shape => shape.stepId === stepId) || null;
}

function getPolicyUserMentalModel() {
  return POLICY_USER_MENTAL_MODEL;
}

function includesInternalPolicyLanguage(text) {
  const normalizedText = String(text || '').toLowerCase();

  return INTERNAL_LANGUAGE_FLAGS.some(flag => normalizedText.includes(flag.toLowerCase()));
}

function listInternalPolicyLanguageFlags() {
  return INTERNAL_LANGUAGE_FLAGS;
}

function isKnownSelectionPattern(selectionPatternId) {
  return Object.values(POLICY_UX_SELECTION_PATTERN_IDS).includes(selectionPatternId);
}

function isKnownSetupSurfaceRole(roleId) {
  return Object.values(POLICY_SETUP_SURFACE_ROLE_IDS).includes(roleId);
}

function isKnownSetupActionKind(actionKindId) {
  return Object.values(POLICY_SETUP_ACTION_KIND_IDS).includes(actionKindId);
}

function isKnownSetupFieldControlKind(controlKindId) {
  return Object.values(POLICY_SETUP_FIELD_CONTROL_KIND_IDS).includes(controlKindId);
}

function isKnownSetupAnswerKind(answerKindId) {
  return Object.values(POLICY_SETUP_ANSWER_KIND_IDS).includes(answerKindId);
}

function includesAnyLanguage(text, phrases) {
  const normalizedText = String(text || '').toLowerCase();

  return phrases.some(phrase => normalizedText.includes(phrase.toLowerCase()));
}

function normalizePolicySetupCopy(candidate = {}) {
  const term = getPolicyUxTerm(candidate.termId);
  const label = String(candidate.label || '').trim();
  const helperText = String(candidate.helperText || '').trim();
  const supportingText = [
    label,
    helperText,
    candidate.question,
    candidate.bodyText,
    candidate.disabledReason,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    termId: String(candidate.termId || '').trim(),
    label,
    helperText,
    expectedLabel: term?.label || null,
    supportingText,
  };
}

function validatePolicyUxTermContract(term = {}) {
  const issues = [];
  const authoritySourceIds = Array.isArray(term.authoritySourceIds) ? term.authoritySourceIds : [];

  if (!String(term.label || '').trim()) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_LABEL,
      message: 'Policy UX term must expose a visible label.',
    });
  }

  if (!String(term.plainQuestion || '').trim()) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_PLAIN_QUESTION,
      message: 'Policy UX term must expose a plain setup question.',
    });
  }

  if (!String(term.helper || '').trim()) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_HELPER,
      message: 'Policy UX term must expose helper text.',
    });
  }

  if (!isKnownSelectionPattern(term.selectionPatternId)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.UNKNOWN_SELECTION_PATTERN,
      message: 'Policy UX term must map to an approved interaction pattern.',
    });
  }

  if (!String(term.policyEngineConcept || '').trim()) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_POLICY_ENGINE_CONCEPT,
      message: 'Policy UX term must map to a policy engine concept.',
    });
  }

  if (term.mustMentionObservedEvidence &&
      !authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_OBSERVED_EVIDENCE_SOURCE,
      message: 'Observed-evidence copy must include media-server contents as an authority source.',
    });
  }

  if (term.mustMentionDeclaredIntent &&
      !authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.MISSING_DECLARED_INTENT_SOURCE,
      message: 'Declared-intent copy must include operator-declared intent as an authority source.',
    });
  }

  if (term.id === POLICY_UX_TERM_IDS.HARD_LIMITS &&
      authoritySourceIds.some(sourceId => sourceId !== AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.HARD_LIMITS_ALLOW_OBSERVED_EVIDENCE,
      message: 'Hard Limits must remain explicit operator intent only.',
    });
  }

  const termText = [
    term.label,
    term.plainQuestion,
    term.helper,
    term.broadGenreRule,
  ]
    .filter(Boolean)
    .join(' ');

  if (includesInternalPolicyLanguage(termText)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
      message: 'Policy UX term must avoid internal diagnostic or scoring language.',
    });
  }

  if (includesAnyLanguage(termText, BROAD_GENRE_AUTHORITY_LANGUAGE)) {
    issues.push({
      riskId: POLICY_UX_TERM_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      message: 'Policy UX term must not present broad genres as the authority that decides destination fit.',
    });
  }

  return {
    ok: issues.length === 0,
    termId: term.id || null,
    selectionPatternId: term.selectionPatternId || null,
    issues,
  };
}

function buildPolicyUserMentalModelAudit({
  terms = POLICY_UX_TERMS,
  setupCopy = DEFAULT_POLICY_SETUP_COPY,
  answerShapes = DEFAULT_POLICY_SETUP_ANSWER_SHAPES,
} = {}) {
  const termResults = terms.map(term => validatePolicyUxTermContract(term));
  const setupCopyAudit = buildPolicySetupCopyAudit(setupCopy);
  const setupStepAudit = buildPolicySetupStepAudit();
  const setupCardAudit = buildPolicySetupCardAudit();
  const setupSurfaceAudit = buildPolicySetupSurfaceAudit();
  const setupJourneyAudit = buildPolicySetupJourneyAudit();
  const setupFieldGroupAudit = buildPolicySetupFieldGroupAudit();
  const setupAnswerShapeAudit = buildPolicySetupAnswerShapeAudit(answerShapes);
  const issueCount = termResults.reduce((count, result) => count + result.issues.length, 0) +
    setupCopyAudit.issueCount +
    setupStepAudit.issueCount +
    setupCardAudit.issueCount +
    setupSurfaceAudit.issueCount +
    setupJourneyAudit.issueCount +
    setupFieldGroupAudit.issueCount +
    setupAnswerShapeAudit.issueCount;

  return {
    ok: issueCount === 0,
    checkedTermCount: termResults.length,
    checkedSetupCopyCount: setupCopyAudit.checkedCount,
    checkedSetupStepCount: setupStepAudit.checkedCount,
    checkedSetupCardCount: setupCardAudit.checkedCount,
    checkedSetupSurfaceCount: setupSurfaceAudit.checkedCount,
    checkedSetupJourneyCount: setupJourneyAudit.checkedCount,
    checkedSetupFieldGroupCount: setupFieldGroupAudit.checkedCount,
    checkedSetupAnswerShapeCount: setupAnswerShapeAudit.checkedCount,
    issueCount,
    termResults,
    setupCopyAudit,
    setupStepAudit,
    setupCardAudit,
    setupSurfaceAudit,
    setupJourneyAudit,
    setupFieldGroupAudit,
    setupAnswerShapeAudit,
  };
}

function validatePolicySetupStepContract(step = {}) {
  const record = getPolicySetupStep(step.id);
  const candidate = {
    ...record,
    ...asStepObject(step),
  };
  const issues = [];
  const question = getPolicySetupQuestion(candidate.questionId);
  const termIds = Array.isArray(candidate.termIds) ? candidate.termIds : [];
  const authoritySourceIds = Array.isArray(candidate.authoritySourceIds) ? candidate.authoritySourceIds : [];
  const allowedSelectionPatternIds = Array.isArray(candidate.allowedSelectionPatternIds)
    ? candidate.allowedSelectionPatternIds
    : [];

  if (!record) {
    issues.push({
      riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.UNKNOWN_STEP,
      stepId: step.id || null,
      message: 'Setup step must be part of the policy-authoring setup model.',
    });
  }

  if (!String(candidate.title || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.MISSING_TITLE,
      stepId: candidate.id || null,
      message: 'Setup step must expose a short title.',
    });
  }

  if (!String(candidate.operatorAction || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.MISSING_OPERATOR_ACTION,
      stepId: candidate.id || null,
      message: 'Setup step must explain the operator action.',
    });
  }

  if (!question) {
    issues.push({
      riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.UNKNOWN_QUESTION,
      stepId: candidate.id || null,
      questionId: candidate.questionId || null,
      message: 'Setup step must map to one approved setup question.',
    });
  }

  if (termIds.length === 0) {
    issues.push({
      riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.MISSING_TERM,
      stepId: candidate.id || null,
      message: 'Setup step must map to at least one approved UX term.',
    });
  }

  for (const termId of termIds) {
    const term = getPolicyUxTerm(termId);
    if (!term) {
      issues.push({
        riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.UNKNOWN_TERM,
        stepId: candidate.id || null,
        termId,
        message: 'Setup step references an unknown UX term.',
      });
      continue;
    }

    if (!allowedSelectionPatternIds.includes(term.selectionPatternId)) {
      issues.push({
        riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.TERM_PATTERN_NOT_ALLOWED,
        stepId: candidate.id || null,
        termId,
        selectionPatternId: term.selectionPatternId,
        message: 'Setup step must explicitly allow each term interaction pattern.',
      });
    }

    if (term.mustMentionObservedEvidence &&
        !authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS)) {
      issues.push({
        riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.MISSING_OBSERVED_EVIDENCE_SOURCE,
        stepId: candidate.id || null,
        termId,
        message: 'Setup step using observed-evidence terms must include media-server contents as a source.',
      });
    }

    if (term.mustMentionDeclaredIntent &&
        !authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
      issues.push({
        riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.MISSING_DECLARED_INTENT_SOURCE,
        stepId: candidate.id || null,
        termId,
        message: 'Setup step using declared-intent terms must include operator-declared intent as a source.',
      });
    }
  }

  for (const selectionPatternId of allowedSelectionPatternIds) {
    if (!isKnownSelectionPattern(selectionPatternId)) {
      issues.push({
        riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.UNKNOWN_SELECTION_PATTERN,
        stepId: candidate.id || null,
        selectionPatternId,
        message: 'Setup step must use approved interaction patterns.',
      });
    }
  }

  const stepText = [
    candidate.title,
    candidate.operatorAction,
    question?.question,
  ]
    .filter(Boolean)
    .join(' ');

  if (includesInternalPolicyLanguage(stepText)) {
    issues.push({
      riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
      stepId: candidate.id || null,
      message: 'Setup step must avoid internal diagnostic or scoring language.',
    });
  }

  if (includesAnyLanguage(stepText, BROAD_GENRE_AUTHORITY_LANGUAGE)) {
    issues.push({
      riskId: POLICY_SETUP_STEP_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      stepId: candidate.id || null,
      message: 'Setup step must not present broad genres as the authority that decides destination fit.',
    });
  }

  return {
    ok: issues.length === 0,
    stepId: candidate.id || null,
    questionId: candidate.questionId || null,
    issues,
  };
}

function asStepObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildPolicySetupStepAudit(steps = POLICY_SETUP_STEPS) {
  const results = (Array.isArray(steps) ? steps : [])
    .map(step => validatePolicySetupStepContract(step));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function validatePolicySetupCardContract(card = {}) {
  const step = getPolicySetupStep(card.stepId);
  const issues = [];
  const termIds = Array.isArray(card.termIds) ? card.termIds : [];

  if (!step) {
    issues.push({
      riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.UNKNOWN_STEP,
      stepId: card.stepId || null,
      message: 'Setup card must map to one approved policy-authoring setup step.',
    });
  }

  if (!String(card.heading || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.MISSING_HEADING,
      stepId: card.stepId || null,
      message: 'Setup card must expose a plain heading.',
    });
  }

  if (!step?.questionId || !getPolicySetupQuestion(step.questionId)) {
    issues.push({
      riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.MISSING_QUESTION,
      stepId: card.stepId || null,
      message: 'Setup card must inherit an approved setup question.',
    });
  }

  if (!String(card.helperText || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.MISSING_HELPER,
      stepId: card.stepId || null,
      message: 'Setup card must explain the operator decision.',
    });
  }

  if (!String(card.primaryActionLabel || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.MISSING_PRIMARY_ACTION,
      stepId: card.stepId || null,
      message: 'Setup card must expose one primary action label.',
    });
  }

  if (!String(card.emptyState || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.MISSING_EMPTY_STATE,
      stepId: card.stepId || null,
      message: 'Setup card must explain the empty state.',
    });
  }

  if (!String(card.completionSignal || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.MISSING_COMPLETION_SIGNAL,
      stepId: card.stepId || null,
      message: 'Setup card must explain what complete means.',
    });
  }

  if (termIds.length === 0) {
    issues.push({
      riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.MISSING_TERM,
      stepId: card.stepId || null,
      message: 'Setup card must map to at least one approved UX term.',
    });
  }

  for (const termId of termIds) {
    if (!getPolicyUxTerm(termId)) {
      issues.push({
        riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.UNKNOWN_TERM,
        stepId: card.stepId || null,
        termId,
        message: 'Setup card references an unknown UX term.',
      });
    }
  }

  const cardText = [
    card.heading,
    card.helperText,
    card.primaryActionLabel,
    card.emptyState,
    card.completionSignal,
  ]
    .filter(Boolean)
    .join(' ');

  if (includesInternalPolicyLanguage(cardText)) {
    issues.push({
      riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
      stepId: card.stepId || null,
      message: 'Setup card must avoid internal diagnostic or scoring language.',
    });
  }

  if (includesAnyLanguage(cardText, BROAD_GENRE_AUTHORITY_LANGUAGE)) {
    issues.push({
      riskId: POLICY_SETUP_CARD_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      stepId: card.stepId || null,
      message: 'Setup card must not present broad genres as the authority that decides destination fit.',
    });
  }

  return {
    ok: issues.length === 0,
    stepId: card.stepId || null,
    issues,
  };
}

function buildPolicySetupCardAudit(cards = DEFAULT_POLICY_SETUP_CARDS) {
  const results = (Array.isArray(cards) ? cards : [])
    .map(card => validatePolicySetupCardContract(card));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function validatePolicySetupSurfaceContract(surface = {}) {
  const record = getPolicySetupSurfaceContract(surface.stepId);
  const candidate = {
    ...record,
    ...asStepObject(surface),
  };
  const issues = [];
  const authoritySourceIds = Array.isArray(candidate.authoritySourceIds) ? candidate.authoritySourceIds : [];
  const roleId = candidate.roleId || null;

  if (!getPolicySetupStep(candidate.stepId)) {
    issues.push({
      riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.UNKNOWN_STEP,
      stepId: candidate.stepId || null,
      message: 'Setup surface must map to one approved policy-authoring setup step.',
    });
  }

  if (!isKnownSetupSurfaceRole(roleId)) {
    issues.push({
      riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.UNKNOWN_ROLE,
      stepId: candidate.stepId || null,
      roleId,
      message: 'Setup surface must use an approved surface role.',
    });
  }

  if (!isKnownSetupActionKind(candidate.actionKindId)) {
    issues.push({
      riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.UNKNOWN_ACTION_KIND,
      stepId: candidate.stepId || null,
      actionKindId: candidate.actionKindId || null,
      message: 'Setup surface must use an approved action kind.',
    });
  }

  if (!String(candidate.operatorDecision || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.MISSING_OPERATOR_DECISION,
      stepId: candidate.stepId || null,
      message: 'Setup surface must state the operator decision.',
    });
  }

  if (!String(candidate.systemResponsibility || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.MISSING_SYSTEM_RESPONSIBILITY,
      stepId: candidate.stepId || null,
      message: 'Setup surface must state the system responsibility.',
    });
  }

  if (candidate.canPersistPolicyIntent === true) {
    issues.push({
      riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.DIRECT_POLICY_PERSISTENCE,
      stepId: candidate.stepId || null,
      message: 'Setup surfaces may edit or review draft intent, but persistence belongs to a separate save path.',
    });
  }

  if (roleId === POLICY_SETUP_SURFACE_ROLE_IDS.OBSERVED_SUGGESTION_REVIEW) {
    if (!authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS)) {
      issues.push({
        riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.OBSERVED_SURFACE_MISSING_EVIDENCE_SOURCE,
        stepId: candidate.stepId || null,
        message: 'Observed suggestion surfaces must include media-server contents as evidence.',
      });
    }

    if (!authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
      issues.push({
        riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.OBSERVED_SURFACE_MISSING_DECLARED_INTENT_SOURCE,
        stepId: candidate.stepId || null,
        message: 'Observed suggestion surfaces must require operator-declared intent before suggestions become rules.',
      });
    }
  }

  if ([
    POLICY_SETUP_SURFACE_ROLE_IDS.DECLARED_INTENT_EDIT,
    POLICY_SETUP_SURFACE_ROLE_IDS.REVIEW_BEHAVIOR_EDIT,
  ].includes(roleId)) {
    if (candidate.canEditDeclaredIntent !== true) {
      issues.push({
        riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.DECLARED_SURFACE_CANNOT_EDIT,
        stepId: candidate.stepId || null,
        message: 'Declared-intent setup surfaces must allow explicit operator edits.',
      });
    }

    if (!authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
      issues.push({
        riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.DECLARED_SURFACE_MISSING_OPERATOR_SOURCE,
        stepId: candidate.stepId || null,
        message: 'Declared-intent setup surfaces must include operator-declared intent as the authority source.',
      });
    }
  }

  if (roleId === POLICY_SETUP_SURFACE_ROLE_IDS.READINESS_STATUS &&
      candidate.canEditDeclaredIntent === true) {
    issues.push({
      riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.READINESS_SURFACE_CAN_EDIT,
      stepId: candidate.stepId || null,
      message: 'Readiness status surfaces must report next action without editing declared intent.',
    });
  }

  const surfaceText = [
    candidate.operatorDecision,
    candidate.systemResponsibility,
  ]
    .filter(Boolean)
    .join(' ');

  if (includesInternalPolicyLanguage(surfaceText)) {
    issues.push({
      riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
      stepId: candidate.stepId || null,
      message: 'Setup surface must avoid internal diagnostic or scoring language.',
    });
  }

  if (includesAnyLanguage(surfaceText, BROAD_GENRE_AUTHORITY_LANGUAGE)) {
    issues.push({
      riskId: POLICY_SETUP_SURFACE_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      stepId: candidate.stepId || null,
      message: 'Setup surface must not present broad genres as the authority that decides destination fit.',
    });
  }

  return {
    ok: issues.length === 0,
    stepId: candidate.stepId || null,
    roleId,
    actionKindId: candidate.actionKindId || null,
    issues,
  };
}

function buildPolicySetupSurfaceAudit(surfaces = POLICY_SETUP_SURFACE_CONTRACTS) {
  const results = (Array.isArray(surfaces) ? surfaces : [])
    .map(surface => validatePolicySetupSurfaceContract(surface));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function validatePolicySetupJourneyStageContract(stage = {}) {
  const step = getPolicySetupStep(stage.stepId);
  const issues = [];
  const primaryActionLabels = Array.isArray(stage.primaryActionLabels)
    ? stage.primaryActionLabels.filter(label => String(label || '').trim())
    : [];

  if (!step) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.UNKNOWN_STEP,
      stepId: stage.stepId || null,
      message: 'Setup journey stage must map to one approved policy-authoring setup step.',
    });
  }

  if (step && stage.order !== step.order) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.INVALID_ORDER,
      stepId: stage.stepId || null,
      message: 'Setup journey stage order must match the approved policy-authoring setup step order.',
    });
  }

  if (!String(stage.operatorGoal || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.MISSING_OPERATOR_GOAL,
      stepId: stage.stepId || null,
      message: 'Setup journey stage must state the operator goal.',
    });
  }

  if (primaryActionLabels.length === 0) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.MISSING_PRIMARY_ACTION,
      stepId: stage.stepId || null,
      message: 'Setup journey stage must expose one primary action.',
    });
  }

  if (primaryActionLabels.length > 1) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.TOO_MANY_PRIMARY_ACTIONS,
      stepId: stage.stepId || null,
      message: 'Setup journey stage must keep one primary action to reduce decision load.',
    });
  }

  if (!String(stage.completionSignal || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.MISSING_COMPLETION_SIGNAL,
      stepId: stage.stepId || null,
      message: 'Setup journey stage must define what complete means.',
    });
  }

  if (!String(stage.systemBoundary || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.MISSING_SYSTEM_BOUNDARY,
      stepId: stage.stepId || null,
      message: 'Setup journey stage must state what the system may and may not do.',
    });
  }

  if (!String(stage.failureModeToAvoid || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.MISSING_FAILURE_MODE,
      stepId: stage.stepId || null,
      message: 'Setup journey stage must name the failure mode it prevents.',
    });
  }

  if (stage.canPersistPolicyIntent === true) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.DIRECT_POLICY_PERSISTENCE,
      stepId: stage.stepId || null,
      message: 'Setup journey stages may guide draft work but cannot directly persist policy intent.',
    });
  }

  const stageText = [
    stage.operatorGoal,
    ...primaryActionLabels,
    stage.completionSignal,
    stage.systemBoundary,
    stage.failureModeToAvoid,
  ]
    .filter(Boolean)
    .join(' ');

  if (includesInternalPolicyLanguage(stageText)) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
      stepId: stage.stepId || null,
      message: 'Setup journey stage must avoid internal diagnostic or scoring language.',
    });
  }

  if (includesAnyLanguage(stageText, BROAD_GENRE_AUTHORITY_LANGUAGE)) {
    issues.push({
      riskId: POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      stepId: stage.stepId || null,
      message: 'Setup journey stage must not present broad genres as the authority that decides destination fit.',
    });
  }

  return {
    ok: issues.length === 0,
    stepId: stage.stepId || null,
    order: stage.order || null,
    issues,
  };
}

function buildPolicySetupJourneyAudit(stages = DEFAULT_POLICY_SETUP_JOURNEY_STAGES) {
  const results = (Array.isArray(stages) ? stages : [])
    .map(stage => validatePolicySetupJourneyStageContract(stage));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function validatePolicySetupFieldGroupContract(group = {}) {
  const record = getPolicySetupFieldGroup(group.groupId);
  const candidate = {
    ...record,
    ...asStepObject(group),
  };
  const issues = [];
  const term = getPolicyUxTerm(candidate.termId);
  const authoritySourceIds = Array.isArray(candidate.authoritySourceIds) ? candidate.authoritySourceIds : [];

  if (!record) {
    issues.push({
      riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.UNKNOWN_FIELD_GROUP,
      groupId: group.groupId || null,
      message: 'Setup field group must be part of the policy-authoring setup model.',
    });
  }

  if (!getPolicySetupStep(candidate.stepId)) {
    issues.push({
      riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.UNKNOWN_STEP,
      groupId: candidate.groupId || null,
      stepId: candidate.stepId || null,
      message: 'Setup field group must map to one approved setup step.',
    });
  }

  if (!term) {
    issues.push({
      riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.UNKNOWN_TERM,
      groupId: candidate.groupId || null,
      termId: candidate.termId || null,
      message: 'Setup field group must map to one approved UX term.',
    });
  } else if (candidate.label !== term.label) {
    issues.push({
      riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.MISMATCHED_LABEL,
      groupId: candidate.groupId || null,
      termId: candidate.termId,
      message: `Setup field group label must use the approved "${term.label}" label.`,
    });
  }

  if (!String(candidate.instruction || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.MISSING_INSTRUCTION,
      groupId: candidate.groupId || null,
      message: 'Setup field group must provide a plain instruction.',
    });
  }

  if (!isKnownSetupFieldControlKind(candidate.controlKindId)) {
    issues.push({
      riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.UNKNOWN_CONTROL_KIND,
      groupId: candidate.groupId || null,
      controlKindId: candidate.controlKindId || null,
      message: 'Setup field group must use an approved control kind.',
    });
  }

  if (candidate.canPersistPolicyIntent === true) {
    issues.push({
      riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.DIRECT_POLICY_PERSISTENCE,
      groupId: candidate.groupId || null,
      message: 'Setup field groups may edit draft intent but cannot directly persist policy intent.',
    });
  }

  if (candidate.controlKindId === POLICY_SETUP_FIELD_CONTROL_KIND_IDS.OBSERVED_MULTI_SELECT) {
    if (!authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS)) {
      issues.push({
        riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.OBSERVED_CONTROL_MISSING_EVIDENCE_SOURCE,
        groupId: candidate.groupId || null,
        message: 'Observed multi-select controls must include media-server contents as evidence.',
      });
    }

    if (!authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
      issues.push({
        riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.OBSERVED_CONTROL_MISSING_DECLARED_INTENT_SOURCE,
        groupId: candidate.groupId || null,
        message: 'Observed multi-select controls must require operator acceptance before suggestions become intent.',
      });
    }

    if (candidate.canAcceptObservedSuggestions !== true) {
      issues.push({
        riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.OBSERVED_CONTROL_CANNOT_ACCEPT_SUGGESTIONS,
        groupId: candidate.groupId || null,
        message: 'Observed multi-select controls must accept observed suggestions explicitly.',
      });
    }
  }

  if ([
    POLICY_SETUP_FIELD_CONTROL_KIND_IDS.DECLARED_MULTI_SELECT,
    POLICY_SETUP_FIELD_CONTROL_KIND_IDS.DECLARED_CHECKLIST,
  ].includes(candidate.controlKindId)) {
    if (!authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT)) {
      issues.push({
        riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.DECLARED_CONTROL_MISSING_OPERATOR_SOURCE,
        groupId: candidate.groupId || null,
        message: 'Declared controls must include operator-declared intent as the authority source.',
      });
    }

    if (candidate.canEditDeclaredIntent !== true) {
      issues.push({
        riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.DECLARED_CONTROL_CANNOT_EDIT,
        groupId: candidate.groupId || null,
        message: 'Declared controls must allow explicit operator edits.',
      });
    }
  }

  if ([
    POLICY_SETUP_FIELD_CONTROL_KIND_IDS.STATUS_SUMMARY,
    POLICY_SETUP_FIELD_CONTROL_KIND_IDS.NEXT_ACTION_STATUS,
  ].includes(candidate.controlKindId) && candidate.canEditDeclaredIntent === true) {
    issues.push({
      riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.STATUS_CONTROL_CAN_EDIT,
      groupId: candidate.groupId || null,
      message: 'Status controls must report state without editing declared intent.',
    });
  }

  const fieldGroupText = [
    candidate.label,
    candidate.instruction,
  ]
    .filter(Boolean)
    .join(' ');

  if (includesInternalPolicyLanguage(fieldGroupText)) {
    issues.push({
      riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
      groupId: candidate.groupId || null,
      message: 'Setup field group must avoid internal diagnostic or scoring language.',
    });
  }

  if (includesAnyLanguage(fieldGroupText, BROAD_GENRE_AUTHORITY_LANGUAGE)) {
    issues.push({
      riskId: POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      groupId: candidate.groupId || null,
      message: 'Setup field group must not present broad genres as the authority that decides destination fit.',
    });
  }

  return {
    ok: issues.length === 0,
    groupId: candidate.groupId || null,
    stepId: candidate.stepId || null,
    termId: candidate.termId || null,
    controlKindId: candidate.controlKindId || null,
    issues,
  };
}

function buildPolicySetupFieldGroupAudit(groups = DEFAULT_POLICY_SETUP_FIELD_GROUPS) {
  const results = (Array.isArray(groups) ? groups : [])
    .map(group => validatePolicySetupFieldGroupContract(group));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function validatePolicySetupAnswerShapeContract(shape = {}) {
  const record = getPolicySetupAnswerShape(shape.stepId);
  const candidate = {
    ...record,
    ...asStepObject(shape),
  };
  const issues = [];
  const step = getPolicySetupStep(candidate.stepId);
  const authoritySourceIds = Array.isArray(candidate.authoritySourceIds) ? candidate.authoritySourceIds : [];

  if (!step) {
    issues.push({
      riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.UNKNOWN_STEP,
      stepId: candidate.stepId || null,
      message: 'Setup answer shape must map to one approved setup step.',
    });
  }

  if (!isKnownSetupAnswerKind(candidate.answerKindId)) {
    issues.push({
      riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.UNKNOWN_ANSWER_KIND,
      stepId: candidate.stepId || null,
      answerKindId: candidate.answerKindId || null,
      message: 'Setup answer shape must use an approved answer kind.',
    });
  }

  if (!String(candidate.operatorResponse || '').trim()) {
    issues.push({
      riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.MISSING_OPERATOR_RESPONSE,
      stepId: candidate.stepId || null,
      message: 'Setup answer shape must explain what the operator answer means.',
    });
  }

  if (authoritySourceIds.length === 0) {
    issues.push({
      riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.MISSING_AUTHORITY_SOURCE,
      stepId: candidate.stepId || null,
      message: 'Setup answer shape must name the authority source for the answer.',
    });
  }

  if (candidate.canPersistPolicyIntent === true) {
    issues.push({
      riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.DIRECT_POLICY_PERSISTENCE,
      stepId: candidate.stepId || null,
      message: 'Setup answers may shape draft intent, but persistence belongs to the explicit save path.',
    });
  }

  if (candidate.canCreateLearning === true) {
    issues.push({
      riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.DIRECT_LEARNING,
      stepId: candidate.stepId || null,
      message: 'Setup answers must not create durable learning directly.',
    });
  }

  if (candidate.canExecuteRouting === true) {
    issues.push({
      riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.DIRECT_ROUTING_EXECUTION,
      stepId: candidate.stepId || null,
      message: 'Setup answers must not execute routing directly.',
    });
  }

  if (candidate.answerKindId === POLICY_SETUP_ANSWER_KIND_IDS.ACCEPT_OBSERVED_SUGGESTIONS) {
    if (!authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS) ||
        !authoritySourceIds.includes(AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT) ||
        candidate.requiresExplicitAcceptance !== true) {
      issues.push({
        riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.OBSERVED_ANSWER_MISSING_ACCEPTANCE,
        stepId: candidate.stepId || null,
        message: 'Observed answer shapes must combine media-server evidence with explicit operator acceptance.',
      });
    }
  }

  if (candidate.answerKindId === POLICY_SETUP_ANSWER_KIND_IDS.REVIEW_READINESS_STATUS &&
      candidate.canCreateDraftIntent === true) {
    issues.push({
      riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.STATUS_ANSWER_CAN_EDIT,
      stepId: candidate.stepId || null,
      message: 'Readiness answer shapes must report status without editing draft intent.',
    });
  }

  const answerText = [
    candidate.operatorResponse,
  ]
    .filter(Boolean)
    .join(' ');

  if (includesInternalPolicyLanguage(answerText)) {
    issues.push({
      riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
      stepId: candidate.stepId || null,
      message: 'Setup answer shape must avoid internal diagnostic or scoring language.',
    });
  }

  if (includesAnyLanguage(answerText, BROAD_GENRE_AUTHORITY_LANGUAGE)) {
    issues.push({
      riskId: POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      stepId: candidate.stepId || null,
      message: 'Setup answer shape must not present broad genres as the authority that decides destination fit.',
    });
  }

  return {
    ok: issues.length === 0,
    stepId: candidate.stepId || null,
    questionId: candidate.questionId || null,
    answerKindId: candidate.answerKindId || null,
    issues,
  };
}

function buildPolicySetupAnswerShapeAudit(answerShapes = DEFAULT_POLICY_SETUP_ANSWER_SHAPES) {
  const results = (Array.isArray(answerShapes) ? answerShapes : [])
    .map(shape => validatePolicySetupAnswerShapeContract(shape));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function validatePolicySetupCopy(candidate = {}) {
  const normalizedCopy = normalizePolicySetupCopy(candidate);
  const term = getPolicyUxTerm(normalizedCopy.termId);
  const issues = [];

  if (!term) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.KNOWN_UX_TERM,
      riskId: POLICY_SETUP_COPY_RISK_IDS.UNKNOWN_UX_TERM,
      message: 'Setup copy must map to an approved policy-authoring UX term.',
    });
  }

  if (!normalizedCopy.label) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.VISIBLE_LABEL,
      riskId: POLICY_SETUP_COPY_RISK_IDS.MISSING_VISIBLE_LABEL,
      message: 'Setup copy must expose a visible label.',
    });
  } else if (term && normalizedCopy.label !== term.label) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.VISIBLE_LABEL,
      riskId: POLICY_SETUP_COPY_RISK_IDS.MISMATCHED_VISIBLE_LABEL,
      message: `Setup copy label must use the approved "${term.label}" label.`,
    });
  }

  if (!normalizedCopy.helperText) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.HELPER_TEXT,
      riskId: POLICY_SETUP_COPY_RISK_IDS.MISSING_HELPER_TEXT,
      message: 'Setup copy must include helper text that explains the operator decision.',
    });
  }

  if (term?.mustMentionObservedEvidence &&
      !includesAnyLanguage(normalizedCopy.supportingText, OBSERVED_EVIDENCE_LANGUAGE)) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.OBSERVED_EVIDENCE_CONTEXT,
      riskId: POLICY_SETUP_COPY_RISK_IDS.MISSING_OBSERVED_EVIDENCE_CONTEXT,
      message: 'Setup copy must explain when observed library evidence is being used.',
    });
  }

  if (term?.mustMentionDeclaredIntent &&
      !includesAnyLanguage(normalizedCopy.supportingText, DECLARED_INTENT_LANGUAGE)) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.DECLARED_INTENT_CONTEXT,
      riskId: POLICY_SETUP_COPY_RISK_IDS.MISSING_DECLARED_INTENT_CONTEXT,
      message: 'Setup copy must explain when operator-declared intent is required.',
    });
  }

  if (includesInternalPolicyLanguage(normalizedCopy.supportingText)) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.NO_INTERNAL_LANGUAGE,
      riskId: POLICY_SETUP_COPY_RISK_IDS.INTERNAL_POLICY_LANGUAGE,
      message: 'Setup copy must avoid internal diagnostic or scoring language.',
    });
  }

  if (includesAnyLanguage(normalizedCopy.supportingText, BROAD_GENRE_AUTHORITY_LANGUAGE)) {
    issues.push({
      ruleId: POLICY_SETUP_COPY_RULE_IDS.NO_BROAD_GENRE_AUTHORITY,
      riskId: POLICY_SETUP_COPY_RISK_IDS.BROAD_GENRE_AUTHORITY_LANGUAGE,
      message: 'Setup copy must not present broad genres as the authority that decides destination fit.',
    });
  }

  return {
    ok: issues.length === 0,
    termId: normalizedCopy.termId,
    expectedLabel: normalizedCopy.expectedLabel,
    issues,
  };
}

function buildPolicySetupCopyAudit(candidates = []) {
  const results = candidates.map(candidate => validatePolicySetupCopy(candidate));
  const issueCount = results.reduce((count, result) => count + result.issues.length, 0);

  return {
    ok: issueCount === 0,
    checkedCount: results.length,
    issueCount,
    results,
  };
}

function getDurableAuthorityTermIds() {
  return POLICY_UX_TERMS
    .filter(term => term.authoritySourceIds.some(sourceId => isDurablePolicyAuthority(sourceId)))
    .map(term => term.id);
}

export {
  MENTAL_MODEL_QUESTION_IDS,
  POLICY_SETUP_ACTION_KIND_IDS,
  POLICY_SETUP_ANSWER_KIND_IDS,
  POLICY_SETUP_ANSWER_SHAPE_AUDIT_RISK_IDS,
  POLICY_SETUP_COPY_RISK_IDS,
  POLICY_SETUP_COPY_RULE_IDS,
  POLICY_SETUP_CARD_AUDIT_RISK_IDS,
  POLICY_SETUP_FIELD_CONTROL_KIND_IDS,
  POLICY_SETUP_FIELD_GROUP_AUDIT_RISK_IDS,
  POLICY_SETUP_JOURNEY_AUDIT_RISK_IDS,
  POLICY_SETUP_SURFACE_AUDIT_RISK_IDS,
  POLICY_SETUP_SURFACE_ROLE_IDS,
  POLICY_SETUP_STEP_AUDIT_RISK_IDS,
  POLICY_SETUP_STEP_IDS,
  POLICY_UX_SELECTION_PATTERN_IDS,
  POLICY_UX_TERM_AUDIT_RISK_IDS,
  POLICY_UX_TERM_IDS,
  buildPolicySetupCardAudit,
  buildPolicySetupAnswerShapeAudit,
  buildPolicySetupFieldGroupAudit,
  buildPolicySetupJourneyAudit,
  buildPolicySetupStepAudit,
  buildPolicySetupSurfaceAudit,
  buildPolicyUserMentalModelAudit,
  buildPolicySetupCopyAudit,
  getDurableAuthorityTermIds,
  getPolicySetupAnswerShape,
  getPolicySetupCard,
  getPolicySetupFieldGroup,
  getPolicySetupJourneyStage,
  getPolicySetupSurfaceContract,
  listDefaultPolicySetupCopy,
  listDefaultPolicySetupAnswerShapes,
  listDefaultPolicySetupCards,
  listDefaultPolicySetupFieldGroups,
  listDefaultPolicySetupJourneyStages,
  getPolicySetupQuestion,
  getPolicySetupStep,
  getPolicyUserMentalModel,
  getPolicyUxTerm,
  includesInternalPolicyLanguage,
  listInternalPolicyLanguageFlags,
  listPolicySetupQuestions,
  listPolicySetupSurfaceContracts,
  listPolicySetupSteps,
  listPolicyUxTerms,
  normalizePolicySetupCopy,
  validatePolicySetupCardContract,
  validatePolicySetupAnswerShapeContract,
  validatePolicySetupFieldGroupContract,
  validatePolicySetupJourneyStageContract,
  validatePolicySetupStepContract,
  validatePolicySetupSurfaceContract,
  validatePolicyUxTermContract,
  validatePolicySetupCopy,
};
