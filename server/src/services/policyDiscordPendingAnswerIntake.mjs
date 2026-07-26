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
  isPolicyRuntimeQuestionPersistenceEnvelope,
} from './policyRuntimeQuestionPersistenceContract.mjs';

const POLICY_DISCORD_PENDING_ANSWER_INTAKE_VERSION =
  'policy.discord_pending_answer_intake.v1';

const DISCORD_PENDING_ANSWER_ACTION_IDS = Object.freeze({
  VERIFY_DESTINATION: 'verify_destination',
  CORRECT_DESTINATION: 'correct_destination',
});

const POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS = Object.freeze({
  NOT_APPLICABLE: 'not_applicable',
  OUTCOME_ONLY: 'outcome_only',
  BLOCKED: 'blocked',
});

const POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS = Object.freeze({
  INVALID_CLASSIFICATION: 'discord_pending_answer_invalid_classification',
  NOT_PENDING: 'discord_pending_answer_not_pending',
  UNSUPPORTED_ACTION: 'discord_pending_answer_unsupported_action',
  DESTINATION_MISSING: 'discord_pending_answer_destination_missing',
  FINAL_OUTCOME_NOT_RECORDED: 'discord_pending_answer_final_outcome_not_recorded',
  INVALID_LEARNING_INTAKE: 'discord_pending_answer_invalid_learning_intake',
  INVALID_GUARD_DECISION: 'discord_pending_answer_invalid_guard_decision',
  GUARD_NOT_OUTCOME_ONLY: 'discord_pending_answer_guard_not_outcome_only',
});

const POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_discord_pending_answer_intake_version',
  INVALID_STATUS: 'invalid_discord_pending_answer_intake_status',
  UNEXPECTED_ADMISSION: 'discord_pending_answer_intake_unexpected_admission',
  INVALID_LEARNING_INTAKE: 'invalid_discord_pending_answer_learning_intake',
  INVALID_GUARD_DECISION: 'invalid_discord_pending_answer_guard_decision',
  GUARD_NOT_OUTCOME_ONLY: 'discord_pending_answer_guard_not_outcome_only',
  FINAL_OUTCOME_NOT_RECORDED: 'discord_pending_answer_final_outcome_not_recorded',
  SIDE_EFFECT_REPORTED: 'discord_pending_answer_intake_side_effect_reported',
});

const PENDING_STATUS_IDS = new Set(['pending', 'awaiting_decision']);

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

