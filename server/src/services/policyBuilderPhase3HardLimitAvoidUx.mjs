import {
  PHASE_3R_COMPONENT_IDS,
  PHASE_3R_INTERACTION_RULE_IDS,
} from './policyBuilderPhase3ComponentSystem.mjs';
import {
  PHASE_3R_DESTINATION_QUESTION_IDS,
} from './policyBuilderPhase3DestinationFirstFlow.mjs';

const PHASE_3R_CONSTRAINT_CONTROL_IDS = Object.freeze({
  HARD_LIMIT: 'hard_limit',
  AVOID: 'avoid',
  REVIEW_WARNING: 'review_warning',
});

const PHASE_3R_CONSTRAINT_INTENT_IDS = Object.freeze({
  BLOCKING_CONSTRAINT: 'blocking_constraint',
  ADVISORY_AVOID: 'advisory_avoid',
  NON_BLOCKING_WARNING: 'non_blocking_warning',
});

const PHASE_3R_CERTIFICATION_SEMANTIC_IDS = Object.freeze({
  MAX_ALLOWED_RATING: 'max_allowed_rating',
  AVOID_RATING: 'avoid_rating',
});

const PHASE_3R_CONSTRAINT_COMMAND_IDS = Object.freeze({
  SET_HARD_LIMIT: 'set_hard_limit',
  ADD_AVOID_VALUE: 'add_avoid_value',
  ADD_REVIEW_WARNING: 'add_review_warning',
});

const PHASE_3R_CONSTRAINT_SOURCE_IDS = Object.freeze({
  OPERATOR_DECLARED: 'operator_declared',
  STARTER_TEMPLATE_SUGGESTION: 'starter_template_suggestion',
  OBSERVED_ABSENCE_WARNING: 'observed_absence_warning',
  OBSERVED_CONFLICT_EXAMPLE: 'observed_conflict_example',
});

