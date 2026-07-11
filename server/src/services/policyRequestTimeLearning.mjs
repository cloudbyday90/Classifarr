import {
  ANSWER_OUTCOME_IDS,
  QUESTION_FRAME_IDS,
} from './policyQuestionLearningVocabulary.mjs';
import {
  POLICY_LEARNING_DECISION_IDS,
  POLICY_LEARNING_EVENT_SOURCE_IDS,
  buildPolicyLearningDecision,
  validatePolicyLearningDecision,
} from './policyLearningGuard.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromRuntimeInput,
  validatePolicyRuntimeQuestionReduction,
} from './policyRuntimeQuestionReduction.mjs';
import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  buildPolicyRequestTimeEvent,
  validatePolicyRequestTimeEvent,
} from './policyRequestTimeEvent.mjs';
import {
  POLICY_FINAL_OUTCOME_STATUS_IDS,
  buildPolicyFinalOutcome,
  buildPolicyFinalOutcomeAudit,
} from './policyFinalOutcomeNormalizer.mjs';

const POLICY_REQUEST_LEARNING_DISPOSITION_IDS = Object.freeze({
  OUTCOME_ONLY: 'outcome_only',
  LEARNING_CANDIDATE: 'learning_candidate',
  POLICY_EDIT_REQUIRED: 'policy_edit_required',
  BLOCKED: 'blocked',
  ROUTE_FAILURE_ONLY: 'route_failure_only',
});

const POLICY_REQUEST_LEARNING_REASON_IDS = Object.freeze({
  REQUEST_CHOICE_RECORDED: 'request_choice_recorded',
  MANUAL_DESTINATION_CHANGE_RECORDED: 'manual_destination_change_recorded',
  ROUTE_SUCCESS_RECORDED: 'route_success_recorded',
  ROUTE_FAILURE_RECORDED: 'route_failure_recorded',
  ROUTE_FAILURE_NOT_EVIDENCE: 'route_failure_not_evidence',
  LEARNING_GUARD_REQUIRED: 'learning_guard_required',
  LEARNING_GUARD_APPROVED: 'learning_guard_approved',
  LEARNING_GUARD_BLOCKED: 'learning_guard_blocked',
  PROFILE_REFRESH_QUEUED_BY_GUARD: 'profile_refresh_queued_by_guard',
});

const POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_EVENT_TYPE: 'unknown_event_type',
  UNKNOWN_SOURCE: 'unknown_source',
  MISSING_DESTINATION_CHOICE: 'missing_destination_choice',
  MISSING_FINAL_OUTCOME: 'missing_final_outcome',
  INVALID_FINAL_OUTCOME: 'invalid_final_outcome',
  SELECTION_CONFLATED_WITH_FINAL_OUTCOME: 'selection_conflated_with_final_outcome',
  ROUTE_FAILURE_WRITES_LEARNING: 'route_failure_writes_learning',
  ROUTE_OUTCOME_WRITES_LEARNING: 'route_outcome_writes_learning',
  MANUAL_CHANGE_NOT_REVERSIBLE: 'manual_change_not_reversible',
  MISSING_LEARNING_GUARD: 'missing_learning_guard',
  INVALID_LEARNING_GUARD: 'invalid_learning_guard',
  DIRECT_SIDE_EFFECT: 'direct_side_effect',
  MISSING_TRACE_REASON: 'missing_trace_reason',
  MISSING_UPSTREAM_EVIDENCE_FINGERPRINT: 'missing_upstream_evidence_fingerprint',
  MISSING_TRACE_EVIDENCE_FINGERPRINT: 'missing_trace_evidence_fingerprint',
  LEARNING_GUARD_FINGERPRINT_MISMATCH: 'learning_guard_fingerprint_mismatch',
  TRACE_FINGERPRINT_MISMATCH: 'trace_fingerprint_mismatch',
  MISSING_QUESTION_REDUCTION_VALIDATION: 'missing_question_reduction_validation',
  INVALID_QUESTION_REDUCTION: 'invalid_question_reduction',
  QUESTION_REDUCTION_FINGERPRINT_MISMATCH: 'question_reduction_fingerprint_mismatch',
  TRACE_QUESTION_REDUCTION_VALID_MISMATCH: 'trace_question_reduction_valid_mismatch',
});

