/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  ANSWER_OUTCOME_IDS,
  QUESTION_FRAME_IDS,
} from './policyQuestionLearningVocabulary.mjs';
import {
  POLICY_LEARNING_EVENT_SOURCE_IDS,
  buildPolicyLearningDecision,
  buildPolicyLearningGuardAudit,
} from './policyLearningGuard.mjs';
import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  buildPolicyRequestTimeEvent,
} from './policyRequestTimeEvent.mjs';
import {
  buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan,
  validatePolicyRequestTimeLearningDecision,
} from './policyRequestTimeLearning.mjs';
import {
  validatePolicyRuntimeQuestionReduction,
} from './policyRuntimeQuestionReduction.mjs';
import {
  buildNativePendingQuestionPresentation,
} from './policyNativePendingQuestionPresentation.mjs';
import {
  isPolicyRuntimeQuestionPersistenceEnvelope,
} from './policyRuntimeQuestionPersistenceContract.mjs';

const POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_VERSION =
  'policy.native_pending_resolution_provenance.v1';

const POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  OUTCOME_ONLY: 'outcome_only',
});

const POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS = Object.freeze({
  NOT_NATIVE_PENDING_QUESTION: 'native_pending_resolution_not_native_pending_question',
  MALFORMED_PRESENTATION: 'native_pending_resolution_malformed_presentation',
  INVALID_SELECTION: 'native_pending_resolution_invalid_selection',
  INVALID_QUESTION_REDUCTION_PLAN: 'native_pending_resolution_invalid_question_reduction_plan',
  INVALID_REQUEST_TIME_DECISION: 'native_pending_resolution_invalid_request_time_decision',
  GUARD_NOT_OUTCOME_ONLY: 'native_pending_resolution_guard_not_outcome_only',
});

const POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_native_pending_resolution_provenance_version',
  INVALID_STATUS: 'invalid_native_pending_resolution_provenance_status',
  INVALID_GUARD: 'invalid_native_pending_resolution_provenance_guard',
  LEARNING_WRITE_ALLOWED: 'native_pending_resolution_provenance_learning_write_allowed',
  PROFILE_REFRESH_QUEUED: 'native_pending_resolution_provenance_profile_refresh_queued',
  INVALID_REQUEST_TIME_DECISION: 'invalid_native_pending_resolution_provenance_request_time_decision',
  INVALID_SELECTION_SUMMARY: 'invalid_native_pending_resolution_provenance_selection_summary',
  SIDE_EFFECT_REPORTED: 'native_pending_resolution_provenance_side_effect_reported',
});

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

function buildDestination(value = {}) {
  const destination = asObject(value);

  return {
    libraryId: normalizePositiveInteger(destination.libraryId ?? destination.id),
    libraryName: normalizeString(destination.libraryName ?? destination.name) || null,
  };
}

function sameDestination(left = {}, right = {}) {
  return normalizePositiveInteger(left.libraryId) !== null &&
    normalizePositiveInteger(left.libraryId) === normalizePositiveInteger(right.libraryId);
}

function uniqueReasonCodes(reasonCodes = []) {
  return [...new Set(reasonCodes.filter(Boolean))];
}

function buildSelection({ persistedQuestion, selectedDestination, selectedOption }) {
  const presentation = buildNativePendingQuestionPresentation(persistedQuestion);
  if (!presentation) {
    return {
      selection: null,
      reasonCode: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.MALFORMED_PRESENTATION,
    };
  }

  const suggestedDestination = buildDestination(presentation.destination);
  if (!selectedDestination.libraryId || !selectedDestination.libraryName) {
    return {
      selection: null,
      reasonCode: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.INVALID_SELECTION,
    };
  }

  const optionLabel = normalizeString(selectedOption, 80);
  if (sameDestination(selectedDestination, suggestedDestination)) {
    const selectedAction = presentation.actions.find(
      action => action.selectedOptionLabel === optionLabel,
    );

    if (!selectedAction) {
      return {
        selection: null,
        reasonCode: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.INVALID_SELECTION,
      };
    }

    return {
      selection: {
        selectedOutcomeId: selectedAction.id,
        eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_CONFIRMED_DESTINATION,
        suggestedDestination,
        selectedDestination,
        alternateDestination: false,
      },
      reasonCode: null,
    };
  }

  if (optionLabel !== presentation.alternativeDestination.selectedOptionLabel) {
    return {
      selection: null,
      reasonCode: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.INVALID_SELECTION,
    };
  }

  return {
    selection: {
      selectedOutcomeId: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE,
      suggestedDestination,
      selectedDestination,
      alternateDestination: true,
    },
    reasonCode: null,
  };
}

