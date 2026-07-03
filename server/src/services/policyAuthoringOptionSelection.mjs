import {
  POLICY_AUTHORING_COMPONENT_IDS,
  POLICY_AUTHORING_INTERACTION_RULE_IDS,
  POLICY_AUTHORING_OPTION_SOURCE_IDS,
  getPolicyAuthoringOptionSourceRecord,
} from './policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from './policyAuthoringDestinationFlow.mjs';

const POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS = Object.freeze({
  READ_ONLY_EVIDENCE: 'read_only_evidence',
  SELECTABLE_SUGGESTION: 'selectable_suggestion',
  SELECTABLE_CUSTOM_VALUE: 'selectable_custom_value',
  DISABLED_ALREADY_DECLARED: 'disabled_already_declared',
  DISABLED_CONFLICTING_INTENT: 'disabled_conflicting_intent',
});

const POLICY_AUTHORING_OPTION_SELECTION_COMMAND_IDS = Object.freeze({
  ADD_SIGNAL_VALUE: 'add_signal_value',
});

const POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS = Object.freeze({
  UNKNOWN_OPTION_SOURCE: 'unknown_option_source',
  UNKNOWN_SELECTION_STATE: 'unknown_selection_state',
  MISSING_OPTION_VALUE: 'missing_option_value',
  MISSING_EXPLANATION: 'missing_explanation',
  MISSING_EVIDENCE: 'missing_evidence',
  OBSERVED_EVIDENCE_AUTO_DECLARED: 'observed_evidence_auto_declared',
  BROAD_GENRE_WITHOUT_SUPPORTING_EVIDENCE: 'broad_genre_without_supporting_evidence',
  DISABLED_WITHOUT_REASON: 'disabled_without_reason',
  RAW_BRIDGE_MUTATION: 'raw_bridge_mutation',
});

const POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS = Object.freeze({
  EVIDENCE_COUNT: 'evidence_count',
  CONFIDENCE: 'confidence',
  SOURCE_LABEL: 'source_label',
  EXPLANATION: 'explanation',
  DISABLED_REASON: 'disabled_reason',
});