const EVENT_SOURCE_BY_TYPE = Object.freeze({
  [POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION]:
    POLICY_LEARNING_EVENT_SOURCE_IDS.REQUEST_DESTINATION_CHOICE,
  [POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE]:
    POLICY_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE,
  [POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED]:
    POLICY_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME,
  [POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING]:
    POLICY_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME,
});

const EVENT_REASON_BY_TYPE = Object.freeze({
  [POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION]:
    POLICY_REQUEST_LEARNING_REASON_IDS.REQUEST_CHOICE_RECORDED,
  [POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE]:
    POLICY_REQUEST_LEARNING_REASON_IDS.MANUAL_DESTINATION_CHANGE_RECORDED,
  [POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED]:
    POLICY_REQUEST_LEARNING_REASON_IDS.ROUTE_SUCCESS_RECORDED,
  [POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING]:
    POLICY_REQUEST_LEARNING_REASON_IDS.ROUTE_FAILURE_RECORDED,
});

const MAX_TRACE_REASONS = 12;
const REQUEST_LEARNING_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE =
  'classifarr.runtime.request_learning.upstream_evidence_fingerprint';
const REQUEST_LEARNING_QUESTION_REDUCTION_VALID_TRACE_ATTRIBUTE =
  'classifarr.runtime.request_learning.question_reduction_valid';
