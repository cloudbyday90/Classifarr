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

const POLICY_MANUAL_CORRECTION_LEARNING_VERSION = 'policy.manual_correction_learning.v1';

const POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS = Object.freeze({
  READY: 'ready',
  OUTCOME_ONLY: 'outcome_only',
  BLOCKED: 'blocked',
});

const POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS = Object.freeze({
  EXACT_ITEM_MEMORY_ADMITTED: 'manual_correction_exact_item_memory_admitted',
  FINAL_OUTCOME_NOT_RECORDED: 'manual_correction_final_outcome_not_recorded',
  EXACT_ITEM_REFERENCE_MISSING: 'manual_correction_exact_item_reference_missing',
  DESTINATION_REFERENCE_MISSING: 'manual_correction_destination_reference_missing',
  UNSUPPORTED_MEDIA_TYPE: 'manual_correction_unsupported_media_type',
  INVALID_GUARD_DECISION: 'manual_correction_invalid_guard_decision',
});

const POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_manual_correction_learning_version',
  INVALID_STATUS: 'invalid_manual_correction_learning_status',
  INVALID_GUARD_DECISION: 'invalid_manual_correction_learning_guard_decision',
  INVALID_EXACT_ITEM_MEMORY: 'invalid_manual_correction_exact_item_memory',
  READY_WITHOUT_EXACT_ITEM_MEMORY: 'ready_manual_correction_requires_exact_item_memory',
  NON_READY_WITH_EXACT_ITEM_MEMORY: 'non_ready_manual_correction_cannot_write_exact_item_memory',
  PROFILE_REFRESH_QUEUED: 'manual_correction_exact_item_memory_cannot_queue_profile_refresh',
  SIDE_EFFECT_REPORTED: 'manual_correction_learning_service_cannot_report_side_effects',
});

const SUPPORTED_MEDIA_TYPES = Object.freeze(['movie', 'tv']);

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

function normalizeMediaType(value) {
  const mediaType = normalizeString(value, 20).toLowerCase();
  return SUPPORTED_MEDIA_TYPES.includes(mediaType) ? mediaType : null;
}

function uniqueReasonCodes(reasonCodes = []) {
  return [...new Set(reasonCodes.filter(Boolean))];
}

function buildExactItemMemory({ classification = {}, destination = {} } = {}) {
  const sourceClassification = asObject(classification);
  const targetDestination = asObject(destination);
  const classificationId = normalizePositiveInteger(sourceClassification.id);
  const tmdbId = normalizePositiveInteger(sourceClassification.tmdbId);
  const mediaType = normalizeMediaType(sourceClassification.mediaType);
  const libraryId = normalizePositiveInteger(targetDestination.libraryId);
  const libraryName = normalizeString(targetDestination.libraryName);
  const reasonCodes = [];

  if (!classificationId || !tmdbId) {
    reasonCodes.push(POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS.EXACT_ITEM_REFERENCE_MISSING);
  }

  if (!mediaType) {
    reasonCodes.push(POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS.UNSUPPORTED_MEDIA_TYPE);
  }

  if (!libraryId || !libraryName) {
    reasonCodes.push(POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS.DESTINATION_REFERENCE_MISSING);
  }

  return {
    eligible: reasonCodes.length === 0,
    classificationId,
    tmdbId,
    mediaType,
    libraryId,
    libraryName: libraryName || null,
    reasonCodes,
  };
}

function buildOutcomeOnlyDecision({ exactItemMemory, finalOutcomeRecorded }) {
  return buildPolicyLearningDecision({
    sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE,
    answerOutcomeId: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
    question: {
      frameId: QUESTION_FRAME_IDS.DESTINATION_FIT,
      stale: false,
    },
    answer: {
      label: exactItemMemory.libraryName || 'Manual correction destination',
      destinationLibraryId: exactItemMemory.libraryId,
      destinationLibraryName: exactItemMemory.libraryName,
      ambiguous: false,
    },
    finalOutcome: {
      itemId: exactItemMemory.classificationId,
      destinationLibraryId: exactItemMemory.libraryId,
      destinationLibraryName: exactItemMemory.libraryName,
      recorded: finalOutcomeRecorded,
    },
  });
}

