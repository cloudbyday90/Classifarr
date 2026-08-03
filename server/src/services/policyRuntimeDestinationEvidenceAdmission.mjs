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
  buildPolicyLearningDecisionFromBoundedIntent,
  buildPolicyLearningGuardAudit,
} from './policyLearningGuard.mjs';
import {
  buildPolicyLearningGuardInput,
  buildPolicyLearningIntakeEvent,
  validatePolicyLearningIntakeEvent,
} from './policyLearningIntakeContract.mjs';
import {
  buildPolicyRuntimeDestinationEvidenceSourceEventId,
} from './policyRuntimeDestinationEvidenceSourceEvent.mjs';
import {
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

const POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_VERSION =
  'policy.runtime_destination_evidence_admission.v1';

const POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_REASON_IDS = Object.freeze({
  EVIDENCE_ADMITTED: 'runtime_destination_evidence_admitted',
  LOCKED_RESOLUTION_INVALID: 'runtime_destination_evidence_locked_resolution_invalid',
  CANDIDATE_INVALID: 'runtime_destination_evidence_candidate_invalid',
  BOUNDED_INTENT_INVALID: 'runtime_destination_evidence_bounded_intent_invalid',
  INVALID_GUARD_DECISION: 'runtime_destination_evidence_invalid_guard_decision',
});

const ANSWER_OUTCOME_ID_BY_TIER_ID = Object.freeze({
  [POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE]:
    ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
  [POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE]:
    ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE,
});

function uniqueReasonCodes(reasonCodes = []) {
  return [...new Set(reasonCodes.filter(Boolean))];
}

function buildAdmissionReferences({ executionState = {}, provenance = {} } = {}) {
  const state = asObject(executionState);
  const classification = asObject(state.classification);
  const destination = asObject(state.destination);
  const resolution = asObject(state.resolution);
  const candidate = asObject(provenance.candidate);
  const tierId = normalizeString(candidate.tierId, 80);
  const answerOutcomeId = ANSWER_OUTCOME_ID_BY_TIER_ID[tierId] || null;
  const classificationId = normalizeIdentifier(classification.id);
  const destinationLibraryId = normalizeIdentifier(destination.id);
  const candidateKey = normalizeString(candidate.key, 160);

  return {
    classificationId,
    destinationLibraryId,
    destinationLibraryName: normalizeString(destination.name, 255) || null,
    contractFingerprint: normalizeString(resolution.contractFingerprint, 64) || null,
    candidate: {
      key: candidateKey || null,
      label: normalizeString(candidate.label, 160) || null,
      signalType: normalizeString(candidate.signalType, 80) || null,
      destinationLibraryId: normalizeIdentifier(candidate.destinationLibraryId),
      destinationLibraryName: normalizeString(candidate.destinationLibraryName, 255) || null,
      evidenceCount: Number.isInteger(Number(candidate.evidenceCount))
        ? Number(candidate.evidenceCount)
        : 0,
      evidenceSource: normalizeString(candidate.evidenceSource, 80) || null,
    },
    tierId: tierId || null,
    answerOutcomeId,
    sourceEventId: buildPolicyRuntimeDestinationEvidenceSourceEventId({
      classificationId,
      contractFingerprint: resolution.contractFingerprint,
      tierId,
      candidateKey,
    }),
  };
}

function buildPolicyRuntimeDestinationEvidenceAdmission({
  executionState = {},
  provenance = {},
  actorId = null,
} = {}) {
  const references = buildAdmissionReferences({ executionState, provenance });
  const sourceProvenance = asObject(provenance);
  const candidateIsComplete = Boolean(
    asObject(executionState).ok === true &&
    references.classificationId &&
    references.destinationLibraryId &&
    references.destinationLibraryName &&
    references.contractFingerprint &&
    references.sourceEventId &&
    references.answerOutcomeId &&
    references.candidate.key &&
    references.candidate.label &&
    references.candidate.signalType &&
    references.candidate.destinationLibraryId === references.destinationLibraryId &&
    references.candidate.destinationLibraryName === references.destinationLibraryName &&
    references.candidate.evidenceCount >= 2 &&
    references.candidate.evidenceSource === 'locked_native_intent_and_structured_metadata',
  );
  const intake = buildPolicyLearningIntakeEvent({
    sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION,
    sourceEventId: references.sourceEventId,
    actorId: normalizeString(actorId, 128) || null,
    itemId: references.classificationId,
    answerOutcomeId: candidateIsComplete
      ? references.answerOutcomeId
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
    candidate: candidateIsComplete ? references.candidate : {},
    finalOutcome: {
      itemId: references.classificationId,
      destinationLibraryId: references.destinationLibraryId,
      destinationLibraryName: references.destinationLibraryName,
      recorded: candidateIsComplete,
    },
  });
  const intakeAudit = validatePolicyLearningIntakeEvent(intake);
  const learningInput = buildPolicyLearningGuardInput(intake);
  const boundedLearning = learningInput && sourceProvenance.boundedIntentResult
    ? buildPolicyLearningDecisionFromBoundedIntent({
      boundedIntentResult: sourceProvenance.boundedIntentResult,
      learningInput,
    })
    : null;
  const decision = boundedLearning?.decision || null;
  const guardAudit = decision
    ? buildPolicyLearningGuardAudit(decision)
    : { ok: false, issueCount: 1 };
  const admitted = sourceProvenance.ok === true &&
    candidateIsComplete &&
    intakeAudit.ok === true &&
    boundedLearning?.ok === true &&
    guardAudit.ok === true &&
    decision?.learning?.decisionId === POLICY_LEARNING_DECISION_IDS.CANDIDATE &&
    decision.learning.tierId === references.tierId &&
    decision.learning.canWriteLearning === true &&
    decision.profileRefresh?.queue === true;
  const result = {
    version: POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_VERSION,
    ok: admitted,
    statusId: admitted
      ? POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_STATUS_IDS.READY
      : POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_STATUS_IDS.BLOCKED,
    intake,
    decision,
    references: {
      classificationId: references.classificationId,
      destinationLibraryId: references.destinationLibraryId,
      candidateKey: references.candidate.key,
      tierId: references.tierId,
      sourceEventId: references.sourceEventId,
    },
    reasonCodes: uniqueReasonCodes([
      admitted
        ? POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_REASON_IDS.EVIDENCE_ADMITTED
        : null,
      asObject(executionState).ok === true
        ? null
        : POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_REASON_IDS.LOCKED_RESOLUTION_INVALID,
      candidateIsComplete
        ? null
        : POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_REASON_IDS.CANDIDATE_INVALID,
      sourceProvenance.boundedIntentResult
        ? null
        : POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_REASON_IDS.BOUNDED_INTENT_INVALID,
      guardAudit.ok
        ? null
        : POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_REASON_IDS.INVALID_GUARD_DECISION,
      ...asArray(sourceProvenance.reasonCodes),
      ...asArray(decision?.learning?.reasonCodes),
      ...asArray(decision?.learning?.blockedReasonCodes),
    ]),
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
    audit: buildPolicyRuntimeDestinationEvidenceAdmissionAudit(result),
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildPolicyRuntimeDestinationEvidenceAdmissionAudit(result = {}) {
  const source = asObject(result);
  const references = asObject(source.references);
  const decision = asObject(source.decision);
  const sideEffects = asObject(source.sideEffects);
  const intakeAudit = validatePolicyLearningIntakeEvent(source.intake);
  const guardAudit = source.decision
    ? buildPolicyLearningGuardAudit(source.decision)
    : { ok: false, issueCount: 1 };
  const issues = [];

  if (source.version !== POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_VERSION) {
    issues.push('invalid_runtime_destination_evidence_admission_version');
  }
  if (!Object.values(POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_STATUS_IDS)
    .includes(source.statusId)) {
    issues.push('invalid_runtime_destination_evidence_admission_status');
  }
  if (!intakeAudit.ok) issues.push('invalid_runtime_destination_evidence_intake');
  if (!references.sourceEventId || !references.classificationId || !references.destinationLibraryId ||
      !references.candidateKey || !references.tierId) {
    issues.push('incomplete_runtime_destination_evidence_references');
  }
  if (source.ok === true &&
      (source.statusId !== POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_STATUS_IDS.READY ||
       !guardAudit.ok ||
       decision.learning?.decisionId !== POLICY_LEARNING_DECISION_IDS.CANDIDATE ||
       decision.profileRefresh?.queue !== true)) {
    issues.push('invalid_runtime_destination_evidence_admission');
  }
  if (source.ok === false && source.statusId !== POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_STATUS_IDS.BLOCKED) {
    issues.push('invalid_runtime_destination_evidence_block');
  }
  if (Object.values(sideEffects).some(value => value === true)) {
    issues.push('runtime_destination_evidence_admission_side_effect');
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

const policyRuntimeDestinationEvidenceAdmissionService = Object.freeze({
  build: buildPolicyRuntimeDestinationEvidenceAdmission,
  audit: buildPolicyRuntimeDestinationEvidenceAdmissionAudit,
});

export {
  POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_REASON_IDS,
  POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_STATUS_IDS,
  POLICY_RUNTIME_DESTINATION_EVIDENCE_ADMISSION_VERSION,
  buildPolicyRuntimeDestinationEvidenceAdmission,
  buildPolicyRuntimeDestinationEvidenceAdmissionAudit,
  policyRuntimeDestinationEvidenceAdmissionService,
};
