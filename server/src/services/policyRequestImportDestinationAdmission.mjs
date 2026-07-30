/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  buildClassificationDestinationSummary,
  buildClassificationRoutingSummary,
} from './classificationResultOutcomeSummary.mjs';
import {
  ANSWER_OUTCOME_IDS,
  QUESTION_FRAME_IDS,
} from './policyQuestionLearningVocabulary.mjs';
import {
  buildPolicyLearningDecision,
  buildPolicyLearningGuardAudit,
} from './policyLearningGuard.mjs';
import {
  POLICY_LEARNING_EVENT_SOURCE_IDS,
  buildPolicyLearningGuardInput,
  buildPolicyLearningIntakeEvent,
  validatePolicyLearningIntakeEvent,
} from './policyLearningIntakeContract.mjs';
import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  validatePolicyRequestTimeLearningDecision,
} from './policyRequestTimeLearning.mjs';
import {
  buildPolicyRequestTimeEvent,
} from './policyRequestTimeEvent.mjs';
import {
  POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS,
  buildPolicyRequestTimeQueueQuestionReduction,
} from './policyRequestTimeQueueQuestionReduction.mjs';
import {
  buildPolicyFinalOutcomeAudit,
} from './policyFinalOutcomeNormalizer.mjs';

const POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_VERSION =
  'policy.request_import_destination_admission.v1';

const POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  OUTCOME_ONLY: 'outcome_only',
});

const POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS = Object.freeze({
  NON_REQUEST_IMPORT_SOURCE: 'request_import_non_request_source',
  MISSING_CLASSIFICATION_REFERENCE: 'request_import_missing_classification_reference',
  MISSING_FINAL_DESTINATION: 'request_import_missing_final_destination',
  ROUTING_NOT_TERMINAL: 'request_import_routing_not_terminal',
  ROUTE_SUCCEEDED_RECORDED: 'request_import_route_succeeded_recorded',
  MISSING_MAPPING_RECORDED: 'request_import_missing_mapping_recorded',
  MISSING_QUESTION_REDUCTION_PROOF: 'request_import_missing_question_reduction_proof',
  INVALID_QUESTION_REDUCTION_PROOF: 'request_import_invalid_question_reduction_proof',
  VALID_QUESTION_REDUCTION_PROOF: 'request_import_valid_question_reduction_proof',
});

const POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_request_import_destination_admission_version',
  INVALID_STATUS: 'invalid_request_import_destination_admission_status',
  INVALID_OUTCOME: 'invalid_request_import_destination_admission_outcome',
  INVALID_LEARNING_INTAKE: 'invalid_request_import_destination_admission_learning_intake',
  INTAKE_OUTCOME_MISMATCH: 'request_import_destination_admission_intake_outcome_mismatch',
  INVALID_LEARNING_GUARD: 'invalid_request_import_destination_admission_learning_guard',
  LEARNING_WRITE_ALLOWED: 'request_import_destination_admission_learning_write_allowed',
  PROFILE_REFRESH_QUEUED: 'request_import_destination_admission_profile_refresh_queued',
  DIRECT_SIDE_EFFECT: 'request_import_destination_admission_direct_side_effect',
  INVALID_REQUEST_TIME_DECISION: 'invalid_request_import_destination_admission_request_time_decision',
  REQUEST_DESTINATION_CONFLATED: 'request_import_destination_admission_request_destination_conflated',
});

const REQUEST_IMPORT_SOURCE_IDS = new Set(['webhook', 'manual']);
const MISSING_MAPPING_ROUTE_REASON_IDS = new Set(['no_mapping', 'missing_arr_id']);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 160) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function uniqueReasonCodes(reasonCodes = []) {
  return [...new Set(reasonCodes.filter(Boolean))];
}

