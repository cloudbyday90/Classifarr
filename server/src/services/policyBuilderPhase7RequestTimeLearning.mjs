import {
  ANSWER_OUTCOME_IDS,
  QUESTION_FRAME_IDS,
} from './policyQuestionLearningVocabulary.mjs';
import {
  PHASE6R_LEARNING_DECISION_IDS,
  PHASE6R_LEARNING_EVENT_SOURCE_IDS,
  buildPolicyBuilderPhase6LearningDecision,
  validatePolicyBuilderPhase6LearningDecision,
} from './policyBuilderPhase6LearningGuard.mjs';

const PHASE7R_REQUEST_EVENT_TYPE_IDS = Object.freeze({
  USER_REQUESTED_DESTINATION: 'user_requested_destination',
  OPERATOR_MANUAL_DESTINATION_CHANGE: 'operator_manual_destination_change',
  ROUTE_SUCCEEDED: 'route_succeeded',
  ROUTE_FAILED_MISSING_MAPPING: 'route_failed_missing_mapping',
});

const PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS = Object.freeze({
  OUTCOME_ONLY: 'outcome_only',
  LEARNING_CANDIDATE: 'learning_candidate',
  POLICY_EDIT_REQUIRED: 'policy_edit_required',
  BLOCKED: 'blocked',
  ROUTE_FAILURE_ONLY: 'route_failure_only',
});

const PHASE7R_REQUEST_LEARNING_REASON_IDS = Object.freeze({
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

const PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_EVENT_TYPE: 'unknown_event_type',
  UNKNOWN_SOURCE: 'unknown_source',
  MISSING_DESTINATION_CHOICE: 'missing_destination_choice',
  MISSING_FINAL_OUTCOME: 'missing_final_outcome',
  SELECTION_CONFLATED_WITH_FINAL_OUTCOME: 'selection_conflated_with_final_outcome',
  ROUTE_FAILURE_WRITES_LEARNING: 'route_failure_writes_learning',
  ROUTE_OUTCOME_WRITES_LEARNING: 'route_outcome_writes_learning',
  MANUAL_CHANGE_NOT_REVERSIBLE: 'manual_change_not_reversible',
  MISSING_LEARNING_GUARD: 'missing_learning_guard',
  INVALID_LEARNING_GUARD: 'invalid_learning_guard',
  DIRECT_SIDE_EFFECT: 'direct_side_effect',
  MISSING_TRACE_REASON: 'missing_trace_reason',
});

const EVENT_SOURCE_BY_TYPE = Object.freeze({
  [PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION]:
    PHASE6R_LEARNING_EVENT_SOURCE_IDS.REQUEST_DESTINATION_CHOICE,
  [PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE]:
    PHASE6R_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE,
  [PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED]:
    PHASE6R_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME,
  [PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING]:
    PHASE6R_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME,
});

const EVENT_REASON_BY_TYPE = Object.freeze({
  [PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION]:
    PHASE7R_REQUEST_LEARNING_REASON_IDS.REQUEST_CHOICE_RECORDED,
  [PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE]:
    PHASE7R_REQUEST_LEARNING_REASON_IDS.MANUAL_DESTINATION_CHANGE_RECORDED,
  [PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED]:
    PHASE7R_REQUEST_LEARNING_REASON_IDS.ROUTE_SUCCESS_RECORDED,
  [PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING]:
    PHASE7R_REQUEST_LEARNING_REASON_IDS.ROUTE_FAILURE_RECORDED,
});

const MAX_TRACE_REASONS = 12;

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

function normalizeDestination(value = {}) {
  const destination = asObject(value);

  return {
    libraryId: destination.libraryId ?? destination.destinationLibraryId ?? null,
    libraryName: normalizeString(destination.libraryName ?? destination.destinationLibraryName ?? destination.name),
    arrType: normalizeString(destination.arrType ?? destination.arr_type),
    arrConfigId: destination.arrConfigId ?? destination.arr_config_id ?? null,
    arrRootFolderPath: normalizeString(destination.arrRootFolderPath ?? destination.arr_root_folder_path),
  };
}