const BROAD_IDENTITY_GENRES = new Set([
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'family',
  'fantasy',
  'horror',
  'romance',
  'science fiction',
  'thriller',
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

function toCleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNullableNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function clampConfidence(value) {
  const numericValue = toNullableNumber(value);
  if (numericValue === null) {
    return null;
  }

  return Math.max(0, Math.min(1, numericValue));
}

const POLICY_AUTHORING_OPTION_SELECTION_SOURCE_BEHAVIORS = deepFreeze([
  {
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
    selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.READ_ONLY_EVIDENCE,
    visibleGroupLabel: 'Already in this library',
    selectable: false,
    readOnlyEvidence: true,
    requiresEvidence: true,
    requiresExplanation: true,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
    mayShowEvidenceCount: true,
    mayShowConfidence: true,
  },
  {
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
    selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.SELECTABLE_SUGGESTION,
    visibleGroupLabel: 'Suggested from this library',
    selectable: true,
    readOnlyEvidence: false,
    requiresEvidence: false,
    requiresExplanation: true,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
    mayShowEvidenceCount: true,
    mayShowConfidence: true,
  },
  {
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
    selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.SELECTABLE_SUGGESTION,
    visibleGroupLabel: 'Suggested by starter template',
    selectable: true,
    readOnlyEvidence: false,
    requiresEvidence: false,
    requiresExplanation: true,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
    mayShowEvidenceCount: false,
    mayShowConfidence: false,
  },
  {
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
    selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.SELECTABLE_SUGGESTION,
    visibleGroupLabel: 'Common options',
    selectable: true,
    readOnlyEvidence: false,
    requiresEvidence: false,
    requiresExplanation: false,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
    mayShowEvidenceCount: false,
    mayShowConfidence: false,
  },
  {
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
    selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.SELECTABLE_CUSTOM_VALUE,
    visibleGroupLabel: 'Custom value',
    selectable: true,
    readOnlyEvidence: false,
    requiresEvidence: false,
    requiresExplanation: true,
    requiresExplicitAcceptance: true,
    canAutoDeclare: false,
    mayShowEvidenceCount: false,
    mayShowConfidence: false,
  },
  {
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.ALREADY_DECLARED,
    selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.DISABLED_ALREADY_DECLARED,
    visibleGroupLabel: 'Already added',
    selectable: false,
    readOnlyEvidence: false,
    requiresEvidence: false,
    requiresExplanation: true,
    requiresExplicitAcceptance: false,
    canAutoDeclare: false,
    mayShowEvidenceCount: false,
    mayShowConfidence: false,
  },
  {
    sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT,
    selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.DISABLED_CONFLICTING_INTENT,
    visibleGroupLabel: 'Unavailable',
    selectable: false,
    readOnlyEvidence: false,
    requiresEvidence: false,
    requiresExplanation: true,
    requiresExplicitAcceptance: false,
    canAutoDeclare: false,
    mayShowEvidenceCount: false,
    mayShowConfidence: false,
  },
]);

const SOURCE_BEHAVIOR_BY_ID = new Map(
  POLICY_AUTHORING_OPTION_SELECTION_SOURCE_BEHAVIORS.map(behavior => [behavior.sourceId, behavior]),
);

function listPolicyAuthoringOptionSelectionSourceBehaviors() {
  return POLICY_AUTHORING_OPTION_SELECTION_SOURCE_BEHAVIORS;
}

function getPolicyAuthoringOptionSelectionSourceBehavior(sourceId) {
  return SOURCE_BEHAVIOR_BY_ID.get(sourceId) || null;
}

function isBroadIdentityGenre(value) {
  return BROAD_IDENTITY_GENRES.has(toCleanString(value).toLowerCase());
}

function normalizePolicyAuthoringOptionCandidate(candidate = {}) {
  const sourceId = toCleanString(candidate.sourceId);
  const sourceBehavior = getPolicyAuthoringOptionSelectionSourceBehavior(sourceId);
  const sourceRecord = getPolicyAuthoringOptionSourceRecord(sourceId);
  const value = toCleanString(candidate.value);
  const label = toCleanString(candidate.label) || value;
  const explanation = toCleanString(candidate.explanation);
  const disabledReason = toCleanString(candidate.disabledReason);
  const evidenceCount = Math.max(0, toNullableNumber(candidate.evidenceCount) ?? 0);
  const confidence = clampConfidence(candidate.confidence);
  const sourceLabel = toCleanString(candidate.sourceLabel) ||
    sourceBehavior?.visibleGroupLabel ||
    sourceRecord?.visibleGroupLabel ||
    '';

  return {
    value,
    label,
    sourceId,
    sourceLabel,
    questionId: toCleanString(candidate.questionId) ||
      POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    selectionStateId: sourceBehavior?.selectionStateId || null,
    selectable: Boolean(sourceBehavior?.selectable),
    readOnlyEvidence: Boolean(sourceBehavior?.readOnlyEvidence),
    requiresEvidence: Boolean(sourceBehavior?.requiresEvidence),
    requiresExplanation: Boolean(sourceBehavior?.requiresExplanation),
    requiresExplicitAcceptance: Boolean(sourceBehavior?.requiresExplicitAcceptance),
    canAutoDeclare: false,
    autoDeclare: Boolean(candidate.autoDeclare),
    disabledReason,
    explanation,
    evidence: {
      count: evidenceCount,
      confidence,
    },
    commandId: sourceBehavior?.selectable ?
      POLICY_AUTHORING_OPTION_SELECTION_COMMAND_IDS.ADD_SIGNAL_VALUE :
      null,
  };
}

function validatePolicyAuthoringOptionCandidate(candidate = {}) {
  const normalizedCandidate = normalizePolicyAuthoringOptionCandidate(candidate);
  const sourceBehavior = getPolicyAuthoringOptionSelectionSourceBehavior(normalizedCandidate.sourceId);

  if (!sourceBehavior) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.UNKNOWN_OPTION_SOURCE,
      normalizedCandidate,
      reason: 'Option candidate has an unknown source.',
    };
  }

  if (!normalizedCandidate.selectionStateId) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.UNKNOWN_SELECTION_STATE,
      normalizedCandidate,
      reason: 'Option candidate has an unknown selection state.',
    };
  }

  if (!normalizedCandidate.value) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.MISSING_OPTION_VALUE,
      normalizedCandidate,
      reason: 'Option candidate needs a stable value.',
    };
  }

  if (normalizedCandidate.autoDeclare) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.OBSERVED_EVIDENCE_AUTO_DECLARED,
      normalizedCandidate,
      reason: 'Option candidates cannot auto-declare policy intent.',
    };
  }

  if (sourceBehavior.requiresEvidence && normalizedCandidate.evidence.count <= 0) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.MISSING_EVIDENCE,
      normalizedCandidate,
      reason: 'Observed library evidence must include a positive evidence count.',
    };
  }

  if (sourceBehavior.requiresExplanation && !normalizedCandidate.explanation && sourceBehavior.selectable) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.MISSING_EXPLANATION,
      normalizedCandidate,
      reason: 'Suggested or custom selectable options must explain why they are present.',
    };
  }

  if (!sourceBehavior.selectable && !sourceBehavior.readOnlyEvidence && !normalizedCandidate.disabledReason) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.DISABLED_WITHOUT_REASON,
      normalizedCandidate,
      reason: 'Disabled option candidates must explain why they cannot be selected.',
    };
  }

  if (
    normalizedCandidate.questionId === POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE &&
    isBroadIdentityGenre(normalizedCandidate.value) &&
    normalizedCandidate.evidence.count <= 0 &&
    [
      POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
    ].includes(normalizedCandidate.sourceId)
  ) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.BROAD_GENRE_WITHOUT_SUPPORTING_EVIDENCE,
      normalizedCandidate,
      reason: 'Broad identity genres need supporting evidence before they are framed as destination identity.',
    };
  }

  return {
    valid: true,
    riskId: null,
    normalizedCandidate,
    reason: 'Option candidate is source-labeled, explained when needed, and cannot auto-declare intent.',
  };
}