const PHASE_3R_CONSTRAINT_RISK_IDS = Object.freeze({
  UNKNOWN_CONTROL: 'unknown_control',
  UNKNOWN_SOURCE: 'unknown_source',
  UNKNOWN_CERTIFICATION_SEMANTIC: 'unknown_certification_semantic',
  MISSING_VALUE: 'missing_value',
  MISSING_EXPLICIT_OPERATOR_ACTION: 'missing_explicit_operator_action',
  ABSENCE_INFERRED_HARD_LIMIT: 'absence_inferred_hard_limit',
  ABSENCE_INFERRED_AVOID: 'absence_inferred_avoid',
  HINT_ESCALATED_TO_BLOCKER: 'hint_escalated_to_blocker',
  MAX_AND_AVOID_RATING_CONFLATED: 'max_and_avoid_rating_conflated',
  MISSING_BLOCK_EXAMPLE: 'missing_block_example',
  RAW_BRIDGE_MUTATION: 'raw_bridge_mutation',
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

function toCleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const PHASE_3R_CONSTRAINT_CONTROL_RECORDS = deepFreeze([
  {
    controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
    componentId: PHASE_3R_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    intentId: PHASE_3R_CONSTRAINT_INTENT_IDS.BLOCKING_CONSTRAINT,
    commandId: PHASE_3R_CONSTRAINT_COMMAND_IDS.SET_HARD_LIMIT,
    visibleLabel: 'Hard limit',
    operatorCopy: 'Blocks items that violate this destination boundary.',
    requiresExplicitOperatorAction: true,
    canBlockRouting: true,
    learnsFromAbsence: false,
    requiresBlockExampleWhenAvailable: true,
    certificationSemanticId: PHASE_3R_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING,
  },
  {
    controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID,
    componentId: PHASE_3R_COMPONENT_IDS.AVOID_CONTROL,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    intentId: PHASE_3R_CONSTRAINT_INTENT_IDS.ADVISORY_AVOID,
    commandId: PHASE_3R_CONSTRAINT_COMMAND_IDS.ADD_AVOID_VALUE,
    visibleLabel: 'Avoid',
    operatorCopy: 'Lowers confidence or asks for review without becoming a hard block by default.',
    requiresExplicitOperatorAction: true,
    canBlockRouting: false,
    learnsFromAbsence: false,
    requiresBlockExampleWhenAvailable: false,
    certificationSemanticId: PHASE_3R_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING,
  },
  {
    controlId: PHASE_3R_CONSTRAINT_CONTROL_IDS.REVIEW_WARNING,
    componentId: PHASE_3R_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    questionId: PHASE_3R_DESTINATION_QUESTION_IDS.WHEN_SHOULD_CLASSIFARR_ASK,
    intentId: PHASE_3R_CONSTRAINT_INTENT_IDS.NON_BLOCKING_WARNING,
    commandId: PHASE_3R_CONSTRAINT_COMMAND_IDS.ADD_REVIEW_WARNING,
    visibleLabel: 'Review warning',
    operatorCopy: 'Asks the operator when evidence is weak or missing.',
    requiresExplicitOperatorAction: false,
    canBlockRouting: false,
    learnsFromAbsence: false,
    requiresBlockExampleWhenAvailable: false,
    certificationSemanticId: null,
  },
]);

const CONTROL_BY_ID = new Map(
  PHASE_3R_CONSTRAINT_CONTROL_RECORDS.map(record => [record.controlId, record]),
);

const VALID_SOURCE_IDS = new Set(Object.values(PHASE_3R_CONSTRAINT_SOURCE_IDS));
const VALID_CERTIFICATION_SEMANTIC_IDS = new Set(Object.values(PHASE_3R_CERTIFICATION_SEMANTIC_IDS));

function listPhase3RConstraintControlRecords() {
  return PHASE_3R_CONSTRAINT_CONTROL_RECORDS;
}

function getPhase3RConstraintControlRecord(controlId) {
  return CONTROL_BY_ID.get(controlId) || null;
}

function normalizePhase3RConstraintCandidate(candidate = {}) {
  const controlId = toCleanString(candidate.controlId);
  const control = getPhase3RConstraintControlRecord(controlId);
  const values = asArray(candidate.values)
    .map(value => toCleanString(value))
    .filter(Boolean);
  const blockExamples = asArray(candidate.blockExamples)
    .map(example => toCleanString(example))
    .filter(Boolean);
  const certificationSemanticId = toCleanString(candidate.certificationSemanticId) ||
    control?.certificationSemanticId ||
    null;

  return {
    controlId,
    componentId: control?.componentId || null,
    questionId: control?.questionId || null,
    intentId: control?.intentId || null,
    commandId: control?.commandId || null,
    sourceId: toCleanString(candidate.sourceId),
    values,
    certificationSemanticId,
    explicitOperatorAction: Boolean(candidate.explicitOperatorAction),
    inferredFromAbsence: Boolean(candidate.inferredFromAbsence),
    blockExamples,
    commandBoundary: toCleanString(candidate.commandBoundary) || 'typed_draft_commands',
    canBlockRouting: Boolean(control?.canBlockRouting),
    learnsFromAbsence: false,
    requiresExplicitOperatorAction: Boolean(control?.requiresExplicitOperatorAction),
  };
}

function validatePhase3RConstraintCandidate(candidate = {}) {
  const normalizedCandidate = normalizePhase3RConstraintCandidate(candidate);
  const control = getPhase3RConstraintControlRecord(normalizedCandidate.controlId);

  if (!control) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.UNKNOWN_CONTROL,
      normalizedCandidate,
      reason: 'Constraint candidate uses an unknown control.',
    };
  }

  if (!VALID_SOURCE_IDS.has(normalizedCandidate.sourceId)) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.UNKNOWN_SOURCE,
      normalizedCandidate,
      reason: 'Constraint candidate source is not allowlisted.',
    };
  }

  if (normalizedCandidate.commandBoundary !== 'typed_draft_commands') {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.RAW_BRIDGE_MUTATION,
      normalizedCandidate,
      reason: 'Constraint controls must emit typed draft commands.',
    };
  }

  if (normalizedCandidate.values.length === 0) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.MISSING_VALUE,
      normalizedCandidate,
      reason: 'Constraint candidate must include at least one value.',
    };
  }

  if (control.requiresExplicitOperatorAction && !normalizedCandidate.explicitOperatorAction) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.MISSING_EXPLICIT_OPERATOR_ACTION,
      normalizedCandidate,
      reason: 'Hard limits and avoid values require explicit operator action.',
    };
  }

  if (
    normalizedCandidate.controlId === PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT &&
    normalizedCandidate.inferredFromAbsence
  ) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.ABSENCE_INFERRED_HARD_LIMIT,
      normalizedCandidate,
      reason: 'Observed absence cannot create a hard limit.',
    };
  }

  if (
    normalizedCandidate.controlId === PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID &&
    normalizedCandidate.inferredFromAbsence
  ) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.ABSENCE_INFERRED_AVOID,
      normalizedCandidate,
      reason: 'Observed absence cannot silently create an avoid rule.',
    };
  }

  if (
    normalizedCandidate.controlId === PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT &&
    normalizedCandidate.sourceId === PHASE_3R_CONSTRAINT_SOURCE_IDS.OBSERVED_ABSENCE_WARNING
  ) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.HINT_ESCALATED_TO_BLOCKER,
      normalizedCandidate,
      reason: 'Absence warnings must remain review warnings, not blocking hard limits.',
    };
  }

  if (
    normalizedCandidate.certificationSemanticId &&
    !VALID_CERTIFICATION_SEMANTIC_IDS.has(normalizedCandidate.certificationSemanticId)
  ) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.UNKNOWN_CERTIFICATION_SEMANTIC,
      normalizedCandidate,
      reason: 'Certification constraint semantic is not supported.',
    };
  }

  if (
    normalizedCandidate.controlId === PHASE_3R_CONSTRAINT_CONTROL_IDS.HARD_LIMIT &&
    normalizedCandidate.certificationSemanticId === PHASE_3R_CERTIFICATION_SEMANTIC_IDS.AVOID_RATING
  ) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.MAX_AND_AVOID_RATING_CONFLATED,
      normalizedCandidate,
      reason: 'Hard-limit rating controls must use max-allowed-rating semantics.',
    };
  }

  if (
    normalizedCandidate.controlId === PHASE_3R_CONSTRAINT_CONTROL_IDS.AVOID &&
    normalizedCandidate.certificationSemanticId === PHASE_3R_CERTIFICATION_SEMANTIC_IDS.MAX_ALLOWED_RATING
  ) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.MAX_AND_AVOID_RATING_CONFLATED,
      normalizedCandidate,
      reason: 'Avoid rating controls must use avoid-rating semantics.',
    };
  }

  if (
    control.requiresBlockExampleWhenAvailable &&
    normalizedCandidate.sourceId === PHASE_3R_CONSTRAINT_SOURCE_IDS.OBSERVED_CONFLICT_EXAMPLE &&
    normalizedCandidate.blockExamples.length === 0
  ) {
    return {
      valid: false,
      riskId: PHASE_3R_CONSTRAINT_RISK_IDS.MISSING_BLOCK_EXAMPLE,
      normalizedCandidate,
      reason: 'Hard-limit conflict suggestions need an example of what would be blocked.',
    };
  }

  return {
    valid: true,
    riskId: null,
    normalizedCandidate,
    reason: 'Constraint candidate is explicit, typed, and separated from advisory evidence.',
  };
}