function buildPolicyManualCorrectionLearning({
  classification = {},
  destination = {},
  finalOutcomeRecorded = false,
} = {}) {
  const exactItemMemory = buildExactItemMemory({ classification, destination });
  const outcomeRecorded = finalOutcomeRecorded === true;
  const reasonCodes = [];
  let decision;
  let statusId;

  if (!outcomeRecorded) {
    reasonCodes.push(POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS.FINAL_OUTCOME_NOT_RECORDED);
    decision = buildOutcomeOnlyDecision({
      exactItemMemory,
      finalOutcomeRecorded: false,
    });
    statusId = POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.BLOCKED;
  } else if (!exactItemMemory.eligible) {
    reasonCodes.push(...exactItemMemory.reasonCodes);
    decision = buildOutcomeOnlyDecision({
      exactItemMemory,
      finalOutcomeRecorded: true,
    });
    statusId = POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.OUTCOME_ONLY;
  } else {
    decision = buildPolicyLearningDecision({
      sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.MANUAL_CLASSIFICATION_CHANGE,
      answerOutcomeId: ANSWER_OUTCOME_IDS.REMEMBER_EXACT_ITEM,
      question: {
        frameId: QUESTION_FRAME_IDS.DESTINATION_FIT,
        stale: false,
      },
      answer: {
        label: exactItemMemory.libraryName,
        destinationLibraryId: exactItemMemory.libraryId,
        destinationLibraryName: exactItemMemory.libraryName,
        ambiguous: false,
      },
      candidate: {
        key: `manual_correction:${exactItemMemory.classificationId}:${exactItemMemory.mediaType}:${exactItemMemory.tmdbId}`,
        label: 'Manual correction exact-item memory',
        signalType: 'exact_item',
        destinationLibraryId: exactItemMemory.libraryId,
        destinationLibraryName: exactItemMemory.libraryName,
        evidenceCount: 1,
        evidenceSource: 'manual_correction',
      },
      finalOutcome: {
        itemId: exactItemMemory.classificationId,
        destinationLibraryId: exactItemMemory.libraryId,
        destinationLibraryName: exactItemMemory.libraryName,
        recorded: true,
      },
    });

    const guardAudit = buildPolicyLearningGuardAudit(decision);
    const admitted = guardAudit.ok === true &&
      decision.learning.decisionId === POLICY_LEARNING_DECISION_IDS.CANDIDATE &&
      decision.learning.tierId === POLICY_LEARNING_TIER_IDS.EXACT_ITEM_MEMORY &&
      decision.learning.canWriteLearning === true;

    if (admitted) {
      reasonCodes.push(POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS.EXACT_ITEM_MEMORY_ADMITTED);
      statusId = POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.READY;
    } else {
      reasonCodes.push(POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS.INVALID_GUARD_DECISION);
      statusId = POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.BLOCKED;
    }
  }

  const admitted = statusId === POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.READY;
  const result = {
    version: POLICY_MANUAL_CORRECTION_LEARNING_VERSION,
    ok: statusId !== POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.BLOCKED,
    statusId,
    decision,
    exactItemMemory: {
      ...exactItemMemory,
      eligible: admitted,
      reasonCodes: uniqueReasonCodes([
        ...exactItemMemory.reasonCodes,
        ...reasonCodes,
        ...decision.learning.reasonCodes,
        ...decision.learning.blockedReasonCodes,
      ]),
    },
    sideEffects: {
      finalOutcomeRecorded: outcomeRecorded,
      learningMutationPerformed: false,
      profileRefreshQueued: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
      routeAttemptPerformed: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyManualCorrectionLearningAudit(result),
  };
}

function buildPolicyManualCorrectionLearningAudit(result = {}) {
  const source = asObject(result);
  const exactItemMemory = asObject(source.exactItemMemory);
  const sideEffects = asObject(source.sideEffects);
  const decisionAudit = buildPolicyLearningGuardAudit(source.decision);
  const issues = [];

  if (source.version !== POLICY_MANUAL_CORRECTION_LEARNING_VERSION) {
    issues.push({
      riskId: POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS.INVALID_VERSION,
      message: 'Manual-correction learning must use the current contract version.',
    });
  }

  if (!Object.values(POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS).includes(source.statusId)) {
    issues.push({
      riskId: POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS.INVALID_STATUS,
      message: 'Manual-correction learning must use a supported status.',
    });
  }

  if (!decisionAudit.ok) {
    issues.push({
      riskId: POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS.INVALID_GUARD_DECISION,
      message: 'Manual-correction learning requires a valid learning-guard decision.',
    });
  }

  const exactItemMemoryIsComplete = Number.isInteger(exactItemMemory.classificationId) &&
    Number.isInteger(exactItemMemory.tmdbId) &&
    SUPPORTED_MEDIA_TYPES.includes(exactItemMemory.mediaType) &&
    Number.isInteger(exactItemMemory.libraryId) &&
    Boolean(normalizeString(exactItemMemory.libraryName));
  if (source.statusId === POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.READY && !exactItemMemoryIsComplete) {
    issues.push({
      riskId: POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS.INVALID_EXACT_ITEM_MEMORY,
      message: 'Ready manual-correction learning requires a complete exact-item reference.',
    });
  }

  if (source.statusId === POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.READY &&
      exactItemMemory.eligible !== true) {
    issues.push({
      riskId: POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS.READY_WITHOUT_EXACT_ITEM_MEMORY,
      message: 'Ready manual-correction learning must admit exact-item memory.',
    });
  }

  if (source.statusId !== POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.READY &&
      exactItemMemory.eligible === true) {
    issues.push({
      riskId: POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS.NON_READY_WITH_EXACT_ITEM_MEMORY,
      message: 'Blocked or outcome-only manual corrections cannot admit exact-item memory.',
    });
  }

  if (source.decision?.profileRefresh?.queue === true || sideEffects.profileRefreshQueued === true) {
    issues.push({
      riskId: POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS.PROFILE_REFRESH_QUEUED,
      message: 'Exact-item manual corrections cannot queue a profile refresh.',
    });
  }

  const prohibitedSideEffect = [
    'learningMutationPerformed',
    'providerLookupPerformed',
    'providerQuotaRead',
    'routeAttemptPerformed',
  ].find(sideEffectId => sideEffects[sideEffectId] === true);
  if (prohibitedSideEffect) {
    issues.push({
      riskId: POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
      message: 'Manual-correction learning admission must remain side-effect free.',
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

const policyManualCorrectionLearningService = Object.freeze({
  build: buildPolicyManualCorrectionLearning,
  audit: buildPolicyManualCorrectionLearningAudit,
});

export {
  POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS,
  POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS,
  POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS,
  POLICY_MANUAL_CORRECTION_LEARNING_VERSION,
  SUPPORTED_MEDIA_TYPES,
  buildPolicyManualCorrectionLearning,
  buildPolicyManualCorrectionLearningAudit,
  policyManualCorrectionLearningService,
};