function buildOutcomeOnlyGuard({ classificationId, selection, persistedQuestion }) {
  const runtimeQuestion = asObject(asObject(persistedQuestion).runtimeQuestion);
  const selectedDestination = selection?.selectedDestination || { libraryId: null, libraryName: null };

  return buildPolicyLearningDecision({
    sourceId: selection?.eventTypeId === POLICY_REQUEST_EVENT_TYPE_IDS.OPERATOR_MANUAL_DESTINATION_CHANGE
      ? POLICY_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE
      : POLICY_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION,
    answerOutcomeId: selection?.selectedOutcomeId || ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
    question: {
      frameId: normalizeString(runtimeQuestion.frameId, 80) || QUESTION_FRAME_IDS.DESTINATION_FIT,
      stale: runtimeQuestion.stale === true,
    },
    answer: {
      // The outcome id is server-owned vocabulary; never persist a caller label.
      label: selection?.selectedOutcomeId || ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
      destinationLibraryId: selectedDestination.libraryId,
      destinationLibraryName: selectedDestination.libraryName,
      ambiguous: false,
    },
    finalOutcome: {
      itemId: classificationId,
      destinationLibraryId: selectedDestination.libraryId,
      destinationLibraryName: selectedDestination.libraryName,
      recorded: true,
    },
  });
}

function buildSelectionSummary(selection = null) {
  if (!selection) {
    return {
      eventTypeId: null,
      selectedOutcomeId: null,
      suggestedDestination: null,
      selectedDestination: null,
      alternateDestination: false,
    };
  }

  return {
    eventTypeId: selection.eventTypeId,
    selectedOutcomeId: selection.selectedOutcomeId,
    suggestedDestination: selection.suggestedDestination,
    selectedDestination: selection.selectedDestination,
    alternateDestination: selection.alternateDestination === true,
  };
}

function buildGuardSummary(decision = {}) {
  const learning = asObject(decision.learning);
  const profileRefresh = asObject(decision.profileRefresh);

  return {
    version: normalizeString(decision.version, 80) || null,
    sourceId: normalizeString(decision.sourceId, 80) || null,
    decisionId: normalizeString(learning.decisionId, 80) || null,
    tierId: normalizeString(learning.tierId, 80) || null,
    canWriteLearning: learning.canWriteLearning === true,
    profileRefreshQueued: profileRefresh.queue === true,
  };
}

function buildRequestTimeDecision({ selection, persistedQuestion, classificationId }) {
  const questionReductionPlan = asObject(
    asObject(persistedQuestion).runtimeQuestionReductionPlan,
  );
  const planValidation = questionReductionPlan.version
    ? validatePolicyRuntimeQuestionReduction(questionReductionPlan)
    : { ok: false };

  if (!selection || planValidation.ok !== true) {
    return {
      decision: null,
      reasonCode: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.INVALID_QUESTION_REDUCTION_PLAN,
    };
  }

  try {
    const requestEvent = buildPolicyRequestTimeEvent({
      eventTypeId: selection.eventTypeId,
      item: { itemId: classificationId },
      operatorDestination: selection.selectedDestination,
      finalDestination: selection.selectedDestination,
      answerOutcomeId: selection.selectedOutcomeId,
      answer: {
        label: selection.selectedOutcomeId,
        destinationLibraryId: selection.selectedDestination.libraryId,
        destinationLibraryName: selection.selectedDestination.libraryName,
      },
      sourceEventId: `classification:${classificationId}`,
    });
    const decision = buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan({
      questionReductionPlan,
      requestEvent,
    });

    if (validatePolicyRequestTimeLearningDecision(decision).ok !== true) {
      return {
        decision: null,
        reasonCode: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.INVALID_REQUEST_TIME_DECISION,
      };
    }

    return { decision, reasonCode: null };
  } catch {
    return {
      decision: null,
      reasonCode: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.INVALID_REQUEST_TIME_DECISION,
    };
  }
}