function destinationHasValue(destination = {}) {
  return hasValue(destination.libraryId) ||
    hasValue(destination.libraryName) ||
    hasValue(destination.arrConfigId) ||
    hasValue(destination.arrRootFolderPath);
}

function normalizeItem(value = {}) {
  const item = asObject(value);

  return {
    itemId: item.itemId ?? item.id ?? item.tmdbId ?? null,
    title: normalizeString(item.title ?? item.name),
    year: item.year ?? null,
    mediaType: normalizeString(item.mediaType ?? item.media_type),
    tmdbId: item.tmdbId ?? item.tmdb_id ?? null,
  };
}

function normalizeRouteResult(value = {}, eventTypeId) {
  const route = asObject(value);
  const failedByEvent = eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING;
  const succeededByEvent = eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED;

  return {
    attempted: route.attempted === true || failedByEvent || succeededByEvent,
    succeeded: route.succeeded === true || succeededByEvent,
    missingMapping: route.missingMapping === true || route.reasonCode === 'missing_mapping' || failedByEvent,
    routeId: route.routeId ?? null,
    reasonCode: normalizeString(route.reasonCode) || (failedByEvent ? 'missing_mapping' : null),
  };
}

function defaultAnswerOutcomeForEvent(eventTypeId) {
  switch (eventTypeId) {
    case PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING:
      return ANSWER_OUTCOME_IDS.DO_NOT_LEARN;
    default:
      return ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM;
  }
}

function normalizeQuestionForLearning(input = {}) {
  const question = asObject(input.question);

  return {
    frameId: question.frameId || QUESTION_FRAME_IDS.DESTINATION_FIT,
    stale: question.stale === true,
  };
}

function buildAnswerFromDestination(destination = {}, input = {}) {
  const answer = asObject(input.answer);

  return {
    label: normalizeString(answer.label ?? destination.libraryName),
    destinationLibraryId: answer.destinationLibraryId ?? destination.libraryId ?? null,
    destinationLibraryName: normalizeString(answer.destinationLibraryName ?? destination.libraryName),
    ambiguous: answer.ambiguous === true,
  };
}

function buildFinalOutcome({
  eventTypeId,
  sourceId,
  item,
  finalDestination,
  routeResult,
}) {
  const routeFailed = eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING;
  const routeSucceeded = eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED;

  return {
    recorded: true,
    sourceId,
    itemId: item.itemId,
    destinationLibraryId: finalDestination.libraryId,
    destinationLibraryName: finalDestination.libraryName,
    status: routeFailed
      ? 'route_failed_missing_mapping'
      : routeSucceeded
        ? 'routed'
        : 'resolved',
    route: routeResult,
  };
}

function buildSelection({
  eventTypeId,
  requestedDestination,
  operatorDestination,
  finalDestination,
  routeResult,
}) {
  return {
    requestDestinationChoice: eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION
      ? requestedDestination
      : null,
    operatorSelectedDestination: eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE
      ? operatorDestination
      : null,
    finalDestination,
    routeResult,
  };
}

function mapDisposition(learningDecision = {}, eventTypeId) {
  const learning = asObject(learningDecision.learning);

  if (eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING) {
    return PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.ROUTE_FAILURE_ONLY;
  }

  switch (learning.decisionId) {
    case PHASE6R_LEARNING_DECISION_IDS.CANDIDATE:
      return PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.LEARNING_CANDIDATE;
    case PHASE6R_LEARNING_DECISION_IDS.POLICY_EDIT_REQUIRED:
      return PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.POLICY_EDIT_REQUIRED;
    case PHASE6R_LEARNING_DECISION_IDS.BLOCKED:
      return PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.BLOCKED;
    default:
      return PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS.OUTCOME_ONLY;
  }
}