const REQUEST_TIME_LEARNING_DECISION_INPUT_KEYS = new Set([
  'questionReductionPlan',
  'requestEvent',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasValue(value) {
  return normalizeString(value).length > 0 || value !== null && value !== undefined && value !== '';
}

function destinationHasValue(destination = {}) {
  return hasValue(destination.libraryId) ||
    hasValue(destination.libraryName) ||
    hasValue(destination.arrConfigId) ||
    hasValue(destination.arrRootFolderPath);
}

function normalizeEvidenceFingerprint(value = {}) {
  const fingerprintSource = asObject(value);
  const provenance = asObject(fingerprintSource.provenance);
  const fingerprint = normalizeString(fingerprintSource.fingerprint);

  if (!fingerprint) return null;

  return {
    algorithm: normalizeString(fingerprintSource.algorithm) || null,
    fingerprint,
    provenance: {
      projectionVersion: normalizeString(provenance.projectionVersion) || null,
      evidenceVersion: normalizeString(provenance.evidenceVersion) || null,
      totalEntryCount: Number.isFinite(Number(provenance.totalEntryCount))
        ? Number(provenance.totalEntryCount)
        : 0,
      sourceIds: asArray(provenance.sourceIds).map(String).sort(),
      runtimeSourceIds: asArray(provenance.runtimeSourceIds).map(String).sort(),
      authoritySourceIds: asArray(provenance.authoritySourceIds).map(String).sort(),
      demotionReasonIds: asArray(provenance.demotionReasonIds).map(String).sort(),
      warningReasonIds: asArray(provenance.warningReasonIds).map(String).sort(),
      bucketCounts: asArray(provenance.bucketCounts)
        .map(bucket => ({
          bucketId: normalizeString(bucket?.bucketId) || null,
          entryCount: Number.isFinite(Number(bucket?.entryCount))
            ? Number(bucket.entryCount)
            : 0,
        }))
        .sort((left, right) => String(left.bucketId).localeCompare(String(right.bucketId))),
    },
  };
}

function getQuestionReductionEvidenceFingerprint(plan = {}) {
  return normalizeEvidenceFingerprint(asObject(plan).decisionEvidenceFingerprint);
}

function buildQuestionReductionProof(input = {}) {
  const plan = asObject(input.questionReductionPlan);

  if (!plan.version) return null;

  const validation = validatePolicyRuntimeQuestionReduction(plan);
  const decisionEvidenceFingerprint = normalizeEvidenceFingerprint(plan.decisionEvidenceFingerprint);
  const questionEvidenceFingerprint = normalizeEvidenceFingerprint(plan.question?.decisionEvidenceFingerprint);
  const traceEvidenceFingerprint = normalizeString(
    plan.trace?.attributes?.['classifarr.runtime.question.decision_evidence_projection_fingerprint']
  );

  return {
    version: normalizeString(plan.version),
    dispositionId: normalizeString(plan.dispositionId),
    createQuestion: plan.createQuestion === true,
    validation: {
      ok: validation.ok === true,
      issueCount: Number.isFinite(Number(validation.issueCount))
        ? Number(validation.issueCount)
        : asArray(validation.issues).length,
    },
    evidenceFingerprint: decisionEvidenceFingerprint
      ? {
        algorithm: decisionEvidenceFingerprint.algorithm,
        fingerprint: decisionEvidenceFingerprint.fingerprint,
      }
      : null,
    questionEvidenceFingerprint: questionEvidenceFingerprint
      ? {
        algorithm: questionEvidenceFingerprint.algorithm,
        fingerprint: questionEvidenceFingerprint.fingerprint,
      }
      : null,
    traceEvidenceFingerprint: traceEvidenceFingerprint || null,
  };
}

function defaultAnswerOutcomeForEvent(eventTypeId) {
  switch (eventTypeId) {
    case POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING:
      return ANSWER_OUTCOME_IDS.DO_NOT_LEARN;
    default:
      return ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM;
  }
}

function buildQuestionForLearning(questionReductionPlan = {}) {
  const plan = asObject(questionReductionPlan);

  return {
    frameId: plan.question?.frameId || plan.proposedFrameId || QUESTION_FRAME_IDS.DESTINATION_FIT,
    stale: plan.staleQuestionCleanup?.required === true,
  };
}

function buildAnswerFromDestination(destination = {}, answerInput = {}) {
  const answer = asObject(answerInput);

  return {
    label: normalizeString(answer.label) || normalizeString(destination.libraryName),
    destinationLibraryId: answer.destinationLibraryId ?? destination.libraryId ?? null,
    destinationLibraryName:
      normalizeString(answer.destinationLibraryName) || normalizeString(destination.libraryName),
    ambiguous: answer.ambiguous === true,
  };
}

function buildPolicyRequestFinalOutcome({
  eventTypeId,
  sourceId,
  item,
  finalDestination,
  routeResult,
}) {
  const routeFailed = eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING;
  const routeSucceeded = eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED;

  return buildPolicyFinalOutcome({
    sourceId,
    itemId: item.itemId,
    destinationLibraryId: finalDestination.libraryId,
    destinationLibraryName: finalDestination.libraryName,
    status: routeFailed
      ? POLICY_FINAL_OUTCOME_STATUS_IDS.ROUTE_FAILED_MISSING_MAPPING
      : routeSucceeded
        ? POLICY_FINAL_OUTCOME_STATUS_IDS.ROUTED
        : POLICY_FINAL_OUTCOME_STATUS_IDS.RESOLVED,
    route: routeResult,
  });
}

function buildSelection({
  eventTypeId,
  requestedDestination,
  operatorDestination,
  finalDestination,
  routeResult,
}) {
  return {
    requestDestinationChoice: eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION
      ? requestedDestination
      : null,
    operatorSelectedDestination: eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE
      ? operatorDestination
      : null,
    finalDestination,
    routeResult,
  };
}

function mapDisposition(learningDecision = {}, eventTypeId) {
  const learning = asObject(learningDecision.learning);

  if (eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING) {
    return POLICY_REQUEST_LEARNING_DISPOSITION_IDS.ROUTE_FAILURE_ONLY;
  }

  switch (learning.decisionId) {
    case POLICY_LEARNING_DECISION_IDS.CANDIDATE:
      return POLICY_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE;
    case POLICY_LEARNING_DECISION_IDS.POLICY_EDIT_REQUIRED:
      return POLICY_REQUEST_LEARNING_DISPOSITION_IDS.POLICY_EDIT_REQUIRED;
    case POLICY_LEARNING_DECISION_IDS.BLOCKED:
      return POLICY_REQUEST_LEARNING_DISPOSITION_IDS.BLOCKED;
    default:
      return POLICY_REQUEST_LEARNING_DISPOSITION_IDS.OUTCOME_ONLY;
  }
}

function buildTrace({
  eventTypeId,
  dispositionId,
  learningDecision,
  routeResult,
  upstreamEvidenceFingerprint,
  questionReductionProof,
}) {
  const reasons = [
    {
      reasonId: EVENT_REASON_BY_TYPE[eventTypeId] || POLICY_REQUEST_LEARNING_REASON_IDS.REQUEST_CHOICE_RECORDED,
      severity: 'info',
    },
    {
      reasonId: POLICY_REQUEST_LEARNING_REASON_IDS.LEARNING_GUARD_REQUIRED,
      severity: 'info',
    },
  ];

  if (routeResult.missingMapping === true) {
    reasons.push({
      reasonId: POLICY_REQUEST_LEARNING_REASON_IDS.ROUTE_FAILURE_NOT_EVIDENCE,
      severity: 'warning',
    });
  }

  if (learningDecision?.learning?.decisionId === POLICY_LEARNING_DECISION_IDS.CANDIDATE) {
    reasons.push({
      reasonId: POLICY_REQUEST_LEARNING_REASON_IDS.LEARNING_GUARD_APPROVED,
      severity: 'info',
    });
  }

  if (learningDecision?.learning?.decisionId === POLICY_LEARNING_DECISION_IDS.BLOCKED) {
    reasons.push({
      reasonId: POLICY_REQUEST_LEARNING_REASON_IDS.LEARNING_GUARD_BLOCKED,
      severity: 'warning',
    });
  }

  if (learningDecision?.profileRefresh?.queue === true) {
    reasons.push({
      reasonId: POLICY_REQUEST_LEARNING_REASON_IDS.PROFILE_REFRESH_QUEUED_BY_GUARD,
      severity: 'info',
    });
  }

  const boundedReasons = reasons.slice(0, MAX_TRACE_REASONS);

  const attributes = {
    'classifarr.runtime.request_learning.version': 'policy.request_time_learning.v1',
    'classifarr.runtime.request_learning.event_type': eventTypeId,
    'classifarr.runtime.request_learning.disposition': dispositionId,
    'classifarr.runtime.request_learning.reason_count': boundedReasons.length,
    'classifarr.runtime.request_learning.route_succeeded': routeResult.succeeded,
    'classifarr.runtime.request_learning.missing_mapping': routeResult.missingMapping,
    'classifarr.runtime.request_learning.profile_refresh_queued': learningDecision?.profileRefresh?.queue === true,
  };

  if (upstreamEvidenceFingerprint?.fingerprint) {
    attributes[REQUEST_LEARNING_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE] =
      upstreamEvidenceFingerprint.fingerprint;
  }

  if (questionReductionProof?.validation &&
      typeof questionReductionProof.validation.ok === 'boolean') {
    attributes[REQUEST_LEARNING_QUESTION_REDUCTION_VALID_TRACE_ATTRIBUTE] =
      questionReductionProof.validation.ok;
  }

  return {
    attributes,
    reasons: boundedReasons,
    truncated: reasons.length > boundedReasons.length,
  };
}

function requireValidQuestionReductionPlan(input = {}) {
  const decisionInput = asObject(input);
  const unexpectedInputKey = Object.keys(decisionInput).find(key =>
    !REQUEST_TIME_LEARNING_DECISION_INPUT_KEYS.has(key)
  );

  if (unexpectedInputKey) {
    throw new TypeError(
      `Request-time learning requires a normalized request event; raw input key "${unexpectedInputKey}" must use buildPolicyRequestTimeLearningDecisionFromRuntimeInput.`
    );
  }

  const plan = asObject(decisionInput.questionReductionPlan);
  if (plan.version !== 'policy.runtime_question_reduction.v1') {
    throw new TypeError(
      'Request-time learning requires a policy.runtime_question_reduction.v1 plan.'
    );
  }

  const validation = validatePolicyRuntimeQuestionReduction(plan);
  if (!validation.ok) {
    throw new TypeError('Request-time learning requires a valid question-reduction plan.');
  }

  return plan;
}

function requireValidRequestEvent(input = {}) {
  const requestEvent = asObject(asObject(input).requestEvent);
  const validation = validatePolicyRequestTimeEvent(requestEvent);

  if (!validation.ok) {
    throw new TypeError('Request-time learning requires a valid normalized request event.');
  }

  return requestEvent;
}

function buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan(input = {}) {
  const questionReductionPlan = requireValidQuestionReductionPlan(input);
  const requestEvent = requireValidRequestEvent(input);
  const eventTypeId = requestEvent.eventTypeId;
  const sourceId = EVENT_SOURCE_BY_TYPE[eventTypeId] || null;
  const item = requestEvent.item;
  const requestedDestination = requestEvent.requestedDestination;
  const operatorDestination = requestEvent.operatorDestination;
  const explicitFinalDestination = requestEvent.finalDestination;
  const finalDestination = destinationHasValue(explicitFinalDestination)
    ? explicitFinalDestination
    : eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE
      ? operatorDestination
      : requestedDestination;
  const routeResult = requestEvent.routeResult;
  const finalOutcome = buildPolicyRequestFinalOutcome({
    eventTypeId,
    sourceId,
    item,
    finalDestination,
    routeResult,
  });
  const upstreamEvidenceFingerprint = getQuestionReductionEvidenceFingerprint(questionReductionPlan);
  const questionReductionProof = buildQuestionReductionProof({ questionReductionPlan });
  const learningGuardContext = {
    ...requestEvent.learningContext,
    upstreamEvidenceFingerprint: upstreamEvidenceFingerprint
      ? {
        algorithm: upstreamEvidenceFingerprint.algorithm,
        fingerprint: upstreamEvidenceFingerprint.fingerprint,
      }
      : null,
  };
  const answerOutcomeId = requestEvent.answerOutcomeId || defaultAnswerOutcomeForEvent(eventTypeId);
  const learningDecision = buildPolicyLearningDecision({
    sourceId,
    answerOutcomeId,
    question: buildQuestionForLearning(questionReductionPlan),
    answer: buildAnswerFromDestination(finalDestination, requestEvent.answer),
    candidate: requestEvent.candidate,
    context: learningGuardContext,
    finalOutcome,
  });
  const learningValidation = validatePolicyLearningDecision(learningDecision);
  const dispositionId = mapDisposition(learningDecision, eventTypeId);

  return {
    version: 'policy.request_time_learning.v1',
    eventTypeId,
    sourceId,
    dispositionId,
    selection: buildSelection({
      eventTypeId,
      requestedDestination,
      operatorDestination,
      finalDestination,
      routeResult,
    }),
    item,
    finalOutcome,
    upstreamEvidenceFingerprint,
    questionReductionProof,
    learningGuardContext,
    learningDecision,
    learningValidation,
    profileRefresh: {
      queue: learningDecision.profileRefresh?.queue === true,
      reasonCodes: asArray(learningDecision.profileRefresh?.reasonCodes),
      queuedByLearningGuard: learningDecision.profileRefresh?.queue === true,
    },
    audit: {
      reversible: eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
      actorId: requestEvent.actorId,
      sourceEventId: requestEvent.sourceEventId,
      rollbackHint: eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE
        ? 'manual_destination_change_can_be_reverted_by_final_outcome_history'
        : null,
    },
    sideEffects: {
      finalOutcomeWritten: false,
      learningWritten: false,
      profileRefreshQueued: false,
    },
    trace: buildTrace({
      eventTypeId,
      dispositionId,
      learningDecision,
      routeResult,
      upstreamEvidenceFingerprint,
      questionReductionProof,
    }),
  };
}

function buildPolicyRequestTimeLearningDecisionFromRuntimeInput(input = {}) {
  const runtimeInput = asObject(input);

  if (Object.hasOwn(runtimeInput, 'questionReductionPlan') || Object.hasOwn(runtimeInput, 'requestEvent')) {
    throw new TypeError(
      'Request-time learning received a normalized upstream contract; use buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan.'
    );
  }

  const questionReductionPlan = buildPolicyRuntimeQuestionReductionFromRuntimeInput(runtimeInput);
  const requestEvent = buildPolicyRequestTimeEvent(runtimeInput);

  return buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan({
    questionReductionPlan,
    requestEvent,
  });
}

function validatePolicyRequestTimeLearningDecision(decision = {}) {
  const issues = [];
  const eventTypeIds = Object.values(POLICY_REQUEST_EVENT_TYPE_IDS);
  const sourceIds = Object.values(POLICY_LEARNING_EVENT_SOURCE_IDS);
  const upstreamFingerprint = normalizeString(decision.upstreamEvidenceFingerprint?.fingerprint);
  const learningGuardFingerprint = normalizeString(
    decision.learningGuardContext?.upstreamEvidenceFingerprint?.fingerprint
  );
  const questionReductionFingerprint = normalizeString(
    decision.questionReductionProof?.evidenceFingerprint?.fingerprint
  );
  const questionReductionTraceFingerprint = normalizeString(
    decision.questionReductionProof?.traceEvidenceFingerprint
  );
  const traceFingerprint = normalizeString(
    decision.trace?.attributes?.[REQUEST_LEARNING_EVIDENCE_FINGERPRINT_TRACE_ATTRIBUTE]
  );
  const traceQuestionReductionValid =
    decision.trace?.attributes?.[REQUEST_LEARNING_QUESTION_REDUCTION_VALID_TRACE_ATTRIBUTE];

  if (!eventTypeIds.includes(decision.eventTypeId)) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.UNKNOWN_EVENT_TYPE,
      message: 'Request-time learning decision must use a supported event type.',
    });
  }

  if (!sourceIds.includes(decision.sourceId)) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.UNKNOWN_SOURCE,
      message: 'Request-time learning decision must map to a supported policy learning source.',
    });
  }

  const selection = asObject(decision.selection);
  const finalDestination = asObject(selection.finalDestination);
  if (!destinationHasValue(finalDestination)) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_DESTINATION_CHOICE,
      message: 'Request-time learning decision must include a selected destination.',
    });
  }

  if (!decision.finalOutcome?.recorded) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_FINAL_OUTCOME,
      message: 'Request-time learning decision must record a final outcome separately.',
    });
  }

  if (!buildPolicyFinalOutcomeAudit(decision.finalOutcome).ok) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.INVALID_FINAL_OUTCOME,
      message: 'Request-time learning decision must include a valid final outcome.',
    });
  }

  if (decision.finalOutcome === selection.requestDestinationChoice ||
      decision.finalOutcome === selection.operatorSelectedDestination ||
      decision.finalOutcome === selection.finalDestination) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.SELECTION_CONFLATED_WITH_FINAL_OUTCOME,
      message: 'Destination selection must not be the same object as the final outcome.',
    });
  }

  if (!decision.learningDecision?.version || decision.learningDecision.version !== 'policy.learning_guard.v1') {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_LEARNING_GUARD,
      message: 'Request-time learning must pass through the policy learning guard.',
    });
  }

  if (decision.learningValidation?.ok === false) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.INVALID_LEARNING_GUARD,
      message: 'Request-time learning cannot rely on an invalid learning guard decision.',
    });
  }

  if (!upstreamFingerprint) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_UPSTREAM_EVIDENCE_FINGERPRINT,
      message: 'Request-time learning must carry the upstream decision evidence fingerprint.',
    });
  }

  if (upstreamFingerprint && !traceFingerprint) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_TRACE_EVIDENCE_FINGERPRINT,
      message: 'Request-time learning trace must carry the upstream decision evidence fingerprint.',
    });
  }

  if (learningGuardFingerprint && learningGuardFingerprint !== upstreamFingerprint) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.LEARNING_GUARD_FINGERPRINT_MISMATCH,
      message: 'Learning-guard context fingerprint must match the request-time decision.',
    });
  }

  if (traceFingerprint && traceFingerprint !== upstreamFingerprint) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.TRACE_FINGERPRINT_MISMATCH,
      message: 'Request-time learning trace fingerprint must match the decision.',
    });
  }

  if (!decision.questionReductionProof?.validation ||
      typeof decision.questionReductionProof.validation.ok !== 'boolean') {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_QUESTION_REDUCTION_VALIDATION,
      message: 'Request-time learning must carry bounded question-reduction validation proof.',
    });
  } else if (decision.questionReductionProof.validation.ok !== true ||
      decision.questionReductionProof.validation.issueCount !== 0) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.INVALID_QUESTION_REDUCTION,
      message: 'Request-time learning cannot rely on an invalid question-reduction handoff.',
    });
  }

  if (
    decision.questionReductionProof?.validation &&
    typeof decision.questionReductionProof.validation.ok === 'boolean' &&
    upstreamFingerprint &&
    !questionReductionFingerprint
  ) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.QUESTION_REDUCTION_FINGERPRINT_MISMATCH,
      message: 'Question-reduction proof must carry the request-time evidence fingerprint.',
    });
  }

  if (
    questionReductionFingerprint &&
    upstreamFingerprint &&
    questionReductionFingerprint !== upstreamFingerprint
  ) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.QUESTION_REDUCTION_FINGERPRINT_MISMATCH,
      message: 'Question-reduction proof fingerprint must match the request-time decision.',
    });
  }

  if (
    decision.questionReductionProof?.validation &&
    typeof decision.questionReductionProof.validation.ok === 'boolean' &&
    upstreamFingerprint &&
    !questionReductionTraceFingerprint
  ) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.QUESTION_REDUCTION_FINGERPRINT_MISMATCH,
      message: 'Question-reduction proof must carry the upstream question trace fingerprint.',
    });
  }

  if (
    questionReductionTraceFingerprint &&
    upstreamFingerprint &&
    questionReductionTraceFingerprint !== upstreamFingerprint
  ) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.QUESTION_REDUCTION_FINGERPRINT_MISMATCH,
      message: 'Question-reduction trace fingerprint must match the request-time decision.',
    });
  }

  if (
    decision.questionReductionProof?.validation &&
    typeof decision.questionReductionProof.validation.ok === 'boolean' &&
    traceQuestionReductionValid !== decision.questionReductionProof.validation.ok
  ) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.TRACE_QUESTION_REDUCTION_VALID_MISMATCH,
      message: 'Request-time trace question-reduction-valid attribute must match the carried proof.',
    });
  }

  const learning = asObject(decision.learningDecision?.learning);
  if (
    decision.eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING &&
    (learning.canWriteLearning === true || decision.profileRefresh?.queue === true)
  ) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.ROUTE_FAILURE_WRITES_LEARNING,
      message: 'Failed routing cannot become positive destination evidence.',
    });
  }

  if (
    [
      POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
      POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
    ].includes(decision.eventTypeId) &&
    learning.canWriteLearning === true
  ) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.ROUTE_OUTCOME_WRITES_LEARNING,
      message: 'Arr routing outcomes can record final outcomes but cannot write durable learning directly.',
    });
  }

  if (
    decision.eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE &&
    decision.audit?.reversible !== true
  ) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MANUAL_CHANGE_NOT_REVERSIBLE,
      message: 'Manual destination changes must be auditable and reversible.',
    });
  }

  Object.entries(asObject(decision.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.DIRECT_SIDE_EFFECT,
        message: `Request-time learning decision cannot perform side effect "${key}".`,
      });
    }
  });

  if (asArray(decision.trace?.reasons).length === 0) {
    issues.push({
      riskId: POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Request-time learning decision must include bounded trace reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyRequestTimeLearningAudit(
  decision = buildPolicyRequestTimeLearningDecisionFromRuntimeInput()
) {
  const validation = validatePolicyRequestTimeLearningDecision(decision);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedEventTypeCount: Object.values(POLICY_REQUEST_EVENT_TYPE_IDS).length,
    checkedLearningSourceCount: Object.values(POLICY_LEARNING_EVENT_SOURCE_IDS).length,
    validation,
    nextStep: {
      stepId: 'library_policy_rebuild',
      label: 'Library-Derived Policy Rebuild',
      reason: 'Request-time and manual choices now pass through the learning guard, so guarded outcomes can feed rebuild proposals without direct policy mutation.',
    },
  };
}

export {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS,
  POLICY_REQUEST_LEARNING_DISPOSITION_IDS,
  POLICY_REQUEST_LEARNING_REASON_IDS,
  buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan,
  buildPolicyRequestTimeLearningDecisionFromRuntimeInput,
  buildPolicyRequestTimeLearningAudit,
  validatePolicyRequestTimeLearningDecision,
};