function buildPolicyAuthoringMultiSelectCommandPlan(candidates = []) {
  const validationResults = candidates.map(candidate => validatePolicyAuthoringOptionCandidate(candidate));
  const acceptedCandidates = validationResults
    .filter(result => result.valid && result.normalizedCandidate.selectable)
    .map(result => result.normalizedCandidate);
  const rejectedCandidates = validationResults
    .filter(result => !result.valid || !result.normalizedCandidate.selectable)
    .map(result => ({
      value: result.normalizedCandidate.value,
      sourceId: result.normalizedCandidate.sourceId,
      selectionStateId: result.normalizedCandidate.selectionStateId,
      valid: result.valid,
      riskId: result.riskId,
      reason: result.valid ?
        'Candidate is valid but not selectable through multi-select commands.' :
        result.reason,
    }));

  return {
    componentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
    interactionRuleId: POLICY_AUTHORING_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
    commandBoundary: 'typed_draft_commands',
    commandCount: acceptedCandidates.length,
    commands: acceptedCandidates.map(candidate => ({
      commandId: POLICY_AUTHORING_OPTION_SELECTION_COMMAND_IDS.ADD_SIGNAL_VALUE,
      value: candidate.value,
      label: candidate.label,
      sourceId: candidate.sourceId,
      questionId: candidate.questionId,
      explanation: candidate.explanation,
      evidence: candidate.evidence,
    })),
    rejectedCandidates,
  };
}

function validatePolicyAuthoringCommandPlanBoundary(commandPlan = {}) {
  if (commandPlan.commandBoundary !== 'typed_draft_commands') {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.RAW_BRIDGE_MUTATION,
      reason: 'Multi-select option selection must emit typed draft commands.',
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Multi-select option selection is constrained to typed draft commands.',
  };
}

function summarizePolicyAuthoringOptionSelection() {
  const selectableSourceIds = POLICY_AUTHORING_OPTION_SELECTION_SOURCE_BEHAVIORS
    .filter(behavior => behavior.selectable)
    .map(behavior => behavior.sourceId);
  const readOnlyEvidenceSourceIds = POLICY_AUTHORING_OPTION_SELECTION_SOURCE_BEHAVIORS
    .filter(behavior => behavior.readOnlyEvidence)
    .map(behavior => behavior.sourceId);
  const disabledSourceIds = POLICY_AUTHORING_OPTION_SELECTION_SOURCE_BEHAVIORS
    .filter(behavior => !behavior.selectable)
    .map(behavior => behavior.sourceId);

  return {
    optionSourceCount: POLICY_AUTHORING_OPTION_SELECTION_SOURCE_BEHAVIORS.length,
    selectableSourceIds,
    readOnlyEvidenceSourceIds,
    disabledSourceIds,
    evidenceFieldIds: Object.values(POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS),
    observedEvidenceAutoDeclares: false,
    commandBoundary: 'typed_draft_commands',
  };
}

export {
  POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS,
  POLICY_AUTHORING_OPTION_SELECTION_COMMAND_IDS,
  POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS,
  POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS,
  buildPolicyAuthoringMultiSelectCommandPlan,
  getPolicyAuthoringOptionSelectionSourceBehavior,
  isBroadIdentityGenre,
  listPolicyAuthoringOptionSelectionSourceBehaviors,
  normalizePolicyAuthoringOptionCandidate,
  summarizePolicyAuthoringOptionSelection,
  validatePolicyAuthoringCommandPlanBoundary,
  validatePolicyAuthoringOptionCandidate,
};