function buildTrace({
  eventTypeId,
  dispositionId,
  learningDecision,
  routeResult,
}) {
  const reasons = [
    {
      reasonId: EVENT_REASON_BY_TYPE[eventTypeId] || PHASE7R_REQUEST_LEARNING_REASON_IDS.REQUEST_CHOICE_RECORDED,
      severity: 'info',
    },
    {
      reasonId: PHASE7R_REQUEST_LEARNING_REASON_IDS.LEARNING_GUARD_REQUIRED,
      severity: 'info',
    },
  ];

  if (routeResult.missingMapping === true) {
    reasons.push({
      reasonId: PHASE7R_REQUEST_LEARNING_REASON_IDS.ROUTE_FAILURE_NOT_EVIDENCE,
      severity: 'warning',
    });
  }

  if (learningDecision?.learning?.decisionId === PHASE6R_LEARNING_DECISION_IDS.CANDIDATE) {
    reasons.push({
      reasonId: PHASE7R_REQUEST_LEARNING_REASON_IDS.LEARNING_GUARD_APPROVED,
      severity: 'info',
    });
  }

  if (learningDecision?.learning?.decisionId === PHASE6R_LEARNING_DECISION_IDS.BLOCKED) {
    reasons.push({
      reasonId: PHASE7R_REQUEST_LEARNING_REASON_IDS.LEARNING_GUARD_BLOCKED,
      severity: 'warning',
    });
  }

  if (learningDecision?.profileRefresh?.queue === true) {
    reasons.push({
      reasonId: PHASE7R_REQUEST_LEARNING_REASON_IDS.PROFILE_REFRESH_QUEUED_BY_GUARD,
      severity: 'info',
    });
  }

  const boundedReasons = reasons.slice(0, MAX_TRACE_REASONS);

  return {
    attributes: {
      'classifarr.runtime.request_learning.version': 'phase7r.request_time_learning.v1',
      'classifarr.runtime.request_learning.event_type': eventTypeId,
      'classifarr.runtime.request_learning.disposition': dispositionId,
      'classifarr.runtime.request_learning.reason_count': boundedReasons.length,
      'classifarr.runtime.request_learning.route_succeeded': routeResult.succeeded,
      'classifarr.runtime.request_learning.missing_mapping': routeResult.missingMapping,
      'classifarr.runtime.request_learning.profile_refresh_queued': learningDecision?.profileRefresh?.queue === true,
    },
    reasons: boundedReasons,
    truncated: reasons.length > boundedReasons.length,
  };
}

function buildPolicyBuilderPhase7RequestTimeLearningDecision(input = {}) {
  const eventTypeId = input.eventTypeId || PHASE7R_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION;
  const sourceId = EVENT_SOURCE_BY_TYPE[eventTypeId] || null;
  const item = normalizeItem(input.item);
  const requestedDestination = normalizeDestination(input.requestedDestination || input.destination);
  const operatorDestination = normalizeDestination(input.operatorDestination || input.destination);
  const explicitFinalDestination = normalizeDestination(input.finalDestination || input.destination);
  const finalDestination = destinationHasValue(explicitFinalDestination)
    ? explicitFinalDestination
    : eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE
      ? operatorDestination
      : requestedDestination;
  const routeResult = normalizeRouteResult(input.routeResult, eventTypeId);
  const finalOutcome = buildFinalOutcome({
    eventTypeId,
    sourceId,
    item,
    finalDestination,
    routeResult,
  });
  const answerOutcomeId = input.answerOutcomeId || defaultAnswerOutcomeForEvent(eventTypeId);
  const learningDecision = buildPolicyBuilderPhase6LearningDecision({
    sourceId,
    answerOutcomeId,
    question: normalizeQuestionForLearning(input),
    answer: buildAnswerFromDestination(finalDestination, input),
    candidate: input.candidate || {},
    context: input.context || {},
    finalOutcome,
  });
  const learningValidation = validatePolicyBuilderPhase6LearningDecision(learningDecision);
  const dispositionId = mapDisposition(learningDecision, eventTypeId);

  return {
    version: 'phase7r.request_time_learning.v1',
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
    learningDecision,
    learningValidation,
    profileRefresh: {
      queue: learningDecision.profileRefresh?.queue === true,
      reasonCodes: asArray(learningDecision.profileRefresh?.reasonCodes),
      queuedByLearningGuard: learningDecision.profileRefresh?.queue === true,
    },
    audit: {
      reversible: eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
      actorId: input.actorId ?? null,
      sourceEventId: input.sourceEventId ?? null,
      rollbackHint: eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE
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
    }),
  };
}

