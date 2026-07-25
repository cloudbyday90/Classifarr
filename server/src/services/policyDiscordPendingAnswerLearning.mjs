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
  POLICY_LEARNING_DECISION_IDS,
  POLICY_LEARNING_EVENT_SOURCE_IDS,
  POLICY_LEARNING_TIER_IDS,
  buildPolicyLearningDecision,
  buildPolicyLearningGuardAudit,
} from './policyLearningGuard.mjs';
import {
  validatePolicyRuntimeQuestionReduction,
} from './policyRuntimeQuestionReduction.mjs';

const POLICY_DISCORD_PENDING_ANSWER_LEARNING_VERSION =
  'policy.discord_pending_answer_learning.v1';
const POLICY_RUNTIME_QUESTION_REDUCTION_VERSION =
  'policy.runtime_question_reduction.v1';
const QUESTION_FINGERPRINT_TRACE_ATTRIBUTE =
  'classifarr.runtime.question.decision_evidence_projection_fingerprint';

const POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS = Object.freeze({
  READY: 'ready',
  OUTCOME_ONLY: 'outcome_only',
  BLOCKED: 'blocked',
});

const POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS = Object.freeze({
  FINAL_OUTCOME_NOT_RECORDED: 'discord_pending_answer_final_outcome_not_recorded',
  MISSING_NORMALIZED_QUESTION: 'discord_pending_answer_missing_normalized_question',
  MISSING_QUESTION_REDUCTION_PLAN: 'discord_pending_answer_missing_question_reduction_plan',
  INVALID_QUESTION_REDUCTION_PLAN: 'discord_pending_answer_invalid_question_reduction_plan',
  QUESTION_REDUCTION_FINGERPRINT_MISMATCH:
    'discord_pending_answer_question_reduction_fingerprint_mismatch',
  SELECTED_OPTION_MISSING: 'discord_pending_answer_selected_option_missing',
  SELECTED_OUTCOME_NOT_ALLOWED: 'discord_pending_answer_selected_outcome_not_allowed',
  QUESTION_DOES_NOT_ALLOW_LEARNING: 'discord_pending_answer_question_does_not_allow_learning',
  LEARNING_GUARD_NOT_ADMITTED: 'discord_pending_answer_learning_guard_not_admitted',
});

const POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_discord_pending_answer_learning_version',
  INVALID_STATUS: 'invalid_discord_pending_answer_learning_status',
  INVALID_GUARD_DECISION: 'invalid_discord_pending_answer_learning_guard_decision',
  READY_WITHOUT_GUARDED_LEARNING: 'ready_discord_pending_answer_requires_guarded_learning',
  OUTCOME_ONLY_WITH_LEARNING: 'outcome_only_discord_pending_answer_cannot_write_learning',
  INVALID_QUESTION_PROOF: 'invalid_discord_pending_answer_question_proof',
  SIDE_EFFECT_REPORTED: 'discord_pending_answer_learning_service_cannot_report_side_effects',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function getPersistedQuestionEnvelope(value = {}) {
  const persistedQuestion = asObject(value);
  const questionReductionPlan = asObject(
    persistedQuestion.questionReductionPlan || persistedQuestion.runtimeQuestionReductionPlan
  );
  const question = asObject(persistedQuestion.question || persistedQuestion);

  return {
    question,
    questionReductionPlan,
  };
}

function buildQuestionProof(persistedQuestion = {}) {
  const { question, questionReductionPlan } = getPersistedQuestionEnvelope(persistedQuestion);
  const issues = [];
  const planValidation = questionReductionPlan.version
    ? validatePolicyRuntimeQuestionReduction(questionReductionPlan)
    : null;
  const planFingerprint = normalizeString(questionReductionPlan.decisionEvidenceFingerprint?.fingerprint);
  const planQuestionFingerprint = normalizeString(
    questionReductionPlan.question?.decisionEvidenceFingerprint?.fingerprint
  );
  const planTraceFingerprint = normalizeString(
    questionReductionPlan.trace?.attributes?.[QUESTION_FINGERPRINT_TRACE_ATTRIBUTE]
  );
  const questionFingerprint = normalizeString(question.decisionEvidenceFingerprint?.fingerprint);

  if (question.contractVersion !== POLICY_RUNTIME_QUESTION_REDUCTION_VERSION) {
    issues.push(POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.MISSING_NORMALIZED_QUESTION);
  }

  if (questionReductionPlan.version !== POLICY_RUNTIME_QUESTION_REDUCTION_VERSION) {
    issues.push(POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.MISSING_QUESTION_REDUCTION_PLAN);
  } else if (planValidation?.ok !== true) {
    issues.push(POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.INVALID_QUESTION_REDUCTION_PLAN);
  }

  if (
    !planFingerprint ||
    !planQuestionFingerprint ||
    !planTraceFingerprint ||
    !questionFingerprint ||
    planFingerprint !== planQuestionFingerprint ||
    planFingerprint !== planTraceFingerprint ||
    planFingerprint !== questionFingerprint ||
    question.frameId !== questionReductionPlan.question?.frameId
  ) {
    issues.push(
      POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.QUESTION_REDUCTION_FINGERPRINT_MISMATCH
    );
  }

  return {
    valid: issues.length === 0,
    version: normalizeString(question.contractVersion) || null,
    frameId: normalizeString(question.frameId) || null,
    evidenceFingerprint: planFingerprint || null,
    issueCount: issues.length,
    reasonCodes: uniqueReasonCodes(issues),
    question,
  };
}