function buildPhase3RConstraintCommandPlan(candidates = []) {
  const validationResults = candidates.map(candidate => validatePhase3RConstraintCandidate(candidate));
  const commands = validationResults
    .filter(result => result.valid)
    .map(result => result.normalizedCandidate)
    .map(candidate => ({
      commandId: candidate.commandId,
      controlId: candidate.controlId,
      values: candidate.values,
      sourceId: candidate.sourceId,
      certificationSemanticId: candidate.certificationSemanticId,
      blockExamples: candidate.blockExamples,
      questionId: candidate.questionId,
    }));

  return {
    commandBoundary: 'typed_draft_commands',
    interactionRuleIds: [
      PHASE_3R_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
      PHASE_3R_INTERACTION_RULE_IDS.DESTRUCTIVE_OR_BLOCKING_REQUIRES_CONFIRMATION,
    ],
    commandCount: commands.length,
    commands,
    rejectedCandidates: validationResults
      .filter(result => !result.valid)
      .map(result => ({
        controlId: result.normalizedCandidate.controlId,
        values: result.normalizedCandidate.values,
        sourceId: result.normalizedCandidate.sourceId,
        riskId: result.riskId,
        reason: result.reason,
      })),
  };
}

function summarizePhase3RHardLimitAvoidUx() {
  return {
    controlCount: PHASE_3R_CONSTRAINT_CONTROL_RECORDS.length,
    blockingControlIds: PHASE_3R_CONSTRAINT_CONTROL_RECORDS
      .filter(record => record.canBlockRouting)
      .map(record => record.controlId),
    advisoryControlIds: PHASE_3R_CONSTRAINT_CONTROL_RECORDS
      .filter(record => !record.canBlockRouting)
      .map(record => record.controlId),
    explicitOperatorActionControlIds: PHASE_3R_CONSTRAINT_CONTROL_RECORDS
      .filter(record => record.requiresExplicitOperatorAction)
      .map(record => record.controlId),
    absenceCanCreateConstraint: false,
    certificationSemanticIds: Object.values(PHASE_3R_CERTIFICATION_SEMANTIC_IDS),
    commandBoundary: 'typed_draft_commands',
  };
}

export {
  PHASE_3R_CERTIFICATION_SEMANTIC_IDS,
  PHASE_3R_CONSTRAINT_COMMAND_IDS,
  PHASE_3R_CONSTRAINT_CONTROL_IDS,
  PHASE_3R_CONSTRAINT_INTENT_IDS,
  PHASE_3R_CONSTRAINT_RISK_IDS,
  PHASE_3R_CONSTRAINT_SOURCE_IDS,
  buildPhase3RConstraintCommandPlan,
  getPhase3RConstraintControlRecord,
  listPhase3RConstraintControlRecords,
  normalizePhase3RConstraintCandidate,
  summarizePhase3RHardLimitAvoidUx,
  validatePhase3RConstraintCandidate,
};