function buildNotApplicableResult(reasonCode) {
  const result = {
    version: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_VERSION,
    ok: true,
    statusId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS.NOT_APPLICABLE,
    reasonCodes: [reasonCode],
    event: null,
    finalOutcome: null,
    learningIntake: null,
    learning: null,
    questionReduction: {
      statusId: 'not_required',
      evidenceFingerprint: null,
    },
    sideEffects: {
      finalOutcomeWritten: false,
      learningWritten: false,
      profileRefreshQueued: false,
      routeAttempted: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyRequestImportDestinationAdmissionAudit(result),
  };
}

function buildRouteEvent({ classificationId, destination, routing }) {
  const routeResult = asObject(routing?.routeResult);
  const routeSucceeded = routeResult.routed === true;
  const missingMapping = MISSING_MAPPING_ROUTE_REASON_IDS.has(routeResult.reason);

  if (!routeSucceeded && !missingMapping) return null;

  const eventTypeId = routeSucceeded
    ? POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED
    : POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING;

  return buildPolicyRequestTimeEvent({
    eventTypeId,
    item: {
      itemId: classificationId,
    },
    finalDestination: destination,
    routeResult: {
      attempted: routeResult.attempted === true,
      succeeded: routeSucceeded,
      missingMapping,
      reasonCode: missingMapping ? 'missing_mapping' : null,
    },
    sourceEventId: `classification:${classificationId}`,
  });
}

function buildOutcomeOnlyLearningDecision(requestEvent) {
  const isMissingMapping =
    requestEvent.eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING;

  const intake = buildPolicyLearningIntakeEvent({
    sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.ARR_ROUTING_OUTCOME,
    sourceEventId: requestEvent.sourceEventId,
    itemId: requestEvent.item.itemId,
    answerOutcomeId: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
    question: {
      frameId: isMissingMapping ? QUESTION_FRAME_IDS.ROUTING_GAP : QUESTION_FRAME_IDS.DESTINATION_FIT,
      stale: false,
    },
    answer: {
      label: requestEvent.finalDestination.libraryName || 'Routing destination',
      destinationLibraryId: requestEvent.finalDestination.libraryId,
      destinationLibraryName: requestEvent.finalDestination.libraryName,
      ambiguous: false,
    },
    finalOutcome: {
      itemId: requestEvent.item.itemId,
      destinationLibraryId: requestEvent.finalDestination.libraryId,
      destinationLibraryName: requestEvent.finalDestination.libraryName,
      status: isMissingMapping ? 'route_failed_missing_mapping' : 'routed',
      route: requestEvent.routeResult,
      recorded: true,
    },
  });
  const intakeAudit = validatePolicyLearningIntakeEvent(intake);
  const guardInput = buildPolicyLearningGuardInput(intake);

  return {
    intake,
    decision: intakeAudit.ok && guardInput
      ? buildPolicyLearningDecision(guardInput)
      : null,
  };
}

function buildQueueTaskContext(task = {}) {
  const queueTask = asObject(task);

  return {
    id: queueTask.id,
    taskType: queueTask.task_type ?? queueTask.taskType,
    attempts: queueTask.attempts,
  };
}

function buildQueueQuestionReductionSummary(queueQuestionReduction = {}) {
  const queueResult = asObject(queueQuestionReduction);

  if (
    queueResult.statusId !== POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.READY ||
    queueResult.audit?.ok !== true
  ) {
    return {
      statusId: 'invalid',
      evidenceFingerprint: null,
    };
  }

  return {
    statusId: 'valid',
    evidenceFingerprint: normalizeString(queueResult.queueEvidence?.evidenceFingerprint, 128) || null,
  };
}

function buildEventSummary(requestEvent) {
  return {
    eventTypeId: requestEvent.eventTypeId,
    sourceEventId: requestEvent.sourceEventId,
    finalDestination: {
      libraryId: requestEvent.finalDestination.libraryId,
      libraryName: requestEvent.finalDestination.libraryName || null,
    },
    routeResult: {
      attempted: requestEvent.routeResult.attempted,
      succeeded: requestEvent.routeResult.succeeded,
      missingMapping: requestEvent.routeResult.missingMapping,
      reasonCode: requestEvent.routeResult.reasonCode,
    },
  };
}

function buildLearningSummary(learningDecision) {
  const learning = asObject(learningDecision?.learning);
  const profileRefresh = asObject(learningDecision?.profileRefresh);

  return {
    decisionId: normalizeString(learning.decisionId, 80) || null,
    canWriteLearning: learning.canWriteLearning === true,
    profileRefreshQueued: profileRefresh.queue === true,
  };
}

function buildLearningIntakeSummary(intake = {}) {
  const source = asObject(intake);

  return {
    version: normalizeString(source.version, 80) || null,
    sourceId: normalizeString(source.sourceId, 80) || null,
    sourceEventId: normalizeString(source.sourceEventId, 120) || null,
    answerOutcomeId: normalizeString(source.answerOutcomeId, 80) || null,
  };
}

function buildLearningGuardSnapshot(learningDecision = {}) {
  const decision = asObject(learningDecision);
  const learning = asObject(decision.learning);
  const profileRefresh = asObject(decision.profileRefresh);

  return {
    version: normalizeString(decision.version, 80) || null,
    sourceId: normalizeString(decision.sourceId, 80) || null,
    finalOutcome: decision.finalOutcome || null,
    learning: {
      decisionId: normalizeString(learning.decisionId, 80) || null,
      tierId: normalizeString(learning.tierId, 80) || null,
      canWriteLearning: learning.canWriteLearning === true,
      requiresExplicitPolicyEdit: learning.requiresExplicitPolicyEdit === true,
      authoritySourceId: normalizeString(learning.authoritySourceId, 80) || null,
      candidate: {},
      reasonCodes: Array.isArray(learning.reasonCodes) ? learning.reasonCodes : [],
      blockedReasonCodes: Array.isArray(learning.blockedReasonCodes) ? learning.blockedReasonCodes : [],
      writesPerformed: false,
    },
    profileRefresh: {
      queue: profileRefresh.queue === true,
      reasonCodes: Array.isArray(profileRefresh.reasonCodes) ? profileRefresh.reasonCodes : [],
    },
  };
}

function buildPolicyRequestImportDestinationAdmission({
  task = {},
  classification = {},
  queueQuestionReduction = null,
} = {}) {
  const queueTask = asObject(task);
  if (!REQUEST_IMPORT_SOURCE_IDS.has(normalizeString(queueTask.source, 40).toLowerCase())) {
    return buildNotApplicableResult(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.NON_REQUEST_IMPORT_SOURCE
    );
  }

  const classificationId = normalizePositiveInteger(
    asObject(classification).classification_id ?? asObject(classification).classificationId
  );
  if (!classificationId) {
    return buildNotApplicableResult(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.MISSING_CLASSIFICATION_REFERENCE
    );
  }

  const destination = buildClassificationDestinationSummary(classification);
  if (!destination.libraryId || !destination.libraryName) {
    return buildNotApplicableResult(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.MISSING_FINAL_DESTINATION
    );
  }

  const routing = buildClassificationRoutingSummary(classification);
  const requestEvent = buildRouteEvent({ classificationId, destination, routing });
  if (!requestEvent) {
    return buildNotApplicableResult(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.ROUTING_NOT_TERMINAL
    );
  }

  const reasonCodes = [
    requestEvent.eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED
      ? POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.ROUTE_SUCCEEDED_RECORDED
      : POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.MISSING_MAPPING_RECORDED,
  ];
  let learningDecision;
  let learningIntake;
  let requestTimeDecision = null;
  const hasQueueQuestionReduction = queueQuestionReduction !== null;
  let questionReduction;

  if (hasQueueQuestionReduction) {
    const queueRequestTimeReduction = buildPolicyRequestTimeQueueQuestionReduction({
      queueQuestionReduction,
      queueTaskContext: buildQueueTaskContext(queueTask),
      requestEvent,
    });
    questionReduction = buildQueueQuestionReductionSummary(queueRequestTimeReduction);

    if (questionReduction.statusId === 'valid') {
      requestTimeDecision = queueRequestTimeReduction.decision;
      learningDecision = requestTimeDecision.learningDecision;
      learningIntake = requestTimeDecision.intake;
      reasonCodes.push(
        POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.VALID_QUESTION_REDUCTION_PROOF
      );
    } else {
      const fallbackResult = buildOutcomeOnlyLearningDecision(requestEvent);
      learningDecision = fallbackResult.decision;
      learningIntake = fallbackResult.intake;
      reasonCodes.push(
        POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.INVALID_QUESTION_REDUCTION_PROOF
      );
    }
  } else {
    questionReduction = {
      statusId: 'missing',
      evidenceFingerprint: null,
    };
    const fallbackResult = buildOutcomeOnlyLearningDecision(requestEvent);
    learningDecision = fallbackResult.decision;
    learningIntake = fallbackResult.intake;
    reasonCodes.push(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.MISSING_QUESTION_REDUCTION_PROOF
    );
  }

  const result = {
    version: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_VERSION,
    ok: true,
    statusId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS.OUTCOME_ONLY,
    reasonCodes: uniqueReasonCodes(reasonCodes),
    event: buildEventSummary(requestEvent),
    finalOutcome: learningIntake.finalOutcome,
    learningIntake: buildLearningIntakeSummary(learningIntake),
    learningGuard: buildLearningGuardSnapshot(learningDecision),
    learning: buildLearningSummary(learningDecision),
    questionReduction,
    requestTimeDecision: requestTimeDecision
      ? {
        validationOk: validatePolicyRequestTimeLearningDecision(requestTimeDecision).ok,
        dispositionId: requestTimeDecision.dispositionId,
      }
      : null,
    sideEffects: {
      finalOutcomeWritten: false,
      learningWritten: false,
      profileRefreshQueued: false,
      routeAttempted: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyRequestImportDestinationAdmissionAudit(result, {
      learningDecision,
      learningIntake,
      requestTimeDecision,
    }),
  };
}

function buildPolicyRequestImportDestinationAdmissionAudit(result = {}, internal = {}) {
  const source = asObject(result);
  const learningDecision = internal.learningDecision || source.learningGuard;
  const learningIntake = internal.learningIntake;
  const requestTimeDecision = internal.requestTimeDecision;
  const issues = [];

  if (source.version !== POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_VERSION) {
    issues.push({
      riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Request/import destination admission must use the current contract version.',
    });
  }

  if (!Object.values(POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS).includes(source.statusId)) {
    issues.push({
      riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.INVALID_STATUS,
      message: 'Request/import destination admission must use a supported status.',
    });
  }

  if (source.statusId === POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS.OUTCOME_ONLY) {
    if (!buildPolicyFinalOutcomeAudit(source.finalOutcome).ok) {
      issues.push({
        riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.INVALID_OUTCOME,
        message: 'A terminal routing admission must contain a valid final outcome.',
      });
    }

    if (Object.hasOwn(internal, 'learningIntake') &&
        (!learningIntake || validatePolicyLearningIntakeEvent(learningIntake).ok !== true)) {
      issues.push({
        riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.INVALID_LEARNING_INTAKE,
        message: 'A terminal request/import routing admission requires valid canonical learning intake.',
      });
    }

    if (learningIntake?.finalOutcome && learningIntake.finalOutcome !== source.finalOutcome) {
      issues.push({
        riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.INTAKE_OUTCOME_MISMATCH,
        message: 'Request/import final outcome must be the canonical learning-intake outcome.',
      });
    }

    if (!buildPolicyLearningGuardAudit(learningDecision).ok) {
      issues.push({
        riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.INVALID_LEARNING_GUARD,
        message: 'A terminal routing admission must pass through the learning guard.',
      });
    }

    if (source.learning?.canWriteLearning === true) {
      issues.push({
        riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.LEARNING_WRITE_ALLOWED,
        message: 'Request/import routing outcomes cannot directly authorize durable learning.',
      });
    }

    if (source.learning?.profileRefreshQueued === true || source.sideEffects?.profileRefreshQueued === true) {
      issues.push({
        riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.PROFILE_REFRESH_QUEUED,
        message: 'Request/import routing outcomes cannot directly queue a profile refresh.',
      });
    }

    if (requestTimeDecision && validatePolicyRequestTimeLearningDecision(requestTimeDecision).ok !== true) {
      issues.push({
        riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.INVALID_REQUEST_TIME_DECISION,
        message: 'A supplied question-reduction proof must produce a valid request-time decision.',
      });
    }

    if (source.event?.eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.USER_REQUESTED_DESTINATION) {
      issues.push({
        riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.REQUEST_DESTINATION_CONFLATED,
        message: 'Request/import routing cannot infer a requester destination choice from a routed outcome.',
      });
    }
  }

  const directSideEffect = [
    'finalOutcomeWritten',
    'learningWritten',
    'profileRefreshQueued',
    'routeAttempted',
    'providerLookupPerformed',
    'providerQuotaRead',
  ].find(sideEffectId => source.sideEffects?.[sideEffectId] === true);
  if (directSideEffect) {
    issues.push({
      riskId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.DIRECT_SIDE_EFFECT,
      message: 'Request/import destination admission must remain side-effect free.',
      sideEffectId: directSideEffect,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

const policyRequestImportDestinationAdmissionService = Object.freeze({
  build: buildPolicyRequestImportDestinationAdmission,
  audit: buildPolicyRequestImportDestinationAdmissionAudit,
});

export {
  POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS,
  POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS,
  POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS,
  POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_VERSION,
  buildPolicyRequestImportDestinationAdmission,
  buildPolicyRequestImportDestinationAdmissionAudit,
  policyRequestImportDestinationAdmissionService,
};