function selectAnswerOutcome(question = {}, selectedOptionIndex) {
  const index = Number(selectedOptionIndex);
  const option = Number.isInteger(index) && index >= 0
    ? asArray(question.options)[index]
    : null;
  const outcomeId = normalizeString(option?.outcomeId) || null;
  const allowedOutcomeIds = asArray(question.learning?.allowedOutcomeIds)
    .map(outcome => normalizeString(outcome))
    .filter(Boolean);

  if (!option || !outcomeId) {
    return {
      outcomeId: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
      selected: false,
      reasonCode: POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.SELECTED_OPTION_MISSING,
    };
  }

  if (!allowedOutcomeIds.includes(outcomeId)) {
    return {
      outcomeId: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
      selected: false,
      reasonCode: POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.SELECTED_OUTCOME_NOT_ALLOWED,
    };
  }

  return {
    outcomeId,
    selected: true,
    reasonCode: null,
  };
}

function buildOutcomeOnlyDecision({
  classification = {},
  destination = {},
  finalOutcomeRecorded = false,
  question = {},
}) {
  const sourceClassification = asObject(classification);
  const targetDestination = asObject(destination);

  return buildPolicyLearningDecision({
    sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
    answerOutcomeId: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
    question: {
      frameId: normalizeString(question.frameId) || QUESTION_FRAME_IDS.DESTINATION_FIT,
      stale: question.stale === true,
    },
    answer: {
      label: normalizeString(targetDestination.libraryName) || 'Resolved destination',
      destinationLibraryId: normalizePositiveInteger(targetDestination.libraryId),
      destinationLibraryName: normalizeString(targetDestination.libraryName) || null,
      ambiguous: false,
    },
    finalOutcome: {
      itemId: normalizePositiveInteger(sourceClassification.id),
      destinationLibraryId: normalizePositiveInteger(targetDestination.libraryId),
      destinationLibraryName: normalizeString(targetDestination.libraryName) || null,
      recorded: finalOutcomeRecorded === true,
    },
  });
}