function validatePolicyBuilderPhase7RequestTimeLearningDecision(decision = {}) {
  const issues = [];
  const eventTypeIds = Object.values(PHASE7R_REQUEST_EVENT_TYPE_IDS);
  const sourceIds = Object.values(PHASE6R_LEARNING_EVENT_SOURCE_IDS);

  if (!eventTypeIds.includes(decision.eventTypeId)) {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.UNKNOWN_EVENT_TYPE,
      message: 'Request-time learning decision must use a supported event type.',
    });
  }

  if (!sourceIds.includes(decision.sourceId)) {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.UNKNOWN_SOURCE,
      message: 'Request-time learning decision must map to a Phase 6R learning source.',
    });
  }

  const selection = asObject(decision.selection);
  const finalDestination = asObject(selection.finalDestination);
  if (!destinationHasValue(finalDestination)) {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_DESTINATION_CHOICE,
      message: 'Request-time learning decision must include a selected destination.',
    });
  }

  if (!decision.finalOutcome?.recorded) {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_FINAL_OUTCOME,
      message: 'Request-time learning decision must record a final outcome separately.',
    });
  }

  if (decision.finalOutcome === selection.requestDestinationChoice ||
      decision.finalOutcome === selection.operatorSelectedDestination ||
      decision.finalOutcome === selection.finalDestination) {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.SELECTION_CONFLATED_WITH_FINAL_OUTCOME,
      message: 'Destination selection must not be the same object as the final outcome.',
    });
  }

  if (!decision.learningDecision?.version || decision.learningDecision.version !== 'phase6r.learning_guard.v1') {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_LEARNING_GUARD,
      message: 'Request-time learning must pass through the Phase 6R learning guard.',
    });
  }

  if (decision.learningValidation?.ok === false) {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.INVALID_LEARNING_GUARD,
      message: 'Request-time learning cannot rely on an invalid learning guard decision.',
    });
  }

  const learning = asObject(decision.learningDecision?.learning);
  if (
    decision.eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING &&
    (learning.canWriteLearning === true || decision.profileRefresh?.queue === true)
  ) {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.ROUTE_FAILURE_WRITES_LEARNING,
      message: 'Failed routing cannot become positive destination evidence.',
    });
  }

  if (
    [
      PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
      PHASE7R_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
    ].includes(decision.eventTypeId) &&
    learning.canWriteLearning === true
  ) {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.ROUTE_OUTCOME_WRITES_LEARNING,
      message: 'Arr routing outcomes can record final outcomes but cannot write durable learning directly.',
    });
  }

  if (
    decision.eventTypeId === PHASE7R_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE &&
    decision.audit?.reversible !== true
  ) {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.MANUAL_CHANGE_NOT_REVERSIBLE,
      message: 'Manual destination changes must be auditable and reversible.',
    });
  }

  Object.entries(asObject(decision.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.DIRECT_SIDE_EFFECT,
        message: `Request-time learning decision cannot perform side effect "${key}".`,
      });
    }
  });

  if (asArray(decision.trace?.reasons).length === 0) {
    issues.push({
      riskId: PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS.MISSING_TRACE_REASON,
      message: 'Request-time learning decision must include bounded trace reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase7RequestTimeLearningAudit(
  decision = buildPolicyBuilderPhase7RequestTimeLearningDecision()
) {
  const validation = validatePolicyBuilderPhase7RequestTimeLearningDecision(decision);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedEventTypeCount: Object.values(PHASE7R_REQUEST_EVENT_TYPE_IDS).length,
    checkedLearningSourceCount: Object.values(PHASE6R_LEARNING_EVENT_SOURCE_IDS).length,
    validation,
    nextPhase: {
      phaseId: '7r_6',
      label: 'Library-Derived Policy Rebuild',
      reason: 'Request-time and manual choices now pass through the learning guard, so guarded outcomes can feed rebuild proposals without direct policy mutation.',
    },
  };
}

export {
  PHASE7R_REQUEST_EVENT_TYPE_IDS,
  PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS,
  PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS,
  PHASE7R_REQUEST_LEARNING_REASON_IDS,
  buildPolicyBuilderPhase7RequestTimeLearningAudit,
  buildPolicyBuilderPhase7RequestTimeLearningDecision,
  validatePolicyBuilderPhase7RequestTimeLearningDecision,
};