function parsePersistedQuestion(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function normalizeActionId(value) {
  const actionId = normalizeString(value, 80);
  return Object.values(DISCORD_PENDING_ANSWER_ACTION_IDS).includes(actionId)
    ? actionId
    : null;
}

function normalizeDestination(value = {}) {
  const destination = asObject(value);

  return {
    libraryId: normalizePositiveInteger(destination.libraryId ?? destination.id),
    libraryName: normalizeString(destination.libraryName ?? destination.name) || null,
  };
}

function normalizeFingerprint(value) {
  const fingerprint = normalizeString(value, 80);
  return /^[A-Za-z0-9_-]{8,80}$/.test(fingerprint) ? fingerprint : null;
}

function buildPersistedPendingState(classification = {}) {
  const source = asObject(classification);
  const classificationId = normalizePositiveInteger(source.id);
  const statusId = normalizeString(source.status, 80).toLowerCase();

  if (!classificationId) {
    return {
      applicable: false,
      reasonId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS.INVALID_CLASSIFICATION,
      classificationId: null,
      sourceEventId: null,
      question: null,
      sourceStateId: null,
    };
  }

  if (!PENDING_STATUS_IDS.has(statusId)) {
    return {
      applicable: false,
      reasonId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS.NOT_PENDING,
      classificationId,
      sourceEventId: null,
      question: null,
      sourceStateId: null,
    };
  }

  const persistedQuestion = parsePersistedQuestion(source.policyQuestion ?? source.policy_question);
  if (isPolicyRuntimeQuestionPersistenceEnvelope(persistedQuestion)) {
    const runtimeQuestion = asObject(persistedQuestion.runtimeQuestion);
    const fingerprint = normalizeFingerprint(
      persistedQuestion.meta?.runtime_question_persistence?.evidenceFingerprint ??
      runtimeQuestion.decisionEvidenceFingerprint?.fingerprint,
    );

    return {
      applicable: true,
      reasonId: null,
      classificationId,
      sourceEventId: `classification:${classificationId}:discord_pending_answer:native:${fingerprint || 'unknown'}`,
      question: {
        frameId: normalizeString(runtimeQuestion.frameId, 80) || QUESTION_FRAME_IDS.MISSING_EVIDENCE,
        stale: runtimeQuestion.stale === true,
      },
      sourceStateId: 'native_pending_question',
    };
  }

  return {
    applicable: true,
    reasonId: null,
    classificationId,
    sourceEventId: `classification:${classificationId}:discord_pending_answer:legacy`,
    question: {
      frameId: QUESTION_FRAME_IDS.MISSING_EVIDENCE,
      stale: false,
    },
    sourceStateId: 'legacy_pending_state',
  };
}

function buildLearningIntake({ pendingState, destination, actionId, finalOutcomeRecorded }) {
  return buildPolicyLearningIntakeEvent({
    sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
    sourceEventId: pendingState.sourceEventId,
    itemId: pendingState.classificationId,
    answerOutcomeId: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
    question: pendingState.question,
    answer: {
      label: actionId,
      destinationLibraryId: destination.libraryId,
      destinationLibraryName: destination.libraryName,
      ambiguous: false,
    },
    finalOutcome: {
      itemId: pendingState.classificationId,
      destinationLibraryId: destination.libraryId,
      destinationLibraryName: destination.libraryName,
      recorded: finalOutcomeRecorded,
    },
  });
}

function buildPolicyDiscordPendingAnswerIntake({
  classification = {},
  destination = {},
  actionId,
  finalOutcomeRecorded = false,
} = {}) {
  const pendingState = buildPersistedPendingState(classification);
  const normalizedActionId = normalizeActionId(actionId);
  const normalizedDestination = normalizeDestination(destination);
  const outcomeRecorded = finalOutcomeRecorded === true;
  const reasonCodes = [];

  if (!pendingState.applicable) {
    const result = {
      version: POLICY_DISCORD_PENDING_ANSWER_INTAKE_VERSION,
      ok: true,
      statusId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS.NOT_APPLICABLE,
      sourceStateId: pendingState.sourceStateId,
      learningIntake: null,
      learningGuard: null,
      reasonCodes: [pendingState.reasonId],
      sideEffects: buildSideEffects({ finalOutcomeRecorded: outcomeRecorded }),
    };

    return {
      ...result,
      audit: buildPolicyDiscordPendingAnswerIntakeAudit(result),
    };
  }

  if (!normalizedActionId) {
    reasonCodes.push(POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS.UNSUPPORTED_ACTION);
  }

  if (!normalizedDestination.libraryId || !normalizedDestination.libraryName) {
    reasonCodes.push(POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS.DESTINATION_MISSING);
  }

  const intake = buildLearningIntake({
    pendingState,
    destination: normalizedDestination,
    actionId: normalizedActionId || 'unsupported_action',
    finalOutcomeRecorded: outcomeRecorded,
  });
  const intakeAudit = validatePolicyLearningIntakeEvent(intake);
  const guardInput = buildPolicyLearningGuardInput(intake);
  const decision = intakeAudit.ok && guardInput
    ? buildPolicyLearningDecision(guardInput)
    : null;
  const guardAudit = decision ? buildPolicyLearningGuardAudit(decision) : { ok: false };

  if (!outcomeRecorded) {
    reasonCodes.push(POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS.FINAL_OUTCOME_NOT_RECORDED);
  }
  if (!intakeAudit.ok || !guardInput) {
    reasonCodes.push(POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS.INVALID_LEARNING_INTAKE);
  }
  if (!guardAudit.ok) {
    reasonCodes.push(POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS.INVALID_GUARD_DECISION);
  }
  if (decision?.learning?.decisionId !== POLICY_LEARNING_DECISION_IDS.OUTCOME_ONLY ||
      decision?.learning?.canWriteLearning === true ||
      decision?.profileRefresh?.queue === true) {
    reasonCodes.push(POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS.GUARD_NOT_OUTCOME_ONLY);
  }

  const blocked = reasonCodes.length > 0;
  const result = {
    version: POLICY_DISCORD_PENDING_ANSWER_INTAKE_VERSION,
    ok: !blocked,
    statusId: blocked
      ? POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS.BLOCKED
      : POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS.OUTCOME_ONLY,
    sourceStateId: pendingState.sourceStateId,
    learningIntake: intake,
    learningGuard: decision,
    reasonCodes: [...new Set(reasonCodes)],
    sideEffects: buildSideEffects({ finalOutcomeRecorded: outcomeRecorded }),
  };

  return {
    ...result,
    audit: buildPolicyDiscordPendingAnswerIntakeAudit(result),
  };
}

function buildSideEffects({ finalOutcomeRecorded = false } = {}) {
  return {
    finalOutcomeRecorded: finalOutcomeRecorded === true,
    learningMutationPerformed: false,
    profileRefreshQueued: false,
    providerLookupPerformed: false,
    providerQuotaRead: false,
    routeAttemptPerformed: false,
  };
}

function buildPolicyDiscordPendingAnswerIntakeAudit(result = {}) {
  const source = asObject(result);
  const statusId = normalizeString(source.statusId, 80);
  const sideEffects = asObject(source.sideEffects);
  const learningIntake = source.learningIntake;
  const learningGuard = source.learningGuard;
  const issues = [];

  if (source.version !== POLICY_DISCORD_PENDING_ANSWER_INTAKE_VERSION) {
    issues.push({
      riskId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Discord pending-answer intake must use the current contract version.',
    });
  }

  if (!Object.values(POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS).includes(statusId)) {
    issues.push({
      riskId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS.INVALID_STATUS,
      message: 'Discord pending-answer intake must use a supported status.',
    });
  }

  if (statusId === POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS.NOT_APPLICABLE) {
    if (learningIntake || learningGuard) {
      issues.push({
        riskId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS.UNEXPECTED_ADMISSION,
        message: 'A non-pending Discord action cannot admit a learning intake or guard decision.',
      });
    }
  } else {
    const intakeAudit = validatePolicyLearningIntakeEvent(learningIntake);
    const guardAudit = buildPolicyLearningGuardAudit(learningGuard);

    if (!intakeAudit.ok) {
      issues.push({
        riskId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS.INVALID_LEARNING_INTAKE,
        message: 'Discord pending-answer intake requires valid canonical learning intake.',
      });
    }
    if (!guardAudit.ok) {
      issues.push({
        riskId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS.INVALID_GUARD_DECISION,
        message: 'Discord pending-answer intake requires a valid learning-guard decision.',
      });
    }
    if (learningGuard?.learning?.decisionId !== POLICY_LEARNING_DECISION_IDS.OUTCOME_ONLY ||
        learningGuard?.learning?.canWriteLearning === true ||
        learningGuard?.profileRefresh?.queue === true) {
      issues.push({
        riskId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS.GUARD_NOT_OUTCOME_ONLY,
        message: 'Discord pending answers must remain outcome-only at this boundary.',
      });
    }
    if (statusId === POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS.OUTCOME_ONLY &&
        sideEffects.finalOutcomeRecorded !== true) {
      issues.push({
        riskId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS.FINAL_OUTCOME_NOT_RECORDED,
        message: 'Outcome-only Discord intake requires a confirmed persisted final outcome.',
      });
    }
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
      riskId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      message: 'Discord pending-answer intake must remain side-effect free.',
      sideEffectId: prohibitedSideEffect,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

const policyDiscordPendingAnswerIntakeService = Object.freeze({
  build: buildPolicyDiscordPendingAnswerIntake,
  audit: buildPolicyDiscordPendingAnswerIntakeAudit,
});

export {
  DISCORD_PENDING_ANSWER_ACTION_IDS,
  POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS,
  POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS,
  POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS,
  POLICY_DISCORD_PENDING_ANSWER_INTAKE_VERSION,
  buildPolicyDiscordPendingAnswerIntake,
  buildPolicyDiscordPendingAnswerIntakeAudit,
  policyDiscordPendingAnswerIntakeService,
};