function buildPolicyDiscordPendingAnswerLearning({
  classification = {},
  destination = {},
  persistedQuestion = {},
  selectedOptionIndex = null,
  finalOutcomeRecorded = false,
} = {}) {
  const questionProof = buildQuestionProof(persistedQuestion);
  const selectedAnswer = selectAnswerOutcome(questionProof.question, selectedOptionIndex);
  const finalOutcomeIsRecorded = finalOutcomeRecorded === true;
  const reasonCodes = [...questionProof.reasonCodes];
  let decision = buildOutcomeOnlyDecision({
    classification,
    destination,
    finalOutcomeRecorded: finalOutcomeIsRecorded,
    question: questionProof.question,
  });
  let statusId = POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.OUTCOME_ONLY;

  if (!finalOutcomeIsRecorded) {
    reasonCodes.push(
      POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.FINAL_OUTCOME_NOT_RECORDED
    );
    statusId = POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.BLOCKED;
  } else if (!questionProof.valid) {
    statusId = POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.OUTCOME_ONLY;
  } else if (!selectedAnswer.selected) {
    reasonCodes.push(selectedAnswer.reasonCode);
    statusId = POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.OUTCOME_ONLY;
  } else if (selectedAnswer.outcomeId !== ANSWER_OUTCOME_IDS.DO_NOT_LEARN &&
    selectedAnswer.outcomeId !== ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM) {
    // Current runtime-question contracts deliberately forbid learning-enabled
    // options. Preserve that invariant if a future persisted record is altered.
    reasonCodes.push(
      POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.QUESTION_DOES_NOT_ALLOW_LEARNING
    );
    statusId = POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.OUTCOME_ONLY;
  } else {
    decision = buildPolicyLearningDecision({
      sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
      answerOutcomeId: selectedAnswer.outcomeId,
      question: {
        frameId: questionProof.frameId || QUESTION_FRAME_IDS.DESTINATION_FIT,
        stale: questionProof.question.stale === true,
      },
      answer: {
        label: normalizeString(asObject(destination).libraryName) || 'Resolved destination',
        destinationLibraryId: normalizePositiveInteger(asObject(destination).libraryId),
        destinationLibraryName: normalizeString(asObject(destination).libraryName) || null,
        ambiguous: false,
      },
      finalOutcome: {
        itemId: normalizePositiveInteger(asObject(classification).id),
        destinationLibraryId: normalizePositiveInteger(asObject(destination).libraryId),
        destinationLibraryName: normalizeString(asObject(destination).libraryName) || null,
        recorded: true,
      },
    });

    if (decision.learning.decisionId !== POLICY_LEARNING_DECISION_IDS.OUTCOME_ONLY ||
      decision.learning.tierId !== POLICY_LEARNING_TIER_IDS.NONE ||
      decision.learning.canWriteLearning === true) {
      reasonCodes.push(
        POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.LEARNING_GUARD_NOT_ADMITTED
      );
      decision = buildOutcomeOnlyDecision({
        classification,
        destination,
        finalOutcomeRecorded: true,
        question: questionProof.question,
      });
    }
  }

  const result = {
    version: POLICY_DISCORD_PENDING_ANSWER_LEARNING_VERSION,
    ok: statusId !== POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.BLOCKED,
    statusId,
    selectedAnswerOutcomeId: selectedAnswer.selected ? selectedAnswer.outcomeId : null,
    decision,
    questionProof: {
      valid: questionProof.valid,
      version: questionProof.version,
      frameId: questionProof.frameId,
      evidenceFingerprint: questionProof.evidenceFingerprint,
      issueCount: questionProof.issueCount,
      reasonCodes: questionProof.reasonCodes,
    },
    reasonCodes: uniqueReasonCodes([
      ...reasonCodes,
      ...decision.learning.reasonCodes,
      ...decision.learning.blockedReasonCodes,
    ]),
    sideEffects: {
      finalOutcomeRecorded: finalOutcomeIsRecorded,
      learningMutationPerformed: false,
      profileRefreshQueued: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
      routeAttemptPerformed: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyDiscordPendingAnswerLearningAudit(result),
  };
}

function buildPolicyDiscordPendingAnswerLearningAudit(result = {}) {
  const source = asObject(result);
  const decision = asObject(source.decision);
  const learning = asObject(decision.learning);
  const questionProof = asObject(source.questionProof);
  const sideEffects = asObject(source.sideEffects);
  const decisionAudit = buildPolicyLearningGuardAudit(decision);
  const issues = [];

  if (source.version !== POLICY_DISCORD_PENDING_ANSWER_LEARNING_VERSION) {
    issues.push({
      riskId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Discord pending-answer learning must use the current contract version.',
    });
  }

  if (!Object.values(POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS).includes(source.statusId)) {
    issues.push({
      riskId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS.INVALID_STATUS,
      message: 'Discord pending-answer learning must use a supported status.',
    });
  }

  if (!decisionAudit.ok) {
    issues.push({
      riskId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS.INVALID_GUARD_DECISION,
      message: 'Discord pending-answer learning requires a valid learning-guard decision.',
    });
  }

  if (source.statusId === POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.READY &&
    (learning.decisionId !== POLICY_LEARNING_DECISION_IDS.CANDIDATE ||
      learning.canWriteLearning !== true)) {
    issues.push({
      riskId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS.READY_WITHOUT_GUARDED_LEARNING,
      message: 'Ready Discord pending-answer learning requires an admitted guarded candidate.',
    });
  }

  if (source.statusId === POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.OUTCOME_ONLY &&
    (learning.tierId !== POLICY_LEARNING_TIER_IDS.NONE || learning.canWriteLearning === true)) {
    issues.push({
      riskId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS.OUTCOME_ONLY_WITH_LEARNING,
      message: 'Outcome-only Discord pending answers cannot write durable learning.',
    });
  }

  if (questionProof.valid === true && !questionProof.evidenceFingerprint) {
    issues.push({
      riskId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS.INVALID_QUESTION_PROOF,
      message: 'A valid Discord pending-answer question proof must carry its evidence fingerprint.',
    });
  }

  const prohibitedSideEffect = [
    'learningMutationPerformed',
    'profileRefreshQueued',
    'providerLookupPerformed',
    'providerQuotaRead',
    'routeAttemptPerformed',
  ].find(sideEffectId => sideEffects[sideEffectId] === true);
  if (prohibitedSideEffect) {
    issues.push({
      riskId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      message: 'Discord pending-answer learning admission must remain side-effect free.',
      sideEffectId: prohibitedSideEffect,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    guardAudit: {
      ok: decisionAudit.ok,
      issueCount: decisionAudit.issueCount,
    },
  };
}

const policyDiscordPendingAnswerLearningService = Object.freeze({
  build: buildPolicyDiscordPendingAnswerLearning,
  audit: buildPolicyDiscordPendingAnswerLearningAudit,
});

export {
  POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS,
  POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS,
  POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS,
  POLICY_DISCORD_PENDING_ANSWER_LEARNING_VERSION,
  buildPolicyDiscordPendingAnswerLearning,
  buildPolicyDiscordPendingAnswerLearningAudit,
  policyDiscordPendingAnswerLearningService,
};
