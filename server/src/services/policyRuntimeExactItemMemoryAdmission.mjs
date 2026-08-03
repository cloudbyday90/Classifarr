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
  buildPolicyLearningGuardInput,
  buildPolicyLearningIntakeEvent,
  validatePolicyLearningIntakeEvent,
} from './policyLearningIntakeContract.mjs';
import {
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

const POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_VERSION =
  'policy.runtime_exact_item_memory_admission.v1';

const POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_REASON_IDS = Object.freeze({
  EXACT_ITEM_MEMORY_ADMITTED: 'runtime_exact_item_memory_admitted',
  LOCKED_RESOLUTION_INVALID: 'runtime_exact_item_memory_locked_resolution_invalid',
  EXACT_ITEM_REFERENCE_MISSING: 'runtime_exact_item_memory_exact_item_reference_missing',
  INVALID_GUARD_DECISION: 'runtime_exact_item_memory_invalid_guard_decision',
});

function uniqueReasonCodes(reasonCodes = []) {
  return [...new Set(reasonCodes.filter(Boolean))];
}

function buildAdmissionReferences(executionState = {}) {
  const state = asObject(executionState);
  const classification = asObject(state.classification);
  const destination = asObject(state.destination);
  const resolution = asObject(state.resolution);

  return {
    classificationId: normalizeIdentifier(classification.id),
    tmdbId: normalizeIdentifier(classification.tmdbId),
    mediaType: normalizeString(classification.mediaType, 20).toLowerCase(),
    destinationLibraryId: normalizeIdentifier(destination.id),
    destinationLibraryName: normalizeString(destination.name, 255) || null,
    sourceEventId: normalizeString(resolution.sourceEventId, 160) || null,
  };
}

function buildPolicyRuntimeExactItemMemoryAdmission({
  executionState = {},
  actorId = null,
} = {}) {
  const references = buildAdmissionReferences(executionState);
  const referencesComplete = Boolean(
    asObject(executionState).ok === true &&
    references.classificationId &&
    references.tmdbId &&
    ['movie', 'tv'].includes(references.mediaType) &&
    references.destinationLibraryId &&
    references.destinationLibraryName &&
    references.sourceEventId,
  );
  const intake = buildPolicyLearningIntakeEvent({
    sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION,
    sourceEventId: references.sourceEventId,
    actorId: normalizeString(actorId, 128) || null,
    itemId: references.classificationId,
    answerOutcomeId: referencesComplete
      ? ANSWER_OUTCOME_IDS.REMEMBER_EXACT_ITEM
      : ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
    question: {
      frameId: QUESTION_FRAME_IDS.DESTINATION_FIT,
      stale: false,
    },
    answer: {
      label: 'Server-verified final destination',
      destinationLibraryId: references.destinationLibraryId,
      destinationLibraryName: references.destinationLibraryName,
      ambiguous: false,
    },
    candidate: referencesComplete ? {
      key: `runtime_resolution:${references.mediaType}:${references.tmdbId}:${references.destinationLibraryId}`,
      label: 'Server-verified exact-item memory',
      signalType: 'exact_item',
      destinationLibraryId: references.destinationLibraryId,
      destinationLibraryName: references.destinationLibraryName,
      evidenceCount: 1,
      evidenceSource: 'runtime_resolution',
    } : {},
    finalOutcome: {
      itemId: references.classificationId,
      destinationLibraryId: references.destinationLibraryId,
      destinationLibraryName: references.destinationLibraryName,
      recorded: referencesComplete,
    },
  });
  const intakeAudit = validatePolicyLearningIntakeEvent(intake);
  const learningInput = buildPolicyLearningGuardInput(intake);
  const decision = learningInput ? buildPolicyLearningDecision(learningInput) : null;
  const guardAudit = decision
    ? buildPolicyLearningGuardAudit(decision)
    : { ok: false, issueCount: 1 };
  const admitted = referencesComplete &&
    intakeAudit.ok === true &&
    guardAudit.ok === true &&
    decision?.learning?.decisionId === POLICY_LEARNING_DECISION_IDS.CANDIDATE &&
    decision.learning.tierId === POLICY_LEARNING_TIER_IDS.EXACT_ITEM_MEMORY &&
    decision.learning.canWriteLearning === true &&
    decision.profileRefresh?.queue !== true;
  const reasonCodes = uniqueReasonCodes([
    admitted
      ? POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_REASON_IDS.EXACT_ITEM_MEMORY_ADMITTED
      : null,
    referencesComplete
      ? null
      : POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_REASON_IDS.LOCKED_RESOLUTION_INVALID,
    references.tmdbId && ['movie', 'tv'].includes(references.mediaType)
      ? null
      : POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_REASON_IDS.EXACT_ITEM_REFERENCE_MISSING,
    guardAudit.ok ? null : POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_REASON_IDS.INVALID_GUARD_DECISION,
    ...(decision?.learning?.reasonCodes || []),
    ...(decision?.learning?.blockedReasonCodes || []),
  ]);
  const result = {
    version: POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_VERSION,
    ok: admitted,
    statusId: admitted
      ? POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_STATUS_IDS.READY
      : POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_STATUS_IDS.BLOCKED,
    intake,
    decision,
    references: {
      classificationId: references.classificationId,
      tmdbId: references.tmdbId,
      mediaType: references.mediaType || null,
      destinationLibraryId: references.destinationLibraryId,
      sourceEventId: references.sourceEventId,
    },
    reasonCodes,
    sideEffects: {
      finalOutcomePersisted: false,
      learningMutationPerformed: false,
      profileRefreshQueued: false,
      providerLookupPerformed: false,
      providerQuotaRead: false,
      routeAttemptPerformed: false,
    },
  };

  return {
    ...result,
    audit: buildPolicyRuntimeExactItemMemoryAdmissionAudit(result),
  };
}

function buildPolicyRuntimeExactItemMemoryAdmissionAudit(result = {}) {
  const source = asObject(result);
  const references = asObject(source.references);
  const decision = asObject(source.decision);
  const sideEffects = asObject(source.sideEffects);
  const intakeAudit = validatePolicyLearningIntakeEvent(source.intake);
  const guardAudit = source.decision
    ? buildPolicyLearningGuardAudit(source.decision)
    : { ok: false, issueCount: 1 };
  const issues = [];

  if (source.version !== POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_VERSION) {
    issues.push('invalid_runtime_exact_item_memory_admission_version');
  }
  if (!Object.values(POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_STATUS_IDS)
    .includes(source.statusId)) {
    issues.push('invalid_runtime_exact_item_memory_admission_status');
  }
  if (!intakeAudit.ok) issues.push('invalid_runtime_exact_item_memory_intake');
  if (!guardAudit.ok) issues.push('invalid_runtime_exact_item_memory_guard');
  if (source.statusId === POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_STATUS_IDS.READY &&
      (!references.classificationId || !references.tmdbId ||
       !['movie', 'tv'].includes(references.mediaType) ||
       !references.destinationLibraryId || !references.sourceEventId ||
       decision.learning?.tierId !== POLICY_LEARNING_TIER_IDS.EXACT_ITEM_MEMORY ||
       decision.learning?.canWriteLearning !== true)) {
    issues.push('invalid_runtime_exact_item_memory_references');
  }
  if (decision.profileRefresh?.queue === true || sideEffects.profileRefreshQueued === true) {
    issues.push('runtime_exact_item_memory_profile_refresh_queued');
  }
  if (['finalOutcomePersisted', 'learningMutationPerformed', 'providerLookupPerformed',
    'providerQuotaRead', 'routeAttemptPerformed'].some(key => sideEffects[key] === true)) {
    issues.push('runtime_exact_item_memory_admission_side_effect_reported');
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
    intakeAudit: { ok: intakeAudit.ok, issueCount: intakeAudit.issueCount },
    guardAudit: { ok: guardAudit.ok, issueCount: guardAudit.issueCount },
  };
}

const policyRuntimeExactItemMemoryAdmissionService = Object.freeze({
  build: buildPolicyRuntimeExactItemMemoryAdmission,
  audit: buildPolicyRuntimeExactItemMemoryAdmissionAudit,
});

export {
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_REASON_IDS,
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_STATUS_IDS,
  POLICY_RUNTIME_EXACT_ITEM_MEMORY_ADMISSION_VERSION,
  buildPolicyRuntimeExactItemMemoryAdmission,
  buildPolicyRuntimeExactItemMemoryAdmissionAudit,
  policyRuntimeExactItemMemoryAdmissionService,
};
