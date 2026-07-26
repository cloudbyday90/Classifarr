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
  getAnswerOutcome,
  normalizeQuestionFrame,
} from './policyQuestionLearningVocabulary.mjs';
import {
  POLICY_LEARNING_EVENT_SOURCE_IDS,
  getPolicyLearningSource,
} from './policyLearningGuard.mjs';
import {
  buildPolicyFinalOutcome,
  buildPolicyFinalOutcomeAudit,
} from './policyFinalOutcomeNormalizer.mjs';

const POLICY_LEARNING_INTAKE_VERSION = 'policy.learning_intake.v1';
const MAX_IDENTIFIER_LENGTH = 120;
const MAX_TEXT_LENGTH = 160;

const POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_learning_intake_version',
  UNKNOWN_FIELD: 'unknown_learning_intake_field',
  UNKNOWN_SOURCE: 'unknown_learning_intake_source',
  MISSING_SOURCE_EVENT: 'missing_learning_intake_source_event',
  UNKNOWN_ANSWER_OUTCOME: 'unknown_learning_intake_answer_outcome',
  UNKNOWN_QUESTION_FRAME: 'unknown_learning_intake_question_frame',
  INVALID_FINAL_OUTCOME: 'invalid_learning_intake_final_outcome',
  FINAL_OUTCOME_SOURCE_MISMATCH: 'learning_intake_final_outcome_source_mismatch',
  FINAL_OUTCOME_ANSWER_MISMATCH: 'learning_intake_final_outcome_answer_mismatch',
});

