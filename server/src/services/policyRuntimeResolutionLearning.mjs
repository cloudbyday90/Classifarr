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
  normalizeQuestionFrame,
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
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
} from './policyRuntimeQuestionAnswerContract.mjs';
import {
  isPolicyRuntimeQuestionPersistenceEnvelope,
} from './policyRuntimeQuestionPersistenceContract.mjs';

const POLICY_RUNTIME_RESOLUTION_LEARNING_VERSION =
  'policy.runtime_resolution_learning.v1';

const POLICY_RUNTIME_RESOLUTION_LEARNING_STATUS_IDS = Object.freeze({
  OUTCOME_ONLY: 'outcome_only',
  BLOCKED: 'blocked',
});

const POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS = Object.freeze({
  OUTCOME_ONLY_RECORDED: 'runtime_resolution_outcome_only_recorded',
  LEGACY_RULE_GENERATION_BLOCKED: 'runtime_resolution_legacy_rule_generation_blocked',
  INCOMPLETE_RESOLUTION_REFERENCE: 'runtime_resolution_incomplete_reference',
  INVALID_LEARNING_INTAKE: 'runtime_resolution_invalid_learning_intake',
  INVALID_LEARNING_GUARD: 'runtime_resolution_invalid_learning_guard',
  LEARNING_WRITE_NOT_ALLOWED: 'runtime_resolution_learning_write_not_allowed',
  PROFILE_REFRESH_NOT_ALLOWED: 'runtime_resolution_profile_refresh_not_allowed',
});

const POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_runtime_resolution_learning_version',
  INVALID_STATUS: 'invalid_runtime_resolution_learning_status',
  INCOMPLETE_RESOLUTION_REFERENCE: 'runtime_resolution_incomplete_reference',
  INVALID_LEARNING_INTAKE: 'invalid_runtime_resolution_learning_intake',
  INVALID_LEARNING_GUARD: 'invalid_runtime_resolution_learning_guard',
  OUTCOME_ONLY_DECISION_REQUIRED: 'runtime_resolution_outcome_only_decision_required',
  LEARNING_WRITE_ALLOWED: 'runtime_resolution_learning_write_allowed',
  PROFILE_REFRESH_QUEUED: 'runtime_resolution_profile_refresh_queued',
  SIDE_EFFECT_REPORTED: 'runtime_resolution_learning_side_effect_reported',
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

function uniqueReasonCodes(reasonCodes = []) {
  return [...new Set(reasonCodes.filter(Boolean))];
}

function buildSourceEventId(classificationId) {
  const normalizedClassificationId = normalizePositiveInteger(classificationId);

  return normalizedClassificationId
    ? `classification:${normalizedClassificationId}:runtime-resolution`
    : 'classification:unknown:runtime-resolution';
}

function getQuestionFrameId(question = null) {
  const source = asObject(question);
  const rawFrameId = isPolicyRuntimeQuestionPersistenceEnvelope(source)
    ? asObject(source.runtimeQuestion).frameId
    : asObject(asObject(source.meta).runtime_question_normalization).frame_id;
  const normalizedFrame = normalizeQuestionFrame(rawFrameId);

  return normalizedFrame.accepted
    ? normalizedFrame.frameId
    : QUESTION_FRAME_IDS.OUTLIER_REVIEW;
}

function getSourceId(question = null) {
  return question && typeof question === 'object'
    ? POLICY_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION
    : POLICY_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE;
}

function getAnswerOutcomeId(answerContract = null) {
  if (asObject(answerContract).actionId ===
      POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.ROUTE_NOT_APPLICABLE) {
    return ANSWER_OUTCOME_IDS.DO_NOT_LEARN;
  }

  return asObject(answerContract).actionId
    ? ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM
    : ANSWER_OUTCOME_IDS.DO_NOT_LEARN;
}

function getAiAuthored(question = null) {
  const source = asObject(question);

  return asObject(asObject(source.meta).runtime_question_normalization)
    .ai_diagnostic_present === true;
}

function summarizeDecision(decision = null) {
  const source = asObject(decision);
  const learning = asObject(source.learning);
  const profileRefresh = asObject(source.profileRefresh);

  return {
    version: normalizeString(source.version, 80) || null,
    decisionId: normalizeString(learning.decisionId, 80) || null,
    tierId: normalizeString(learning.tierId, 80) || null,
    canWriteLearning: learning.canWriteLearning === true,
    requiresExplicitPolicyEdit: learning.requiresExplicitPolicyEdit === true,
    authoritySourceId: normalizeString(learning.authoritySourceId, 80) || null,
    reasonCodes: Array.isArray(learning.reasonCodes) ? learning.reasonCodes : [],
    blockedReasonCodes: Array.isArray(learning.blockedReasonCodes)
      ? learning.blockedReasonCodes
      : [],
    profileRefreshQueued: profileRefresh.queue === true,
  };
}