function buildPolicyNativePendingResolutionProvenance({
  classification = {},
  persistedQuestion = {},
  selectedDestination = {},
  selectedOption = '',
} = {}) {
  if (!isPolicyRuntimeQuestionPersistenceEnvelope(persistedQuestion)) {
    return buildNotApplicableResult();
  }

  const classificationId = normalizePositiveInteger(asObject(classification).id);
  const normalizedDestination = buildDestination(selectedDestination);
  const selectionResult = buildSelection({
    persistedQuestion,
    selectedDestination: normalizedDestination,
    selectedOption,
  });
  const requestTimeResult = buildRequestTimeDecision({
    selection: selectionResult.selection,
    persistedQuestion,
    classificationId,
  });
  const learningDecision = requestTimeResult.decision?.learningDecision || buildOutcomeOnlyGuard({
    classificationId,
    selection: selectionResult.selection,
    persistedQuestion,
  });
  const reasonCodes = uniqueReasonCodes([
    selectionResult.reasonCode,
    requestTimeResult.reasonCode,
  ]);

  const guardSummary = buildGuardSummary(learningDecision);
  const guardIsOutcomeOnly = guardSummary.canWriteLearning !== true &&
    guardSummary.profileRefreshQueued !== true;
  if (!guardIsOutcomeOnly) {
    reasonCodes.push(POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.GUARD_NOT_OUTCOME_ONLY);
  }

  const result = {
    version: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_VERSION,
    ok: true,
    statusId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS.OUTCOME_ONLY,
    selection: buildSelectionSummary(selectionResult.selection),
    requestTimeDecision: requestTimeResult.decision
      ? {
        version: requestTimeResult.decision.version,
        eventTypeId: requestTimeResult.decision.eventTypeId,
        sourceId: requestTimeResult.decision.sourceId,
        dispositionId: requestTimeResult.decision.dispositionId,
        validationOk: true,
      }
      : null,
    learningGuard: guardSummary,
    reasonCodes: uniqueReasonCodes(reasonCodes),
    sideEffects: {
      outcomePersisted: false,
      learningWritten: false,
      profileRefreshQueued: false,
      routingAttempted: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyNativePendingResolutionProvenanceAudit(result, { learningDecision }),
  };
}

function buildNotApplicableResult() {
  const result = {
    version: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_VERSION,
    ok: true,
    statusId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS.NOT_APPLICABLE,
    selection: buildSelectionSummary(),
    requestTimeDecision: null,
    learningGuard: null,
    reasonCodes: [
      POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.NOT_NATIVE_PENDING_QUESTION,
    ],
    sideEffects: {
      outcomePersisted: false,
      learningWritten: false,
      profileRefreshQueued: false,
      routingAttempted: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyNativePendingResolutionProvenanceAudit(result),
  };
}

function buildPolicyNativePendingResolutionProvenanceAudit(result = {}, internal = {}) {
  const source = asObject(result);
  const selection = asObject(source.selection);
  const learningGuard = asObject(source.learningGuard);
  const learningDecision = internal.learningDecision;
  const sideEffects = asObject(source.sideEffects);
  const issues = [];

  if (source.version !== POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_VERSION) {
    issues.push({
      riskId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Native pending-resolution provenance must use the current contract version.',
    });
  }

  if (!Object.values(POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS).includes(source.statusId)) {
    issues.push({
      riskId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS.INVALID_STATUS,
      message: 'Native pending-resolution provenance must use a supported status.',
    });
  }

  if (source.statusId === POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS.OUTCOME_ONLY) {
    if (!selection.selectedDestination?.libraryId || !selection.selectedOutcomeId || !selection.eventTypeId) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS.INVALID_SELECTION_SUMMARY,
        message: 'An admitted native pending resolution must retain a bounded destination and outcome summary.',
      });
    }

    if (learningDecision && buildPolicyLearningGuardAudit(learningDecision).ok !== true) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS.INVALID_GUARD,
        message: 'Native pending-resolution provenance must pass through a valid learning guard decision.',
      });
    }

    if (learningGuard.canWriteLearning === true) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS.LEARNING_WRITE_ALLOWED,
        message: 'Current native pending outcomes must remain outcome-only.',
      });
    }

    if (learningGuard.profileRefreshQueued === true) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS.PROFILE_REFRESH_QUEUED,
        message: 'Current native pending outcomes cannot queue a profile refresh.',
      });
    }

    if (source.requestTimeDecision && source.requestTimeDecision.validationOk !== true) {
      issues.push({
        riskId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS.INVALID_REQUEST_TIME_DECISION,
        message: 'A retained request-time decision must have passed its validated-plan boundary.',
      });
    }
  }

  const prohibitedSideEffect = [
    'outcomePersisted',
    'learningWritten',
    'profileRefreshQueued',
    'routingAttempted',
    'providerLookupPerformed',
    'providerQuotaRead',
  ].find(sideEffectId => sideEffects[sideEffectId] === true);
  if (prohibitedSideEffect) {
    issues.push({
      riskId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      message: 'The provenance adapter must remain side-effect free.',
      sideEffectId: prohibitedSideEffect,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildNativePendingResolutionOutcomePatch(provenance = {}) {
  const source = asObject(provenance);
  const selection = asObject(source.selection);

  return {
    type: 'native_pending_resolution',
    source: 'policy_request_time',
    event_type_id: selection.eventTypeId || null,
    selected_outcome_id: selection.selectedOutcomeId || null,
    suggested_library_id: selection.suggestedDestination?.libraryId || null,
    suggested_library_name: selection.suggestedDestination?.libraryName || null,
    selected_library_id: selection.selectedDestination?.libraryId || null,
    selected_library_name: selection.selectedDestination?.libraryName || null,
    alternate_destination: selection.alternateDestination === true,
    request_time_decision: source.requestTimeDecision || null,
    learning_guard: source.learningGuard || null,
    reason_codes: Array.isArray(source.reasonCodes) ? source.reasonCodes : [],
  };
}

const policyNativePendingResolutionProvenanceService = Object.freeze({
  build: buildPolicyNativePendingResolutionProvenance,
  audit: buildPolicyNativePendingResolutionProvenanceAudit,
  toOutcomePatch: buildNativePendingResolutionOutcomePatch,
});

export {
  POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS,
  POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS,
  POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS,
  POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_VERSION,
  buildNativePendingResolutionOutcomePatch,
  buildPolicyNativePendingResolutionProvenance,
  buildPolicyNativePendingResolutionProvenanceAudit,
  policyNativePendingResolutionProvenanceService,
};