const POLICY_LEARNING_INTAKE_FIELDS = new Set([
  'version',
  'sourceId',
  'sourceEventId',
  'actorId',
  'itemId',
  'answerOutcomeId',
  'question',
  'answer',
  'candidate',
  'context',
  'finalOutcome',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeIdentifier(value) {
  if (Number.isInteger(value) && value >= 0) return value;

  return normalizeString(value, MAX_IDENTIFIER_LENGTH) || null;
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function normalizeQuestion(value = {}) {
  const question = asObject(value);
  const frame = normalizeQuestionFrame(normalizeString(question.frameId, 80));

  return {
    frameId: frame.frameId,
    stale: question.stale === true,
  };
}

function normalizeAnswer(value = {}) {
  const answer = asObject(value);

  return {
    label: normalizeString(answer.label),
    destinationLibraryId: normalizeIdentifier(
      answer.destinationLibraryId ?? answer.libraryId,
    ),
    destinationLibraryName: normalizeString(
      answer.destinationLibraryName ?? answer.libraryName,
    ),
    ambiguous: answer.ambiguous === true,
  };
}

function normalizeCandidate(value = {}) {
  const candidate = asObject(value);

  return {
    key: normalizeString(candidate.key),
    label: normalizeString(candidate.label ?? candidate.value),
    signalType: normalizeString(candidate.signalType ?? candidate.signal_type, 80),
    destinationLibraryId: normalizeIdentifier(
      candidate.destinationLibraryId ?? candidate.libraryId,
    ),
    destinationLibraryName: normalizeString(
      candidate.destinationLibraryName ?? candidate.libraryName,
    ),
    evidenceCount: normalizeCount(
      candidate.evidenceCount ?? candidate.count ?? candidate.supportingExampleCount,
    ),
    evidenceSource: normalizeString(candidate.evidenceSource, 80),
  };
}

function normalizeContext(value = {}) {
  const context = asObject(value);

  return {
    // Carry only the fact that explanation text was present; raw model text is
    // neither needed by the guard nor safe to retain in an intake envelope.
    aiExplanationText: normalizeString(context.aiExplanationText) ? 'present' : '',
    aiAuthored: context.aiAuthored === true,
    providerQuotaState: normalizeString(context.providerQuotaState, 80),
    providerCooldownState: normalizeString(context.providerCooldownState, 80),
    replayDiagnosticState: normalizeString(context.replayDiagnosticState, 80),
    tmdbDiagnosticState: normalizeString(context.tmdbDiagnosticState, 80),
    tmdbCoverageState: normalizeString(context.tmdbCoverageState, 80),
  };
}

function buildPolicyLearningIntakeEvent(input = {}) {
  const source = asObject(input);
  const sourceId = normalizeString(source.sourceId, 80);
  const answerOutcomeId = normalizeString(source.answerOutcomeId, 80);
  const answer = normalizeAnswer(source.answer);
  const finalOutcomeInput = asObject(source.finalOutcome);

  return {
    version: POLICY_LEARNING_INTAKE_VERSION,
    sourceId: getPolicyLearningSource(sourceId)?.id || null,
    sourceEventId: normalizeString(source.sourceEventId, MAX_IDENTIFIER_LENGTH) || null,
    actorId: normalizeString(source.actorId, MAX_IDENTIFIER_LENGTH) || null,
    itemId: normalizeIdentifier(source.itemId ?? finalOutcomeInput.itemId),
    answerOutcomeId: getAnswerOutcome(answerOutcomeId)?.id || null,
    question: normalizeQuestion(source.question),
    answer,
    candidate: normalizeCandidate(source.candidate),
    context: normalizeContext(source.context),
    finalOutcome: buildPolicyFinalOutcome({
      sourceId,
      answerOutcomeId,
      itemId: finalOutcomeInput.itemId ?? source.itemId,
      destinationLibraryId:
        finalOutcomeInput.destinationLibraryId ?? answer.destinationLibraryId,
      destinationLibraryName:
        finalOutcomeInput.destinationLibraryName ?? answer.destinationLibraryName ?? answer.label,
      status: finalOutcomeInput.status,
      route: finalOutcomeInput.route,
      recorded: finalOutcomeInput.recorded,
    }),
  };
}

function validatePolicyLearningIntakeEvent(event = {}) {
  const intake = asObject(event);
  const issues = [];

  Object.keys(intake).forEach(field => {
    if (!POLICY_LEARNING_INTAKE_FIELDS.has(field)) {
      issues.push({
        riskId: POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.UNKNOWN_FIELD,
        field,
        message: 'Learning intake contains an unsupported field.',
      });
    }
  });

  if (intake.version !== POLICY_LEARNING_INTAKE_VERSION) {
    issues.push({
      riskId: POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.INVALID_VERSION,
      field: 'version',
      message: 'Learning intake must use the current intake contract version.',
    });
  }

  if (!getPolicyLearningSource(intake.sourceId)) {
    issues.push({
      riskId: POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.UNKNOWN_SOURCE,
      field: 'sourceId',
      message: 'Learning intake must use a known server-owned source.',
    });
  }

  if (!normalizeString(intake.sourceEventId, MAX_IDENTIFIER_LENGTH)) {
    issues.push({
      riskId: POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.MISSING_SOURCE_EVENT,
      field: 'sourceEventId',
      message: 'Learning intake requires a bounded source event identifier.',
    });
  }

  if (!getAnswerOutcome(intake.answerOutcomeId)) {
    issues.push({
      riskId: POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.UNKNOWN_ANSWER_OUTCOME,
      field: 'answerOutcomeId',
      message: 'Learning intake must use a known answer outcome.',
    });
  }

  if (!normalizeQuestionFrame(asObject(intake.question).frameId).frameId) {
    issues.push({
      riskId: POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.UNKNOWN_QUESTION_FRAME,
      field: 'question.frameId',
      message: 'Learning intake must use a known accepted or rejected question frame.',
    });
  }

  const finalOutcome = asObject(intake.finalOutcome);
  if (buildPolicyFinalOutcomeAudit(finalOutcome).ok !== true) {
    issues.push({
      riskId: POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.INVALID_FINAL_OUTCOME,
      field: 'finalOutcome',
      message: 'Learning intake requires a valid final outcome.',
    });
  }

  if (finalOutcome.sourceId !== intake.sourceId) {
    issues.push({
      riskId: POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.FINAL_OUTCOME_SOURCE_MISMATCH,
      field: 'finalOutcome.sourceId',
      message: 'Final-outcome source must match the learning-intake source.',
    });
  }

  if (finalOutcome.answerOutcomeId !== intake.answerOutcomeId) {
    issues.push({
      riskId: POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.FINAL_OUTCOME_ANSWER_MISMATCH,
      field: 'finalOutcome.answerOutcomeId',
      message: 'Final-outcome answer must match the learning-intake answer outcome.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyLearningGuardInput(intakeEvent = {}) {
  const validation = validatePolicyLearningIntakeEvent(intakeEvent);
  if (!validation.ok) return null;

  const intake = asObject(intakeEvent);

  return {
    sourceId: intake.sourceId,
    answerOutcomeId: intake.answerOutcomeId,
    question: intake.question,
    answer: intake.answer,
    candidate: intake.candidate,
    context: intake.context,
    finalOutcome: intake.finalOutcome,
  };
}

const policyLearningIntakeContractService = Object.freeze({
  build: buildPolicyLearningIntakeEvent,
  validate: validatePolicyLearningIntakeEvent,
  buildGuardInput: buildPolicyLearningGuardInput,
});

export {
  POLICY_LEARNING_EVENT_SOURCE_IDS,
  POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS,
  POLICY_LEARNING_INTAKE_VERSION,
  buildPolicyLearningGuardInput,
  buildPolicyLearningIntakeEvent,
  policyLearningIntakeContractService,
  validatePolicyLearningIntakeEvent,
};