function buildPolicyRuntimeResolutionLearning({
  classification = {},
  question = null,
  destination = {},
  selectedOption = null,
  answerContract = null,
  actorId = null,
  legacyRuleGenerationRequested = false,
} = {}) {
  const sourceClassification = asObject(classification);
  const selectedDestination = asObject(destination);
  const classificationId = normalizePositiveInteger(sourceClassification.id);
  const libraryId = normalizePositiveInteger(
    selectedDestination.libraryId ?? selectedDestination.id,
  );
  const libraryName = normalizeString(
    selectedDestination.libraryName ?? selectedDestination.name,
  );
  const sourceId = getSourceId(question);
  const answerOutcomeId = getAnswerOutcomeId(answerContract);
  const questionFrameId = getQuestionFrameId(question);
  const answerLabel = normalizeString(selectedOption, 160) || libraryName || 'Resolved destination';
  const referencesComplete = Boolean(classificationId && libraryId && libraryName);
  const intake = buildPolicyLearningIntakeEvent({
    sourceId,
    sourceEventId: buildSourceEventId(classificationId),
    actorId: normalizeString(actorId, 120) || null,
    itemId: classificationId,
    answerOutcomeId,
    question: {
      frameId: questionFrameId,
      stale: false,
    },
    answer: {
      label: answerLabel,
      destinationLibraryId: libraryId,
      destinationLibraryName: libraryName,
      ambiguous: false,
    },
    context: {
      aiAuthored: getAiAuthored(question),
    },
    finalOutcome: {
      itemId: classificationId,
      destinationLibraryId: libraryId,
      destinationLibraryName: libraryName,
      recorded: true,
    },
  });
  const intakeAudit = validatePolicyLearningIntakeEvent(intake);
  const guardInput = buildPolicyLearningGuardInput(intake);
  const decision = guardInput ? buildPolicyLearningDecision(guardInput) : null;
  const guardAudit = decision ? buildPolicyLearningGuardAudit(decision) : null;
  const decisionSummary = summarizeDecision(decision);
  const outcomeOnly = referencesComplete &&
    intakeAudit.ok === true &&
    guardAudit?.ok === true &&
    decisionSummary.decisionId === POLICY_LEARNING_DECISION_IDS.OUTCOME_ONLY &&
    decisionSummary.canWriteLearning !== true &&
    decisionSummary.profileRefreshQueued !== true;
  const reasonCodes = uniqueReasonCodes([
    outcomeOnly
      ? POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS.OUTCOME_ONLY_RECORDED
      : POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS.INVALID_LEARNING_INTAKE,
    legacyRuleGenerationRequested === true
      ? POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS.LEGACY_RULE_GENERATION_BLOCKED
      : null,
    referencesComplete
      ? null
      : POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS.INCOMPLETE_RESOLUTION_REFERENCE,
    ...(decisionSummary.reasonCodes || []),
    ...(decisionSummary.blockedReasonCodes || []),
    intakeAudit.ok ? null : POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS.INVALID_LEARNING_INTAKE,
    guardAudit?.ok === false
      ? POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS.INVALID_LEARNING_GUARD
      : null,
    decisionSummary.canWriteLearning === true
      ? POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS.LEARNING_WRITE_NOT_ALLOWED
      : null,
    decisionSummary.profileRefreshQueued === true
      ? POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS.PROFILE_REFRESH_NOT_ALLOWED
      : null,
  ]);
  const result = {
    version: POLICY_RUNTIME_RESOLUTION_LEARNING_VERSION,
    ok: outcomeOnly,
    statusId: outcomeOnly
      ? POLICY_RUNTIME_RESOLUTION_LEARNING_STATUS_IDS.OUTCOME_ONLY
      : POLICY_RUNTIME_RESOLUTION_LEARNING_STATUS_IDS.BLOCKED,
    sourceId,
    sourceEventId: intake.sourceEventId,
    questionFrameId,
    answerOutcomeId,
    referencesComplete,
    intake,
    decision,
    decisionSummary,
    reasonCodes,
    sideEffects: {
      outcomePersisted: false,
      learningMutationPerformed: false,
      profileRefreshQueued: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
      routingAttempted: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyRuntimeResolutionLearningAudit(result),
  };
}

function buildPolicyRuntimeResolutionLearningAudit(result = {}) {
  const source = asObject(result);
  const decisionSummary = asObject(source.decisionSummary);
  const sideEffects = asObject(source.sideEffects);
  const intakeAudit = validatePolicyLearningIntakeEvent(source.intake);
  const guardAudit = source.decision
    ? buildPolicyLearningGuardAudit(source.decision)
    : { ok: false, issueCount: 1 };
  const issues = [];

  if (source.version !== POLICY_RUNTIME_RESOLUTION_LEARNING_VERSION) {
    issues.push({
      riskId: POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Runtime resolution learning must use the current contract version.',
    });
  }

  if (!Object.values(POLICY_RUNTIME_RESOLUTION_LEARNING_STATUS_IDS).includes(source.statusId)) {
    issues.push({
      riskId: POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS.INVALID_STATUS,
      message: 'Runtime resolution learning must use a supported status.',
    });
  }

  if (source.referencesComplete !== true) {
    issues.push({
      riskId: POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS.INCOMPLETE_RESOLUTION_REFERENCE,
      message: 'Runtime resolution learning requires a classification and destination reference.',
    });
  }

  if (!intakeAudit.ok) {
    issues.push({
      riskId: POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS.INVALID_LEARNING_INTAKE,
      message: 'Runtime resolution learning requires a valid canonical intake event.',
    });
  }

  if (!guardAudit.ok) {
    issues.push({
      riskId: POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS.INVALID_LEARNING_GUARD,
      message: 'Runtime resolution learning requires a valid learning-guard decision.',
    });
  }

  if (source.statusId === POLICY_RUNTIME_RESOLUTION_LEARNING_STATUS_IDS.OUTCOME_ONLY &&
      decisionSummary.decisionId !== POLICY_LEARNING_DECISION_IDS.OUTCOME_ONLY) {
    issues.push({
      riskId: POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS.OUTCOME_ONLY_DECISION_REQUIRED,
      message: 'Outcome-only runtime resolution requires an outcome-only guard decision.',
    });
  }

  if (decisionSummary.canWriteLearning === true) {
    issues.push({
      riskId: POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS.LEARNING_WRITE_ALLOWED,
      message: 'Runtime resolution cannot directly authorize durable learning.',
    });
  }

  if (decisionSummary.profileRefreshQueued === true || sideEffects.profileRefreshQueued === true) {
    issues.push({
      riskId: POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS.PROFILE_REFRESH_QUEUED,
      message: 'Runtime resolution cannot queue a profile refresh.',
    });
  }

  const prohibitedSideEffect = [
    'learningMutationPerformed',
    'providerLookupPerformed',
    'providerQuotaRead',
    'routingAttempted',
  ].find(sideEffectId => sideEffects[sideEffectId] === true);
  if (prohibitedSideEffect) {
    issues.push({
      riskId: POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      message: 'Runtime resolution learning admission must remain side-effect free.',
      sideEffectId: prohibitedSideEffect,
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    intakeAudit: {
      ok: intakeAudit.ok,
      issueCount: intakeAudit.issueCount,
    },
    guardAudit: {
      ok: guardAudit.ok,
      issueCount: guardAudit.issueCount,
    },
  };
}

function buildPolicyRuntimeResolutionLearningOutcomePatch(result = {}) {
  const source = asObject(result);
  const decision = asObject(source.decisionSummary);

  return {
    runtime_resolution_learning: {
      version: normalizeString(source.version, 80) || null,
      status_id: normalizeString(source.statusId, 80) || null,
      source_id: normalizeString(source.sourceId, 80) || null,
      source_event_id: normalizeString(source.sourceEventId, 120) || null,
      question_frame_id: normalizeString(source.questionFrameId, 80) || null,
      answer_outcome_id: normalizeString(source.answerOutcomeId, 80) || null,
      decision: {
        decision_id: decision.decisionId || null,
        tier_id: decision.tierId || null,
        can_write_learning: decision.canWriteLearning === true,
        requires_explicit_policy_edit: decision.requiresExplicitPolicyEdit === true,
        authority_source_id: decision.authoritySourceId || null,
        reason_codes: decision.reasonCodes || [],
        blocked_reason_codes: decision.blockedReasonCodes || [],
      },
      reason_codes: Array.isArray(source.reasonCodes) ? source.reasonCodes : [],
    },
  };
}

const policyRuntimeResolutionLearningService = Object.freeze({
  build: buildPolicyRuntimeResolutionLearning,
  audit: buildPolicyRuntimeResolutionLearningAudit,
  toOutcomePatch: buildPolicyRuntimeResolutionLearningOutcomePatch,
});

export {
  POLICY_RUNTIME_RESOLUTION_LEARNING_AUDIT_RISK_IDS,
  POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS,
  POLICY_RUNTIME_RESOLUTION_LEARNING_STATUS_IDS,
  POLICY_RUNTIME_RESOLUTION_LEARNING_VERSION,
  buildPolicyRuntimeResolutionLearning,
  buildPolicyRuntimeResolutionLearningAudit,
  buildPolicyRuntimeResolutionLearningOutcomePatch,
  policyRuntimeResolutionLearningService,
};
